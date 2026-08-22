import type { FoodSafetyAnalysis } from "../data/foodSafety";
import { apiFetch } from "./apiClient";
import { authStore } from "./authStore";

/**
 * Fetch the user's history from the server.
 * Falls back to the local foodSafetyStore if not authenticated.
 */
export async function fetchHistory(): Promise<FoodSafetyAnalysis[]> {
  if (!authStore.isAuthenticated()) return [];
  const data = await apiFetch<{ history: FoodSafetyAnalysis[] }>("/history");
  return data.history;
}

/**
 * Persist a new analysis to the server (and to the local store separately).
 */
export async function saveAnalysis(analysis: FoodSafetyAnalysis): Promise<void> {
  if (!authStore.isAuthenticated()) return;
  await apiFetch("/history", {
    method: "POST",
    body: JSON.stringify({ analysis }),
  });
}

/**
 * Clear history on the server.
 */
export async function clearHistory(): Promise<void> {
  if (!authStore.isAuthenticated()) return;
  await apiFetch("/history", { method: "DELETE" });
}
