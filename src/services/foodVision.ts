import { API_BASE_URL, FOOD_VISION_API_URL, VISION_CONFIDENCE_THRESHOLD } from "../config/api";
import { authStore } from "./authStore";

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
      message: "No food was detected. Try a full-dish photo with good lighting, or search manually.",
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
 * Identifies food from an image.
 * Prefers the NutriCheck server proxy (/vision/identify) so keys stay server-side.
 * Falls back to EXPO_PUBLIC_FOOD_VISION_API_URL only if set for direct calls.
 * Vision only identifies food — it never generates medical verdicts.
 */
export async function identifyFoodFromImage(imageUri: string): Promise<FoodIdentificationResult> {
  const formData = new FormData();
  formData.append("image", {
    uri: imageUri,
    type: "image/jpeg",
    name: "food.jpg",
  } as unknown as Blob);

  const token = authStore.getToken();
  const proxyUrl = `${API_BASE_URL}/vision/identify`;
  const targetUrl = FOOD_VISION_API_URL || proxyUrl;

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (!FOOD_VISION_API_URL && token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(targetUrl, {
      method: "POST",
      body: formData,
      headers,
    });

    let data: VisionApiResponse = {};
    try {
      data = (await response.json()) as VisionApiResponse;
    } catch {
      data = {};
    }

    if (response.status === 503 || data.status === "not_configured") {
      return {
        status: "not_configured",
        message:
          data.message ??
          "Food recognition isn't available right now. Search for the food manually instead.",
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
  } catch {
    return {
      status: "failed",
      message: "We couldn't reach the identification service. Check your connection and try again.",
    };
  }
}
