import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { PieAnswer } from "./components/PieQuestionPlayer";
import type { AssessmentPath } from "./types";

/** The learner's route through their current attempt, ending with the next question (if any). */
export function getAssessmentPath(): Promise<AssessmentPath> {
  return apiFetch<AssessmentPath>(endpoints.assessment.path);
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

export type AssessableSection = { id: string; name: string; description: string | null };

/** The sections a reassessment can be limited to. */
export function getAssessableSections(): Promise<AssessableSection[]> {
  return apiFetch<AssessableSection[]>(endpoints.assessment.sections);
}

/** Starts a reassessment after a completed journey, limited to the given sections. */
export function startReassessment(completedJourneyId: string, sectionIds: string[]): Promise<void> {
  return apiFetch<void>(endpoints.assessment.start, {
    method: "POST",
    body: { completedJourneyId, sectionIds },
  });
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
