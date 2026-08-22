/**
 * Prescription/report photo → structured health info via the server's AI layer.
 * The AI only extracts what's written — the user reviews and confirms before
 * anything is applied to their profile.
 */

import { API_BASE_URL } from "../config/api";
import { authStore } from "./authStore";
import type { PatientCondition } from "../data/foodSafety";

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

const VALID_CONDITIONS: PatientCondition[] = ["diabetes", "ckd", "hypertension", "celiac", "allergy"];

export async function extractPrescriptionFromImage(imageUri: string): Promise<PrescriptionExtraction> {
  const formData = new FormData();
  formData.append("image", {
    uri: imageUri,
    type: "image/jpeg",
    name: "prescription.jpg",
  } as unknown as Blob);

  const token = authStore.getToken();

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/prescription/extract`, {
      method: "POST",
      body: formData,
      headers,
    });

    let data: PrescriptionApiResponse = {};
    try {
      data = (await response.json()) as PrescriptionApiResponse;
    } catch {
      data = {};
    }

    if (response.status === 503 || data.status === "not_configured") {
      return {
        status: "not_configured",
        message:
          data.message ??
          "Prescription scanning isn't available right now. You can fill your health profile manually.",
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
  } catch {
    return {
      status: "failed",
      message: "We couldn't reach the extraction service. Check your connection and try again.",
    };
  }
}
