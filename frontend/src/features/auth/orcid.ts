import { env } from "@/config/env";

const STATE_KEY = "orcid-oauth-state";

/** Where ORCID sends the learner back to; must match a redirect URI registered with ORCID. */
export const ORCID_CALLBACK_PATH = "/auth/orcid/callback";

/** The ORCID sign-in is only offered when the frontend knows the client id. */
export const orcidEnabled = Boolean(env.ORCID_CLIENT_ID);

/**
 * Where to send the browser to sign in with ORCID. Remembers a random `state`
 * for this tab, which the callback must see echoed back (CSRF protection).
 */
export function startOrcidUrl(): string {
  const state = crypto.randomUUID();
  try {
    sessionStorage.setItem(STATE_KEY, state);
  } catch {
    // Blocked storage: the callback will then refuse the sign-in.
  }
  const params = new URLSearchParams({
    client_id: env.ORCID_CLIENT_ID,
    response_type: "code",
    scope: "/authenticate",
    redirect_uri: env.ORCID_REDIRECT_URI || `${window.location.origin}${ORCID_CALLBACK_PATH}`,
    state,
  });
  return `https://orcid.org/oauth/authorize?${params}`;
}

/** True once, and only if `state` is the one this tab handed to ORCID. */
export function consumeOrcidState(state: string | null): boolean {
  try {
    const expected = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    return Boolean(state) && state === expected;
  } catch {
    return false;
  }
}
