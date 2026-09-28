export type Source = {
  id: string;
  institution: string;
  country: string;
  courseName: string;
  type: string;
  level: string | null;
  degreeProgramme: string | null;
  /** A decimal, so it arrives as a string (e.g. "7.50"). */
  credits: string | null;
  language: string | null;
  instructor: string | null;
  format: string | null;
  /** Comma-separated topic list. */
  topics: string | null;
  prerequisites: string | null;
  description: string | null;
  sourceUrl: string;
  /** 0..1 — how sure we are the source is real and current. */
  confidence: number | null;
};
