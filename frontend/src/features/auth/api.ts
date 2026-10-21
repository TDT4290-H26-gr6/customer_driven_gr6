import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import { setToken } from "./session";
import type { Learner, LoginResult } from "./types";

/**
 * Exchange a Google credential for a session; stores the token on success.
 * `acceptedPrivacyNotice` is the login page's information-letter checkbox,
 * which the backend requires.
 */
export async function googleLogin(
  credential: string,
  acceptedPrivacyNotice: boolean,
): Promise<LoginResult> {
  const result = await apiFetch<LoginResult>(endpoints.auth.google, {
    method: "POST",
    auth: false,
    body: { credential, acceptedPrivacyNotice },
  });
  setToken(result.token);
  return result;
}

/** Current signed-in learner (includes the chosen role, or null). */
export function getMe(): Promise<Learner> {
  return apiFetch<Learner>(endpoints.auth.me);
}

/** Marks the signed-in learner as having finished every question in the initial assessment. */
export function completeInitialAssessment(): Promise<Learner> {
  return apiFetch<Learner>(endpoints.auth.myInitialAssessment, { method: "PUT" });
}

/** Permanently deletes the signed-in learner's account and all their data (CD-60, GDPR). */
export function deleteAccount(): Promise<void> {
  return apiFetch<void>(endpoints.auth.me, { method: "DELETE" });
}
