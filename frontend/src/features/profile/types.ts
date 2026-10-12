/** Dropdown options. Keys must match INDUSTRIES / ACADEMIC_DEGREES in the backend's identity.types.ts. */
export const INDUSTRY_OPTIONS = [
  { value: "higher_education", label: "Higher education" },
  { value: "industry_business", label: "Industry/business" },
  { value: "government", label: "Government" },
] as const;

export const ACADEMIC_DEGREE_OPTIONS = [
  { value: "bachelor", label: "Bachelor's" },
  { value: "master", label: "Master's" },
  { value: "phd", label: "PhD" },
  { value: "other", label: "Other" },
] as const;

export type Industry = (typeof INDUSTRY_OPTIONS)[number]["value"];
export type AcademicDegree = (typeof ACADEMIC_DEGREE_OPTIONS)[number]["value"];

/** As saved. Fields can be null on a profile saved before they were required. */
export type LearnerProfile = {
  industry: Industry | null;
  academicDegree: AcademicDegree | null;
  background: string | null;
  /** In AI or Open Science. */
  yearsOfExperience: number | null;
  goals: string | null;
};

/** The profile form: every field but goals is required. The name is saved onto the learner. */
export type LearnerProfileInput = {
  name: string;
  industry: Industry;
  academicDegree: AcademicDegree;
  background: string;
  yearsOfExperience: number;
  /** Optional — null when left blank. */
  goals: string | null;
};
