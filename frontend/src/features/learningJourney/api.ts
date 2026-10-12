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

/**
 * "recommended": for a competence at or below 60%. "suggested": nothing is
 * that low, so it's a journey to keep improving with.
 */
export type JourneySource = "recommended" | "suggested";

export type CurrentJourney = { journey: LearningJourney; source: JourneySource };

/**
 * What the results page shows as "your journey": the score-based
 * recommendation, otherwise a suggestion to keep improving with. Null only
 * when there's nothing to offer (no completed assessment, or a perfect
 * score). The dashboard shows the AI advisor's role-aware pick instead,
 * once the advice has loaded.
 */
export async function getCurrentJourney(): Promise<CurrentJourney | null> {
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

/**
 * Starts assessing one learning journey on its own: only the questions in
 * the sections it's centred on, and the result never counts towards the main
 * self-assessment (it shows under Competencies). Rejects with 409 while
 * another assessment is in progress.
 */
export function startJourneyAssessment(journeyId: string): Promise<void> {
  return apiFetch<void>(endpoints.assessment.journey, { method: "POST", body: { journeyId } });
}
