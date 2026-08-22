import type { PatientProfile } from "../data/foodSafety";
import { apiFetch, ApiError, NetworkError, formatAuthError } from "./apiClient";
import { authStore } from "./authStore";

export interface SignupPayload {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  profile: PatientProfile;
}

export async function signup(payload: SignupPayload): Promise<PatientProfile> {
  const data = await apiFetch<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  await authStore.setSession(data.token, data.profile);
  return data.profile;
}

export async function login(email: string, password: string): Promise<PatientProfile> {
  const data = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await authStore.setSession(data.token, data.profile);
  return data.profile;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    // Best-effort server call; clear session regardless.
  } finally {
    await authStore.logout();
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiFetch("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function changeEmail(newEmail: string, password: string): Promise<PatientProfile> {
  const data = await apiFetch<{ profile: PatientProfile }>("/auth/change-email", {
    method: "POST",
    body: JSON.stringify({ newEmail, password }),
  });
  await authStore.updateProfile(data.profile);
  return data.profile;
}

export { ApiError, NetworkError, formatAuthError };
