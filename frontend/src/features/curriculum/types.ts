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
  description: string | null;
  level: number | null;
  mainCompetenceId: string;
  secondaryCompetenceIds: string[];
  moodleUrl: string | null;
  /** ISO date when retired; null while in use. */
  retiredAt: string | null;
  questionCount: number;
};

export type CurriculumSection = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  retiredAt: string | null;
  /** Learning journeys covering it. */
  journeyCount: number;
  /** Whether a reassessment has been limited to it. */
  usedInAssessments: boolean;
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

export type CoverageLevel = "M" | "R" | "S";

export type JourneyStep = {
  id: string;
  title: string;
  description: string | null;
  sourceId: string | null;
};

export type CurriculumJourney = {
  id: string;
  name: string;
  description: string | null;
  moodleUrl: string | null;
  retiredAt: string | null;
  sections: { sectionId: string; coverageLevel: CoverageLevel }[];
  steps: JourneyStep[];
  /** Recommended, picked by the AI, assessed or completed: removing it retires it. */
  used: boolean;
};

export type CurriculumSource = { id: string; courseName: string; institution: string };

export type Curriculum = {
  sections: CurriculumSection[];
  competences: CurriculumCompetence[];
  questions: QuestionSummary[];
  journeys: CurriculumJourney[];
  sources: CurriculumSource[];
};

export type QuestionInput = {
  questionType: QuestionType;
  prompt: string;
  sectionModuleId: string;
  competenceId: string;
  content: AuthoredContent;
};

export type CompetenceInput = { name: string; description: string | null };

export type SectionInput = { code: string | null; name: string; description: string | null };

export type JourneyInput = {
  name: string;
  description: string | null;
  moodleUrl: string | null;
  sections: { sectionId: string; coverageLevel: CoverageLevel }[];
  /** A step with an id is an existing one, kept and updated; null for a new one. */
  steps: {
    id: string | null;
    title: string;
    description: string | null;
    sourceId: string | null;
  }[];
};

export type ModuleInput = {
  name: string;
  description: string | null;
  sectionId: string;
  level: number | null;
  mainCompetenceId: string;
  secondaryCompetenceIds: string[];
  moodleUrl: string | null;
};

/** A built question, as the player renders it. */
export type PreviewContent = PieContent | NativeElementContent;
