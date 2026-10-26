export type AdminRole = { id: string; name: string };

/** A section or competence a role can be granted visibility of. */
export type Grantable = { id: string; name: string; description: string | null };

/** Everything the admin screen needs: every role, every grantable, and every grant. */
export type VisibilityMatrix = {
  roles: AdminRole[];
  sections: Grantable[];
  competences: Grantable[];
  roleSections: { roleId: string; sectionId: string }[];
  roleCompetences: { roleId: string; competenceId: string }[];
};

export type DropoffType = "initial" | "targeted_reevaluation";

export type DropoffFilters = {
  type: DropoffType;
  /** Empty string = all sections. */
  sectionId: string;
  /** yyyy-mm-dd or empty. */
  from: string;
  to: string;
  inactiveDays: number;
};

export type DropoffQuestion = {
  questionId: string;
  text: string;
  questionType: string;
  section: { id: string; code: string | null; name: string };
  /** 1-based rank by the question's typical position in an attempt. */
  order: number;
  /** Finished or abandoned runs that were shown the question. */
  viewedCount: number;
  /** Of those, how many answered it. */
  answeredCount: number;
  /** Abandoned runs whose last-shown question this was. */
  droppedCount: number;
  /** droppedCount / viewedCount, 0–1. */
  dropOffRate: number;
  lowSample: boolean;
};

/** Aggregates only — no learner is identifiable from this. */
export type DropoffData = {
  summary: { started: number; completed: number; abandoned: number; inProgress: number };
  questions: DropoffQuestion[];
};
