import type { PatientProfile } from "../data/foodSafety";
import { apiFetch } from "./apiClient";
import { authStore } from "./authStore";

export async function fetchProfile(): Promise<PatientProfile> {
  const data = await apiFetch<{ profile: PatientProfile }>("/profile");
  await authStore.updateProfile(data.profile);
  return data.profile;
}

export async function updateProfile(fields: Partial<PatientProfile>): Promise<PatientProfile> {
  const data = await apiFetch<{ profile: PatientProfile }>("/profile", {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
  await authStore.updateProfile(data.profile);
  return data.profile;
}
