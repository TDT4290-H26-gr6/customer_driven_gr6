import type { NativeElementContent, PieContent } from "@/features/assessment";

// Mirrors backend/src/modules/curriculum (and AuthoredContent in
// backend/src/modules/assessment/assessment.pie.ts).

export type QuestionType =
  "likert" | "single_choice" | "multi_choice" | "true_false" | "criteria_check" | "ordering";

export type Option = { id: string; text: string };

/** A question as authored: what the editor edits, before it's built into a PIE item. */
export type AuthoredContent = {
  scale?: { min: number; max: number; minLabel?: string; maxLabel?: string; labels?: string[] };
  options?: Option[];
  correctOptionIds?: string[];
  exhibit?: string;
  correctOrder?: string[];
};

export type CurriculumModule = {
  id: string;
  name: string;
  level: number | null;
  mainCompetenceId: string;
};

export type CurriculumSection = {
  id: string;
  code: string | null;
  name: string;
  modules: CurriculumModule[];
};

export type CurriculumCompetence = {
  id: string;
  name: string;
  description: string | null;
  questionCount: number;
  moduleCount: number;
};

export type QuestionSummary = {
  id: string;
  prompt: string;
  questionType: QuestionType;
  sectionModuleId: string;
  competenceId: string;
  /** ISO date when retired; null while in use. */
  retiredAt: string | null;
  answerCount: number;
  /** False for a question loaded before the editor existed, until db-init fills in its authored form. */
  editable: boolean;
};

export type QuestionDetail = QuestionSummary & { authoredContent: AuthoredContent | null };

export type Curriculum = {
  sections: CurriculumSection[];
  competences: CurriculumCompetence[];
  questions: QuestionSummary[];
};

export type QuestionInput = {
  questionType: QuestionType;
  prompt: string;
  sectionModuleId: string;
  competenceId: string;
  content: AuthoredContent;
};

export type CompetenceInput = { name: string; description: string | null };

/** A built question, as the player renders it. */
export type PreviewContent = PieContent | NativeElementContent;
