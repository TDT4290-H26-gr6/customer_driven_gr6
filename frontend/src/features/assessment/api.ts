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
  /** The journey being assessed, when the in-progress assessment is a journey assessment. */
  journey: { id: string | null; name: string | null } | null;
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

/** Starts a reassessment limited to the given sections. */
export function startReassessment(sectionIds: string[]): Promise<void> {
  return apiFetch<void>(endpoints.assessment.start, {
    method: "POST",
    body: { sectionIds },
  });
}

/**
 * Saves (or updates) one answer against the learner's active instance.
 * `timeSpentMs` (CD-97) is how long the question was on screen before this
 * save, from the frontend's own clock — best-effort analytics, never used
 * for scoring; the backend drops it silently if it looks implausible.
 */
export function saveResponse(
  questionId: string,
  answer: PieAnswer,
  timeSpentMs?: number,
): Promise<void> {
  return apiFetch<void>(endpoints.assessment.responses, {
    method: "POST",
    body: { questionId, answer, timeSpentMs },
  });
}

/**
 * Records that a question was shown to the learner (CD-125), so the admin
 * drop-off view can tell "stopped at" from "answered last". Best-effort
 * analytics; the first view per question and attempt is the only one kept.
 */
export function recordQuestionView(questionId: string): Promise<void> {
  return apiFetch<void>(endpoints.assessment.views, { method: "POST", body: { questionId } });
}

/** Aborts the learner's active instance, deleting every answer saved to it. */
export function discardAssessment(): Promise<void> {
  return apiFetch<void>(endpoints.assessment.active, { method: "DELETE" });
}

/** Marks the learner's active instance complete. */
export function completeAssessment(): Promise<void> {
  return apiFetch<void>(endpoints.assessment.complete, { method: "POST" });
}
