import { isApiError, NETWORK_ERROR_STATUS } from "./client";

/**
 * Worth trying again: no response at all (offline, timeout) or a server
 * error. A 4xx is the request itself being wrong and will fail the same way.
 */
export function isTransientError(err: unknown): boolean {
  return isApiError(err) && (err.status === NETWORK_ERROR_STATUS || err.status >= 500);
}

type RetryOptions = {
  /** Total tries, including the first (default 3). */
  attempts?: number;
  /** Wait before the first retry; doubles each time (default 500 ms). */
  delayMs?: number;
};

/** Runs `fn`, retrying transient failures with exponential backoff. Rethrows the last error. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, delayMs = 500 }: RetryOptions = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= attempts || !isTransientError(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs * 2 ** (attempt - 1)));
    }
  }
}
