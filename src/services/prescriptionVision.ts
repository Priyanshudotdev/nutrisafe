/**
 * Prescription/report photo → structured health info via the server's AI layer.
 * The AI only extracts what's written — the user reviews and confirms before
 * anything is applied to their profile.
 */

import { getApiBaseUrlCurrent } from "../config/api";
import { ensureFreshToken, handleVisionAuthFailure } from "./apiClient";
import { buildImageForm, buildImagePayload } from "./imageUpload";
import type { PatientCondition } from "../data/foodSafety";

/** Server extraction can be slow (cold start + inference) — and uploads on
 *  poor networks need room. Abort truly hung requests before they trap UX. */
const PRESCRIPTION_VISION_TIMEOUT_MS = 90_000;

export interface PrescriptionExtraction {
  status: "success" | "unreadable" | "failed" | "not_configured";
  documentType?: string;
  conditions?: PatientCondition[];
  allergensList?: string[];
  notes?: string;
  doctorName?: string | null;
  summary?: string;
  message: string;
}

interface PrescriptionApiResponse {
  readable?: boolean;
  documentType?: string;
  conditions?: string[];
  allergensList?: string[];
  notes?: string;
  doctorName?: string | null;
  summary?: string;
  status?: string;
  message?: string;
  error?: string;
}

const VALID_CONDITIONS: PatientCondition[] = [
  "diabetes",
  "ckd",
  "hypertension",
  "celiac",
  "allergy",
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Upload attempts: one retry with backoff covers transient mobile-network
 *  blips (tunnel drops, radio handoffs). Read-only endpoint, safe to repeat. */
const PRESCRIPTION_MAX_ATTEMPTS = 2;

export async function extractPrescriptionFromImage(
  imageUri: string
): Promise<PrescriptionExtraction> {
  const token = await ensureFreshToken("/prescription/extract");
  const baseUrl = getApiBaseUrlCurrent();

  // Preferred path: base64 JSON (see foodVision for rationale). Falls back
  // to multipart when the payload can't be built or the server predates it.
  let payload: { base64: string; mime: string } | null = null;
  try {
    payload = await buildImagePayload(imageUri);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "";
    const isActionable =
      /heic|heif|doesn't look like an image|could not read|too large/i.test(detail);
    if (isActionable) {
      return { status: "failed", message: detail };
    }
  }

  if (payload) {
    const jsonResult = await postJsonExtraction(baseUrl, token, payload);
    if (jsonResult !== null) return jsonResult;
  }

  return postMultipartExtraction(baseUrl, token, imageUri);
}

function normalizeExtraction(data: PrescriptionApiResponse): PrescriptionExtraction {
  if (data.readable !== true) {
    return {
      status: "unreadable",
      message:
        "We couldn't clearly read this document. Try better lighting, flatten the page, fill the frame — or enter details manually.",
    };
  }

  const conditions = (data.conditions ?? []).filter((c): c is PatientCondition =>
    VALID_CONDITIONS.includes(c as PatientCondition)
  );

  if (conditions.length === 0 && (data.allergensList ?? []).length === 0 && !data.notes) {
    return {
      status: "unreadable",
      message:
        "We read the page but couldn't find dietary information in it. Enter your details manually, or try a different document.",
    };
  }

  return {
    status: "success",
    documentType: data.documentType,
    conditions,
    allergensList: data.allergensList ?? [],
    notes: data.notes ?? "",
    doctorName: data.doctorName ?? null,
    summary: data.summary ?? "",
    message: data.summary || "Prescription details extracted.",
  };
}

async function readExtractionBody(response: Response): Promise<PrescriptionApiResponse> {
  try {
    return (await response.json()) as PrescriptionApiResponse;
  } catch {
    return {};
  }
}

async function postJsonExtraction(
  baseUrl: string,
  token: string | null,
  payload: { base64: string; mime: string }
): Promise<PrescriptionExtraction | null> {
  for (let attempt = 1; attempt <= PRESCRIPTION_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PRESCRIPTION_VISION_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${baseUrl}/prescription/extract-json`, {
        method: "POST",
        headers,
        body: JSON.stringify({ imageBase64: payload.base64, mime: payload.mime }),
        signal: controller.signal,
      });

      if (response.status === 404) return null; // old server → multipart fallback

      const data = await readExtractionBody(response);

      if (response.status === 503 || data.status === "not_configured") {
        return {
          status: "not_configured",
          message:
            data.message ??
            "Prescription scanning isn't available right now. You can fill your health profile manually.",
        };
      }

      if (response.status === 401) {
        handleVisionAuthFailure(401, "/prescription/extract");
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
            "We couldn't read the prescription. Try a clearer, well-lit photo or enter details manually.",
        };
      }

      return normalizeExtraction(data);
    } catch (err) {
      clearTimeout(timer);
      const aborted =
        controller.signal.aborted || (err instanceof Error && err.name === "AbortError");
      if (attempt < PRESCRIPTION_MAX_ATTEMPTS) {
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
        message: "We couldn't reach the extraction service. Check your connection and try again.",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    status: "failed",
    message: "We couldn't reach the extraction service. Check your connection and try again.",
  };
}

async function postMultipartExtraction(
  baseUrl: string,
  token: string | null,
  imageUri: string
): Promise<PrescriptionExtraction> {
  for (let attempt = 1; attempt <= PRESCRIPTION_MAX_ATTEMPTS; attempt++) {
    // FormData bodies are consumable — rebuild every attempt like foodVision.
    let formData: FormData;
    try {
      ({ form: formData } = await buildImageForm(imageUri, "image", "prescription"));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
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
    const timer = setTimeout(() => controller.abort(), PRESCRIPTION_VISION_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${baseUrl}/prescription/extract`, {
        method: "POST",
        body: formData,
        headers,
        signal: controller.signal,
      });

      const data = await readExtractionBody(response);

      if (response.status === 503 || data.status === "not_configured") {
        return {
          status: "not_configured",
          message:
            data.message ??
            "Prescription scanning isn't available right now. You can fill your health profile manually.",
        };
      }

      if (response.status === 401) {
        handleVisionAuthFailure(401, "/prescription/extract");
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
            "We couldn't read the prescription. Try a clearer, well-lit photo or enter details manually.",
        };
      }

      return normalizeExtraction(data);
    } catch (err) {
      clearTimeout(timer);
      const aborted =
        controller.signal.aborted || (err instanceof Error && err.name === "AbortError");
      if (attempt < PRESCRIPTION_MAX_ATTEMPTS) {
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
        message: "We couldn't reach the extraction service. Check your connection and try again.",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // Unreachable: the loop always returns or continues within bounds.
  return {
    status: "failed",
    message: "We couldn't reach the extraction service. Check your connection and try again.",
  };
}
