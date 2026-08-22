/**
 * Thin wrapper around fetch that automatically attaches the Bearer token
 * and provides consistent error handling.
 */

import { API_BASE_URL } from "../config/api";
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

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = authStore.getToken();
  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }

  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Network request failed";
    throw new NetworkError(
      `Cannot reach the NutriCheck API at ${API_BASE_URL}. ${detail}. ` +
        `Start the server with "pnpm api" and ensure your device can reach this host on your network.`
    );
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
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
