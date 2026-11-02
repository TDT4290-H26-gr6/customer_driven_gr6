import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { JourneyHistoryEntry, LearningJourney, WeakCompetence } from "./types";

/** Every learning journey, each with its own module list and the sections it covers. */
export function listJourneys(): Promise<LearningJourney[]> {
  return apiFetch<LearningJourney[]>(endpoints.learningJourneys);
}

/**
 * "recommended": for competences at or below 60%. "suggested": nothing is
 * that low, so they're journeys to keep improving with.
 */
export type JourneySource = "recommended" | "suggested";

/** Up to two journeys, best first. */
export type RecommendedJourneys = { source: JourneySource; journeys: LearningJourney[] };

/**
 * The dashboard's two journeys by score alone, best first, shown until the
 * AI advisor's ranking (which also weighs the learner's profile) has loaded,
 * and instead of it when the advisor is off or fails. Null when there's
 * nothing to recommend (no completed assessment, or a perfect score).
 */
export function getRecommendedJourneys(): Promise<RecommendedJourneys | null> {
  return apiFetch<RecommendedJourneys | undefined>(endpoints.learningJourneyRecommendations).then(
    (result) => result ?? null,
  );
}

/**
 * Every competence at or below the 60% threshold (CD-90), weakest first,
 * each paired with the journey that addresses it, not just the two the
 * dashboard recommends. Empty when every competence is sufficient.
 */
export function getWeakCompetences(): Promise<WeakCompetence[]> {
  return apiFetch<WeakCompetence[]>(endpoints.learningJourneyWeakCompetences);
}

/**
 * Starts assessing one learning journey on its own: only the questions in
 * the sections it's centred on, and the result never counts towards the main
 * self-assessment (it shows under Competencies and the Journeys page's
 * History tab). Rejects with 409 while another assessment is in progress.
 */
export function startJourneyAssessment(journeyId: string): Promise<void> {
  return apiFetch<void>(endpoints.assessment.journey, { method: "POST", body: { journeyId } });
}

/** Every journey assessment the learner has completed on its own, oldest first. */
export function getJourneyHistory(): Promise<JourneyHistoryEntry[]> {
  return apiFetch<JourneyHistoryEntry[]>(endpoints.assessment.journeyHistory);
}
