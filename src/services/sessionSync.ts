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
    foodSafetyStore.setHistory([]);
    return;
  }

  try {
    const history = await fetchHistory();
    foodSafetyStore.setHistory(history);
  } catch {
    // Keep whatever local history exists if the network call fails.
  }
}
