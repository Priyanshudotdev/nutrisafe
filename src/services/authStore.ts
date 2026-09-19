/**
 * Reactive in-memory auth store.
 *
 * The JWT lives in expo-secure-store (encrypted at rest: Keychain on iOS,
 * Keystore on Android). SecureStore is unavailable on web, where the token
 * falls back to AsyncStorage. The non-secret profile stays in AsyncStorage.
 *
 * Use authStore.init() once at app startup to rehydrate from storage.
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { PatientProfile } from "../data/foodSafety";

// SecureStore keys may contain ONLY alphanumeric characters, ".", "-", "_"
// — so the token uses a dot-namespaced key there, while AsyncStorage
// (web fallback + profile) keeps the usual "@scope:key" convention.
const TOKEN_KEY_SECURE = "nutrisafe.token";
const TOKEN_KEY_ASYNC = "@nutrisafe:token";
const PROFILE_KEY = "@nutrisafe:profile";

const useSecureStore = Platform.OS !== "web";

async function secureAvailable(): Promise<boolean> {
  return useSecureStore && (await SecureStore.isAvailableAsync());
}

async function readToken(): Promise<string | null> {
  if (await secureAvailable()) {
    return SecureStore.getItemAsync(TOKEN_KEY_SECURE);
  }
  return AsyncStorage.getItem(TOKEN_KEY_ASYNC);
}

async function writeToken(token: string): Promise<void> {
  if (await secureAvailable()) {
    await SecureStore.setItemAsync(TOKEN_KEY_SECURE, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return;
  }
  await AsyncStorage.setItem(TOKEN_KEY_ASYNC, token);
}

async function deleteToken(): Promise<void> {
  if (await secureAvailable()) {
    await SecureStore.deleteItemAsync(TOKEN_KEY_SECURE);
    return;
  }
  await AsyncStorage.removeItem(TOKEN_KEY_ASYNC);
}

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
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Rehydrate from storage — call once at app startup. */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const [token, profileJson] = await Promise.all([
        readToken(),
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
    // Persist first: if storage fails we keep the previous in-memory
    // session intact and throw, instead of stranding a half-saved login.
    await Promise.all([
      writeToken(token),
      AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)),
    ]);
    this.token = token;
    this.profile = profile;
    this.notify();
  }

  /** Replace the stored token without touching the profile (refresh/rotation). */
  async setToken(token: string): Promise<void> {
    await writeToken(token);
    this.token = token;
    this.notify();
  }

  async updateProfile(partial: Partial<PatientProfile> | PatientProfile): Promise<void> {
    // A full server profile (always carries `email`) is accepted even when
    // the local store is empty — e.g. fetchProfile() on a fresh install.
    // Bare partials with no local base are still ignored (nothing to merge into).
    if (!this.profile && !("email" in partial)) return;
    this.profile = { ...(this.profile ?? ({} as PatientProfile)), ...partial };
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile));
    this.notify();
  }

  async logout(): Promise<void> {
    // Best-effort storage clear: memory is always reset so a storage
    // failure can't strand the user in a logged-in UI.
    try {
      await Promise.all([deleteToken(), AsyncStorage.removeItem(PROFILE_KEY)]);
    } catch (e) {
      console.warn("authStore.logout: storage clear failed, session reset in memory", e);
    }
    this.token = null;
    this.profile = null;
    this.notify();
  }
}

export const authStore = new AuthStore();
