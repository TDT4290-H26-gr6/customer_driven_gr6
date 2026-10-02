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
};
