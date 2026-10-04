import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { LearningJourney } from "./types";

/** Every learning journey, each with its own module list and the sections it covers. */
export function listJourneys(): Promise<LearningJourney[]> {
  return apiFetch<LearningJourney[]>(endpoints.learningJourneys);
}

/**
 * The one journey recommended for the learner, or null if there isn't one
 * yet (no completed SAT instance, or no competence scored 50% or below —
 * the backend returns 204 either way).
 */
export function getRecommendedJourney(): Promise<LearningJourney | null> {
  return apiFetch<LearningJourney | undefined>(endpoints.learningJourneyRecommendation).then(
    (journey) => journey ?? null,
  );
}

/** The journey the learner has explicitly chosen (CD-33), or null if they haven't picked one. */
export function getSelectedJourney(): Promise<LearningJourney | null> {
  return apiFetch<LearningJourney | undefined>(endpoints.learningJourneySelected).then(
    (journey) => journey ?? null,
  );
}

/** Picks a journey to follow. Sticks until the learner selects a different one. */
export function selectJourney(id: string): Promise<LearningJourney> {
  return apiFetch<LearningJourney>(endpoints.learningJourneySelect(id), { method: "PUT" });
}

export type CurrentJourney = { journey: LearningJourney; source: "selected" | "recommended" };

/**
 * What the results page shows as "your journey": whichever the learner
 * explicitly selected, if any — that choice always wins over the score-based
 * recommendation — otherwise the recommendation, otherwise null (nothing to
 * show yet).
 */
export async function getCurrentJourney(): Promise<CurrentJourney | null> {
  const selected = await getSelectedJourney();
  if (selected) return { journey: selected, source: "selected" };

  const recommended = await getRecommendedJourney();
  return recommended ? { journey: recommended, source: "recommended" } : null;
}
