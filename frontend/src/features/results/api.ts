import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { SectionCompetenceScores } from "./types";

/**
 * The latest SAT's competence scores broken down per section. Sections the
 * learner wasn't assessed in at all are omitted.
 */
export function getSectionCompetenceScores(): Promise<SectionCompetenceScores[]> {
  return apiFetch<SectionCompetenceScores[]>(endpoints.competenceScoresBySection);
}
