import type { FoodSafetyAnalysis } from "../data/foodSafety";
import { apiFetch } from "./apiClient";
import { authStore } from "./authStore";

/**
 * Fetch the user's history from the server.
 * Returns null when not authenticated so callers can distinguish
 * "no session" (skip / keep local) from "empty history" ([]).
 */
export async function fetchHistory(): Promise<FoodSafetyAnalysis[] | null> {
  if (!authStore.isAuthenticated()) return null;
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
 * Delete one analysis from the server.
 */
export async function deleteAnalysis(id: string): Promise<void> {
  if (!authStore.isAuthenticated()) return;
  await apiFetch(`/history/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/**
 * Clear history on the server.
 */
export async function clearHistory(): Promise<void> {
  if (!authStore.isAuthenticated()) return;
  await apiFetch("/history", { method: "DELETE" });
}
