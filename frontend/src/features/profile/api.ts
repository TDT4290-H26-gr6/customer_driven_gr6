import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { Learner } from "@/features/auth";
import type { LearnerProfile, LearnerProfileInput } from "./types";

/** The learner's saved profile, or null if never saved. */
export function getProfile(): Promise<LearnerProfile | null> {
  return apiFetch<LearnerProfile | null>(endpoints.auth.myProfile);
}

/** Saves the profile (and name). Returns the updated learner, with its new hasCompletedProfile. */
export function saveProfile(input: LearnerProfileInput): Promise<Learner> {
  return apiFetch<Learner>(endpoints.auth.myProfile, { method: "PUT", body: input });
}
