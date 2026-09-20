import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { CompetenceScore } from "./types";

/**
 * The learner's competence scores from their most recently completed SAT,
 * one per competence area (maxScore 0 if nothing in that area was scored).
 * Empty until they've completed a SAT.
 */
export function getCompetenceScores(): Promise<CompetenceScore[]> {
  return apiFetch<CompetenceScore[]>(endpoints.competenceScores);
}
