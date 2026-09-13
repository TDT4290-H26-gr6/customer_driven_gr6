// Auth-facing entry point for the session token. The primitive lives in
// shared/ (see shared/api/token.ts) so the api client can use it too.
export { getToken, setToken, clearToken } from "@/shared/api/token";
