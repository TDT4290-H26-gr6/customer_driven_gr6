import { env } from "@/config/env";
import type { ApiError } from "@/shared/types/common";
import { getToken, clearToken } from "./token";

type Options = Omit<RequestInit, "body"> & {
  /** JSON-serialisable request body. */
  body?: unknown;
  /** Attach the bearer token (default true). */
  auth?: boolean;
};

/**
 * The only place in the app that calls fetch(). Prefixes the API base URL,
 * attaches the auth header, normalises errors to ApiError, and drops the
 * session on 401.
 */
export async function apiFetch<T>(path: string, opts: Options = {}): Promise<T> {
  const { body, auth = true, headers, ...rest } = opts;
  const token = auth ? getToken() : null;

  const res = await fetch(`${env.API_URL}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) clearToken();

  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    const error: ApiError = { status: res.status, message: message || res.statusText };
    throw error;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
