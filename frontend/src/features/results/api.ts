import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { SectionCompetenceScores, SkillLevel } from "./types";

/**
 * The latest SAT's competence scores broken down per section. Sections the
 * learner wasn't assessed in at all are omitted.
 */
export function getSectionCompetenceScores(): Promise<SectionCompetenceScores[]> {
  return apiFetch<SectionCompetenceScores[]>(endpoints.competenceScoresBySection);
}

/** The learner's level in every section they've been assessed in, sorted by section code. */
export function getSkillLevels(): Promise<SkillLevel[]> {
  return apiFetch<SkillLevel[]>(endpoints.skillLevels);
}
