import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { LearningJourney } from "./types";

/**
 * The one journey recommended for the learner, or null if there isn't one
 * yet (no completed SAT instance / scores yet — the backend returns 204).
 */
export function getRecommendedJourney(): Promise<LearningJourney | null> {
  return apiFetch<LearningJourney | undefined>(endpoints.learningJourneyRecommendation).then(
    (journey) => journey ?? null,
  );
}
