/**
 * The API when VITE_API_URL isn't set: the local backend. Read by env.ts,
 * and by vite.config.ts for the Content-Security-Policy, so it lives here,
 * away from import.meta.env (which the build config doesn't have). The
 * production Docker image refuses to build without VITE_API_URL (see the
 * Dockerfile).
 */
export const DEFAULT_API_URL = "http://localhost:4000";
