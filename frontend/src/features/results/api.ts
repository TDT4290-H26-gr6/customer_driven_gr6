import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { CompetenceScore, SectionCompetenceScores } from "./types";

/**
 * The learner's competence scores from their most recently completed SAT,
 * one per competence (maxScore 0 if nothing in that competence was scored).
 * Empty until they've completed a SAT.
 */
export function getCompetenceScores(): Promise<CompetenceScore[]> {
  return apiFetch<CompetenceScore[]>(endpoints.competenceScores);
}

/**
 * The latest SAT's competence scores broken down per section. Sections the
 * learner wasn't assessed in at all are omitted.
 */
export function getSectionCompetenceScores(): Promise<SectionCompetenceScores[]> {
  return apiFetch<SectionCompetenceScores[]>(endpoints.competenceScoresBySection);
}
