import type { PieAnswer } from "./components/PieQuestionPlayer";

export type PieContent = {
  elements: Record<string, string>;
  models: unknown[];
  markup: string;
};

export type Question = {
  id: string;
  prompt: string;
  questionType: string;
  competence: { id: string; name: string };
  content: PieContent;
};

/** One question on the learner's adaptive route through the assessment. */
export type PathItem = {
  question: Question;
  /** The saved answer, or null for the next (unanswered) question. */
  answer: PieAnswer | null;
  section: { code: string | null; name: string };
  /** 1-based position of the section in this attempt's random order. */
  sectionNumber: number;
  /** 1 (easiest) to 4 (most advanced) within the section. */
  level: number | null;
};

/**
 * The route so far: the answered questions on it, then the next one to ask
 * (the backend decides it from the answers — see assessment.path.ts).
 * `done` means nothing is left; the assessment can be completed.
 */
export type AssessmentPath = {
  items: PathItem[];
  sectionCount: number;
  done: boolean;
  /**
   * Set while assessing one learning journey on its own (only its core
   * sections; the result never counts towards the main self-assessment).
   * Null for the main self-assessment.
   */
  journey: { id: string | null; name: string | null } | null;
  /**
   * A reassessment of chosen sections only, started from the dashboard's
   * "Retake assessment" (not the full self-assessment, and not a journey
   * assessment either). Every question of those sections is asked
   * regardless of score, see assessment.path.ts's `exhaustive` mode.
   */
  partial: boolean;
};
