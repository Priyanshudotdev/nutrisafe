import type { PatientCondition, PatientProfile } from "../data/foodSafety";
import { apiFetch } from "./apiClient";
import { authStore } from "./authStore";
import { foodSafetyStore } from "../data/foodSafety";

export interface OnboardingPayload {
  conditions: PatientCondition[];
  age?: number | null;
  gender?: string | null;
  city?: string | null;
  allergensList?: string[];
  notes?: string;
  doctorName?: string | null;
}

/** Save health profile after signup — separate from authentication. */
export async function completeOnboarding(payload: OnboardingPayload): Promise<PatientProfile> {
  const data = await apiFetch<{ profile: PatientProfile }>("/onboarding", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      primaryCondition: payload.conditions[0],
    }),
  });
  await authStore.updateProfile(data.profile);
  foodSafetyStore.hydratePatient(data.profile);
  return data.profile;
}

export function needsOnboarding(profile: PatientProfile | null | undefined): boolean {
  if (!profile) return false;
  return profile.onboardingCompleted !== true;
}
