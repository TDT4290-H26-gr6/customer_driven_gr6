import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { PieAnswer } from "./components/PieQuestionPlayer";
import type { Question } from "./types";

/** All questions in the bank, with their competence area and PIE content. */
export function getQuestions(): Promise<Question[]> {
  return apiFetch<Question[]>(endpoints.questions);
}

export type AssessmentProgress = {
  satInstanceId: string;
  responses: { questionId: string; answer: PieAnswer }[];
};

/** The learner's in-progress instance and saved answers, or null if they haven't started. */
export function getProgress(): Promise<AssessmentProgress | null> {
  return apiFetch<AssessmentProgress | undefined>(endpoints.assessment.progress).then(
    (progress) => progress ?? null,
  );
}

/** Saves (or updates) one answer against the learner's active instance. */
export function saveResponse(questionId: string, answer: PieAnswer): Promise<void> {
  return apiFetch<void>(endpoints.assessment.responses, {
    method: "POST",
    body: { questionId, answer },
  });
}

/** Aborts the learner's active instance, deleting every answer saved to it. */
export function discardAssessment(): Promise<void> {
  return apiFetch<void>(endpoints.assessment.active, { method: "DELETE" });
}

/** Marks the learner's active instance complete. */
export function completeAssessment(): Promise<void> {
  return apiFetch<void>(endpoints.assessment.complete, { method: "POST" });
}
