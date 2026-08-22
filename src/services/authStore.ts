/**
 * Reactive in-memory auth store — syncs with AsyncStorage for persistence.
 * Listeners are notified whenever the auth state changes.
 *
 * Use authStore.init() once at app startup to rehydrate from storage.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PatientProfile } from "../data/foodSafety";

const TOKEN_KEY = "@nutricheck:token";
const PROFILE_KEY = "@nutricheck:profile";

type AuthListener = () => void;

class AuthStore {
  private token: string | null = null;
  private profile: PatientProfile | null = null;
  private initialized = false;
  private listeners: Set<AuthListener> = new Set();

  private notify() {
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: AuthListener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Rehydrate from AsyncStorage — call once at app startup. */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const [token, profileJson] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(PROFILE_KEY),
      ]);
      this.token = token;
      this.profile = profileJson ? (JSON.parse(profileJson) as PatientProfile) : null;
    } catch {
      // Storage errors don't break the app — user stays logged out.
    }
    this.notify();
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  getToken(): string | null {
    return this.token;
  }

  getProfile(): PatientProfile | null {
    return this.profile;
  }

  async setSession(token: string, profile: PatientProfile): Promise<void> {
    this.token = token;
    this.profile = profile;
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, token),
      AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)),
    ]);
    this.notify();
  }

  async updateProfile(partial: Partial<PatientProfile> | PatientProfile): Promise<void> {
    if (!this.profile && !("email" in partial && "name" in partial)) return;
    this.profile = { ...(this.profile ?? ({} as PatientProfile)), ...partial };
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile));
    this.notify();
  }

  async logout(): Promise<void> {
    this.token = null;
    this.profile = null;
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(PROFILE_KEY),
    ]);
    this.notify();
  }
}

export const authStore = new AuthStore();
