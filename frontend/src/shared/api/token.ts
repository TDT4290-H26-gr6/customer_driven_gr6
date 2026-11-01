// Raw session-token storage. Lives in shared/ so shared/api/client.ts can use it
// without importing a feature. features/auth/session.ts re-exports these.
const KEY = "aios_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* storage unavailable, session just won't persist */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
