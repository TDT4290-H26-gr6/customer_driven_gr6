import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { CompetenceScore } from "./types";

/**
 * The learner's latest competence scores, one per assessed skill area.
 * Not implemented on the backend yet (see context/backend-structure.md) —
 * callers should fall back to placeholder data until it lands.
 */
export function getCompetenceScores(): Promise<CompetenceScore[]> {
  return apiFetch<CompetenceScore[]>(endpoints.competenceScores);
}
