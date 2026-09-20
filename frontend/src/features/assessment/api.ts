import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { Question, SatInstance } from "./types";

/** All questions in the bank, with their competence area and PIE content. */
export function getQuestions(): Promise<Question[]> {
  return apiFetch<Question[]>(endpoints.questions);
}

/** Resumes the learner's in-progress SAT instance, or opens a new one. */
export function startSatInstance(): Promise<SatInstance> {
  return apiFetch<SatInstance>(endpoints.satInstances, { method: "POST" });
}

/** Scores and saves one answer; safe to call again for the same question to replace it. */
export function submitResponse(satInstanceId: string, questionId: string, answer: unknown) {
  return apiFetch(endpoints.responses, {
    method: "POST",
    body: { satInstanceId, questionId, answer },
  });
}

/** Finalizes a SAT instance and rolls its responses up into per-area competence scores. */
export function completeSatInstance(satInstanceId: string) {
  return apiFetch(endpoints.satInstanceComplete(satInstanceId), { method: "PUT" });
}
