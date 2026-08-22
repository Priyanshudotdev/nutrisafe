/**
 * Persisted theme store — reads/writes AsyncStorage.
 * Subscribe for real-time updates; call init() once at app startup.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "@nutricheck:theme";
export type ThemeMode = "light" | "dark" | "system";

type ThemeListener = () => void;

class ThemeStore {
  private mode: ThemeMode = "system";
  private initialized = false;
  private listeners: Set<ThemeListener> = new Set();

  private notify() { this.listeners.forEach((l) => l()); }

  subscribe(listener: ThemeListener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const stored = await AsyncStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") {
        this.mode = stored;
      }
    } catch { /* ignore */ }
    this.notify();
  }

  getMode(): ThemeMode { return this.mode; }

  async setMode(mode: ThemeMode): Promise<void> {
    this.mode = mode;
    try { await AsyncStorage.setItem(THEME_KEY, mode); } catch { /* ignore */ }
    this.notify();
  }

  /** Resolve effective scheme given a system preference. */
  resolve(systemScheme: string | null | undefined): "light" | "dark" {
    if (this.mode === "system") {
      return systemScheme === "dark" ? "dark" : "light";
    }
    return this.mode;
  }
}

export const themeStore = new ThemeStore();
