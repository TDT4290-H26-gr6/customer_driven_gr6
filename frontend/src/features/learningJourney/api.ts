import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { LearningJourney, WeakCompetence } from "./types";

/** Every learning journey, each with its own module list and the sections it covers. */
export function listJourneys(): Promise<LearningJourney[]> {
  return apiFetch<LearningJourney[]>(endpoints.learningJourneys);
}

/**
 * The one journey recommended for the learner, or null if there isn't one
 * yet (no completed SAT instance, or no competence scored 60% or below —
 * the backend returns 204 either way).
 */
export function getRecommendedJourney(): Promise<LearningJourney | null> {
  return apiFetch<LearningJourney | undefined>(endpoints.learningJourneyRecommendation).then(
    (journey) => journey ?? null,
  );
}

/**
 * A journey to keep improving with, for a learner with nothing at or below
 * 60% — so there's always one to offer unless the score is perfect. Null
 * when there's none to suggest (the backend returns 204).
 */
export function getSuggestedJourney(): Promise<LearningJourney | null> {
  return apiFetch<LearningJourney | undefined>(endpoints.learningJourneySuggestion).then(
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

/**
 * "selected": the learner chose it (CD-33). "recommended": for a competence
 * at or below 60%. "suggested": nothing is that low, so it's a journey to
 * keep improving with.
 */
export type JourneySource = "selected" | "recommended" | "suggested";

export type CurrentJourney = { journey: LearningJourney; source: JourneySource };

/**
 * What the results page shows as "your journey": whichever the learner
 * explicitly selected, if any — that choice always wins — otherwise the
 * score-based recommendation, otherwise a suggestion to keep improving
 * with. Null only when there's nothing to offer (no completed assessment,
 * or a perfect score).
 */
export async function getCurrentJourney(): Promise<CurrentJourney | null> {
  const selected = await getSelectedJourney();
  if (selected) return { journey: selected, source: "selected" };

  const recommended = await getRecommendedJourney();
  if (recommended) return { journey: recommended, source: "recommended" };

  const suggested = await getSuggestedJourney();
  return suggested ? { journey: suggested, source: "suggested" } : null;
}

/**
 * Every competence at or below the 60% threshold (CD-90), weakest first,
 * each paired with the journey that addresses it — not just the single pick
 * getCurrentJourney returns. Empty when every competence is sufficient.
 */
export function getWeakCompetences(): Promise<WeakCompetence[]> {
  return apiFetch<WeakCompetence[]>(endpoints.learningJourneyWeakCompetences);
}
