import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Resolve the NutriSafe API base URL for the current runtime.
 *
 * Expo Go on a physical device cannot reach `localhost` (that is the phone itself).
 * We derive the LAN host from Expo's Metro host when possible.
 */
function hostFromExpo(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // Legacy / Expo Go shapes
    (Constants as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } }).manifest2
      ?.extra?.expoGo?.debuggerHost ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ??
    null;

  if (!hostUri) return null;
  return hostUri.split(":")[0] || null;
}

function rewriteLocalhostForDevice(url: string): string {
  try {
    const parsed = new URL(url);
    const isLoopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (!isLoopback) return url.replace(/\/$/, "");

    // Web in the same machine can use localhost.
    if (Platform.OS === "web") return url.replace(/\/$/, "");

    const expoHost = hostFromExpo();
    if (expoHost && expoHost !== "localhost" && expoHost !== "127.0.0.1") {
      parsed.hostname = expoHost;
      return parsed.toString().replace(/\/$/, "");
    }

    // Android emulator loopback → host machine
    if (Platform.OS === "android") {
      parsed.hostname = "10.0.2.2";
      return parsed.toString().replace(/\/$/, "");
    }

    return url.replace(/\/$/, "");
  } catch {
    return url.replace(/\/$/, "");
  }
}

export function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return rewriteLocalhostForDevice(fromEnv);

  const expoHost = hostFromExpo();
  if (expoHost && expoHost !== "localhost" && expoHost !== "127.0.0.1") {
    return `http://${expoHost}:4000`;
  }

  if (Platform.OS === "android") return "http://10.0.2.2:4000";
  return "http://localhost:4000";
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Lazy getter — recomputes the base URL on each call so a stale
 * module-evaluated const can't pin a wrong host (e.g. localhost cached
 * before Expo's hostUri was available).
 */
export function getApiBaseUrlLazy(): string {
  return resolveApiBaseUrl();
}

/** Alias kept for readability at call sites; same lazy recompute. */
export function getApiBaseUrlCurrent(): string {
  return resolveApiBaseUrl();
}

/** Minimum confidence (0–1) required to auto-analyze a scanned food. */
export const VISION_CONFIDENCE_THRESHOLD = 0.72;
