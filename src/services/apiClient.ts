/**
 * Thin wrapper around fetch that automatically attaches the Bearer token
 * and provides consistent error handling.
 */

import { getApiBaseUrlCurrent } from "../config/api";
import { authStore } from "./authStore";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return (body as { error?: string }).error ?? response.statusText;
  } catch {
    return response.statusText || `Request failed (${response.status})`;
  }
}

/** Default timeout for apiFetch when the caller provides no signal. */
const API_REQUEST_TIMEOUT_MS = 30_000;

export function getApiBaseUrl(): string {
  return getApiBaseUrlCurrent();
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrlCurrent();
  const token = authStore.getToken();
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }

  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  // 30s timeout unless the caller already provided a signal (e.g.
  // requestServerAnalysis manages its own AbortController) — respect it.
  const callerSignal = options.signal ?? undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let signal: AbortSignal | undefined = callerSignal;
  if (!signal) {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
    signal = controller.signal;
  }
  try {
    response = await fetch(url, { ...options, headers, signal });
  } catch (err) {
    const isAbort =
      signal?.aborted || (err instanceof Error && err.name === "AbortError");
    if (isAbort && !callerSignal) {
      throw new NetworkError(
        `Request timed out after ${API_REQUEST_TIMEOUT_MS / 1000}s. ` +
          `The NutriCheck API at ${baseUrl} took too long to respond.`
      );
    }
    const detail = err instanceof Error ? err.message : "Network request failed";
    throw new NetworkError(
      `Cannot reach the NutriCheck API at ${baseUrl}. ${detail}. ` +
        `Start the server with "pnpm api" and ensure your device can reach this host on your network.`
    );
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    if (response.status === 401 && !path.startsWith("/auth")) {
      // Token expired/revoked: drop the dead session so AuthGate routes to
      // login instead of failing every sync silently.
      void authStore.logout();
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/** Shared helper for auth screens — never maps API errors to a fake "connection" message. */
export function formatAuthError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof NetworkError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}
