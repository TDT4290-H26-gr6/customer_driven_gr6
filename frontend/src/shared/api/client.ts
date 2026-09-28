import { env } from "@/config/env";
import type { ApiError } from "@/shared/types/common";
import { getToken, clearToken } from "./token";

type Options = Omit<RequestInit, "body"> & {
  /** JSON-serialisable request body. */
  body?: unknown;
  /** Attach the bearer token (default true). */
  auth?: boolean;
  /** Give up after this long (default DEFAULT_TIMEOUT_MS). */
  timeoutMs?: number;
};

/** Long enough for a slow network, short enough that a hung request doesn't spin forever. */
const DEFAULT_TIMEOUT_MS = 15_000;

/** Status used for failures that never got an HTTP response (offline, DNS, timeout). */
export const NETWORK_ERROR_STATUS = 0;

export function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as ApiError).status === "number" &&
    typeof (err as ApiError).message === "string"
  );
}

// Called when a request made with the learner's token comes back 401 — the
// session is dead (expired, or the account was deleted). AuthProvider
// subscribes so the whole app signs out, not just the stored token.
const unauthorizedListeners = new Set<() => void>();

/** Subscribes to "the session is gone". Returns the unsubscribe function. */
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

/** The backend answers errors as `{ error: "..." }`; fall back to the raw text / status text. */
async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const parsed: unknown = JSON.parse(text);
    const message = (parsed as { error?: unknown } | null)?.error;
    if (typeof message === "string" && message) return message;
  } catch {
    /* not JSON — use the text as-is */
  }
  return text || res.statusText;
}

/**
 * The only place in the app that calls fetch(). Prefixes the API base URL,
 * attaches the auth header, normalises every failure — HTTP errors, network
 * errors, timeouts, unparsable responses — to ApiError, and signs the
 * session out on 401.
 */
export async function apiFetch<T>(path: string, opts: Options = {}): Promise<T> {
  const { body, auth = true, headers, timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = opts;
  const token = auth ? getToken() : null;

  // Our own controller so we can time out, still honouring a caller's signal.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", () => controller.abort(), { once: true });

  const failure = (message: string, status = NETWORK_ERROR_STATUS): ApiError => ({
    status,
    message: controller.signal.aborted ? "The server took too long to respond." : message,
  });

  try {
    let res: Response;
    try {
      res = await fetch(`${env.API_URL}${path}`, {
        ...rest,
        signal: controller.signal,
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      // The caller cancelled on purpose — let them see their own AbortError.
      if (signal?.aborted) throw err;
      throw failure("Couldn't reach the server. Check your connection.");
    }

    // Only a 401 on a request that carried our token means *our* session is
    // dead — e.g. a rejected Google credential on /auth/google is not.
    if (res.status === 401 && token) {
      clearToken();
      unauthorizedListeners.forEach((listener) => listener());
    }

    if (!res.ok) {
      const error: ApiError = { status: res.status, message: await readErrorMessage(res) };
      throw error;
    }

    if (res.status === 204) return undefined as T;
    try {
      return (await res.json()) as T;
    } catch {
      throw failure("The server sent an invalid response.", res.status);
    }
  } finally {
    clearTimeout(timer);
  }
}
