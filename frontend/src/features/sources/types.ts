export type Course = {
  id: string;
  institution: string;
  country: string;
  name: string;
  type: string;
  level: string | null;
  degreeProgramme: string | null;
  credits: string | null;
  language: string | null;
  instructor: string | null;
  format: string | null;
  /** Comma-separated topic list. */
  topics: string | null;
  prerequisites: string | null;
  description: string | null;
  sourceUrl: string;
  confidence: string | null;
};
