import { foodSafetyStore } from "../data/foodSafety";
import { authStore } from "./authStore";
import { fetchHistory } from "./historyService";

/** Sync local foodSafetyStore from authenticated session + server history. */
export async function hydrateSessionData(): Promise<void> {
  const profile = authStore.getProfile();
  if (profile) {
    foodSafetyStore.hydratePatient(profile);
  }

  if (!authStore.isAuthenticated()) {
    foodSafetyStore.resetSession();
    return;
  }

  try {
    const history = await fetchHistory();
    if (history === null) return;
    const local = foodSafetyStore.getHistory();
    const remoteIds = new Set(history.map((h) => h.id));
    const localOnly = local.filter((l) => !remoteIds.has(l.id));
    const merged = [...localOnly, ...history];
    foodSafetyStore.setHistory(merged);
  } catch {
    // Keep whatever local history exists if the network call fails.
  }
}
