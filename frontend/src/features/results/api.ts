import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { AttemptScores } from "./types";

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
