import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { LearnerProfile, LearnerProfileInput } from "./types";

/** The learner's stated goals/background/experience, or null if never saved. */
export function getProfile(): Promise<LearnerProfile | null> {
  return apiFetch<LearnerProfile | null>(endpoints.auth.myProfile);
}

export function saveProfile(input: LearnerProfileInput): Promise<LearnerProfile> {
  return apiFetch<LearnerProfile>(endpoints.auth.myProfile, { method: "PUT", body: input });
}
