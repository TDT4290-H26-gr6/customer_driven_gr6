import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { AttemptScores, DashboardProgress } from "./types";

/**
 * One completed SAT's results per section — the latest, or the one with the
 * given instanceNum — or null before any completed SAT (the backend
 * returns 204).
 */
export function getSectionCompetenceScores(instanceNum?: number): Promise<AttemptScores | null> {
  const query = instanceNum === undefined ? "" : `?instance=${instanceNum}`;
  return apiFetch<AttemptScores | undefined>(`${endpoints.competenceScoresBySection}${query}`).then(
    (scores) => scores ?? null,
  );
}

/**
 * Each section as of the latest completed SAT and the one before it, for
 * the dashboard — or null before any completed SAT (204).
 */
export function getDashboardProgress(): Promise<DashboardProgress | null> {
  return apiFetch<DashboardProgress | undefined>(endpoints.competenceScoresProgress).then(
    (progress) => progress ?? null,
  );
}
