import { VISION_CONFIDENCE_THRESHOLD, getApiBaseUrlCurrent } from "../config/api";
import { ensureFreshToken, handleVisionAuthFailure } from "./apiClient";
import { buildImageForm, buildImagePayload } from "./imageUpload";

/** Server vision can be slow (cold start + inference) — and uploads on poor
 *  networks need room. Abort truly hung requests before they trap UX. */
const FOOD_VISION_TIMEOUT_MS = 90_000;

export interface FoodCandidate {
  name: string;
  confidence: number;
}

export interface FoodIdentificationResult {
  status: "success" | "uncertain" | "failed" | "not_configured";
  foodName?: string;
  confidence?: number;
  candidates?: FoodCandidate[];
  message: string;
}

interface VisionApiResponse {
  status?: string;
  foodName?: string;
  confidence?: number;
  candidates?: FoodCandidate[];
  message?: string;
  error?: string;
}

function normalizeResult(data: VisionApiResponse): FoodIdentificationResult {
  if (data.status === "not_configured") {
    return {
      status: "not_configured",
      message:
        data.message ??
        "Food recognition isn't available right now. Search for the food manually instead.",
    };
  }

  if (data.status === "failed") {
    return {
      status: "failed",
      message:
        data.message ??
        "We couldn't identify this food from the image. Try a clearer, well-lit photo of the full dish.",
      candidates: data.candidates,
    };
  }

  const confidence = data.confidence ?? 0;
  const foodName = data.foodName?.trim();

  if (!foodName) {
    return {
      status: "failed",
      message:
        "No food was detected. Try a full-dish photo with good lighting, or search manually.",
      candidates: data.candidates,
    };
  }

  if (confidence < VISION_CONFIDENCE_THRESHOLD) {
    return {
      status: "uncertain",
      foodName,
      confidence,
      candidates: data.candidates ?? [{ name: foodName, confidence }],
      message: `We're not fully confident this is ${foodName}. Please confirm or pick from suggestions.`,
    };
  }

  return {
    status: "success",
    foodName,
    confidence,
    message: `Identified as ${foodName}.`,
  };
}

/**
 * Identifies food from an image via the authenticated NutriSafe server
 * proxy (/vision/identify), so provider keys stay server-side.
 * Vision only identifies food — it never generates medical verdicts.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Upload attempts: one retry with backoff covers transient mobile-network
 *  blips (tunnel drops, radio handoffs). Read-only endpoint, safe to repeat. */
const VISION_MAX_ATTEMPTS = 2;

export async function identifyFoodFromImage(imageUri: string): Promise<FoodIdentificationResult> {
  // Proactive refresh (shared with apiFetch) so an expired-but-refreshable
  // token doesn't turn into an avoidable vision failure.
  const token = await ensureFreshToken("/vision/identify");
  const baseUrl = getApiBaseUrlCurrent();

  // Preferred path: base64 JSON. One representation on every platform, no
  // multipart boundary issues, and safely reusable across retries (FormData
  // bodies are consumable on Android). Falls back to multipart below when
  // the payload can't be built or the server predates the -json routes.
  let payload: { base64: string; mime: string } | null = null;
  let payloadError: string | null = null;
  try {
    payload = await buildImagePayload(imageUri);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "";
    const isActionable =
      /heic|heif|doesn't look like an image|could not read|too large/i.test(detail);
    // Actionable errors (HEIC, non-image, oversize) are terminal — the
    // multipart path would fail the same way.
    if (isActionable) {
      return { status: "failed", message: detail };
    }
    payloadError = detail;
  }

  if (payload) {
    const jsonResult = await postJsonVision(baseUrl, token, payload);
    // 404 = server predates the -json routes (e.g. not yet redeployed) —
    // fall through to multipart. Any other terminal result is returned.
    if (jsonResult !== null) return jsonResult;
  }

  return postMultipartVision(baseUrl, token, imageUri, payloadError);
}

async function postJsonVision(
  baseUrl: string,
  token: string | null,
  payload: { base64: string; mime: string }
): Promise<FoodIdentificationResult | null> {
  const proxyUrl = `${baseUrl}/vision/identify-json`;

  for (let attempt = 1; attempt <= VISION_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FOOD_VISION_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(proxyUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ imageBase64: payload.base64, mime: payload.mime }),
        signal: controller.signal,
      });

      if (response.status === 404) return null; // old server → multipart fallback

      const data = await readVisionBody(response);

      if (response.status === 503 || data.status === "not_configured") {
        return {
          status: "not_configured",
          message:
            data.message ??
            "Food recognition isn't available right now. Search for the food manually instead.",
        };
      }

      if (response.status === 401) {
        handleVisionAuthFailure(401, "/vision/identify");
        return {
          status: "failed",
          message: "Your session expired. Please log in again, then retry the scan.",
        };
      }

      if (!response.ok) {
        return {
          status: "failed",
          message:
            data.message ??
            data.error ??
            "We couldn't identify this food from the image. Try a clearer photo or search manually.",
        };
      }

      return normalizeResult(data);
    } catch (err) {
      clearTimeout(timer);
      const aborted =
        controller.signal.aborted || (err instanceof Error && err.name === "AbortError");
      if (attempt < VISION_MAX_ATTEMPTS) {
        await sleep(1500 * attempt);
        continue;
      }
      if (aborted) {
        return {
          status: "failed",
          message: "Request timed out. Please check your connection and try again.",
        };
      }
      return {
        status: "failed",
        message:
          "We couldn't reach the identification service. Check your connection and try again.",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    status: "failed",
    message: "We couldn't reach the identification service. Check your connection and try again.",
  };
}

async function readVisionBody(response: Response): Promise<VisionApiResponse> {
  try {
    return (await response.json()) as VisionApiResponse;
  } catch {
    return {};
  }
}

async function postMultipartVision(
  baseUrl: string,
  token: string | null,
  imageUri: string,
  payloadError: string | null
): Promise<FoodIdentificationResult> {
  const proxyUrl = `${baseUrl}/vision/identify`;

  for (let attempt = 1; attempt <= VISION_MAX_ATTEMPTS; attempt++) {
    // FormData request bodies are consumable. Rebuild the body for every
    // retry; reusing one after a failed fetch can produce an empty upload on
    // Android without reaching the server.
    let formData: FormData;
    try {
      ({ form: formData } = await buildImageForm(imageUri, "image", "food"));
    } catch (err) {
      const detail = err instanceof Error ? err.message : payloadError ?? "";
      // Surface actionable client errors (HEIC, non-image) verbatim;
      // fall back to the generic message for unexpected failures.
      const isActionable =
        /heic|heif|doesn't look like an image|could not read/i.test(detail);
      return {
        status: "failed",
        message: isActionable
          ? detail
          : "We couldn't prepare this photo for upload. Try picking the photo again.",
      };
    }

    const controller = new AbortController();
    // An abort maps to a "failed" timeout message below (not a throw), so UX
    // can offer retry without a stuck spinner.
    const timer = setTimeout(() => controller.abort(), FOOD_VISION_TIMEOUT_MS);
    try {
      // All vision traffic goes through the authenticated server proxy, which
      // keeps provider keys server-side and enforces per-user rate limits.
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(proxyUrl, {
        method: "POST",
        body: formData,
        headers,
        signal: controller.signal,
      });

      const data = await readVisionBody(response);

      if (response.status === 503 || data.status === "not_configured") {
        return {
          status: "not_configured",
          message:
            data.message ??
            "Food recognition isn't available right now. Search for the food manually instead.",
        };
      }

      if (response.status === 401) {
        handleVisionAuthFailure(401, "/vision/identify");
        return {
          status: "failed",
          message: "Your session expired. Please log in again, then retry the scan.",
        };
      }

      if (!response.ok) {
        return {
          status: "failed",
          message:
            data.message ??
            data.error ??
            "We couldn't identify this food from the image. Try a clearer photo or search manually.",
        };
      }

      return normalizeResult(data);
    } catch (err) {
      clearTimeout(timer);
      const aborted =
        controller.signal.aborted || (err instanceof Error && err.name === "AbortError");
      if (attempt < VISION_MAX_ATTEMPTS) {
        // Transient network blip — back off and retry once before surfacing.
        await sleep(1500 * attempt);
        continue;
      }
      if (aborted) {
        return {
          status: "failed",
          message: "Request timed out. Please check your connection and try again.",
        };
      }
      return {
        status: "failed",
        message:
          "We couldn't reach the identification service. Check your connection and try again.",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // Unreachable: the loop always returns or continues within bounds.
  return {
    status: "failed",
    message: "We couldn't reach the identification service. Check your connection and try again.",
  };
}
