import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { Competencies } from "./types";

/**
 * Each module's best result over all the learner's assessments (the
 * self-assessment and journey assessments alike), a percentage per section,
 * and the recommended journey's sections first.
 */
export function getCompetencies(): Promise<Competencies> {
  return apiFetch<Competencies>(endpoints.competencies);
}
