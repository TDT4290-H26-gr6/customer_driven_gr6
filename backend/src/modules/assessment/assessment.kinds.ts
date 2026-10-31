// The two kinds of SAT instance (SatInstance.kind). Every query for the
// learner's main results, dashboard, History, progress, AI advice,
// recommendations, weak competences, filters on MAIN_KIND, so a journey
// assessment never overrides or compares with the main self-assessment.
// Only the Competencies overview reads both.

/** The self-assessment: the initial one and its retakes. */
export const MAIN_KIND = "main";

/** One learning journey's sections, assessed on their own (startJourneyAssessment). */
export const JOURNEY_KIND = "journey";

export type AssessmentKind = typeof MAIN_KIND | typeof JOURNEY_KIND;
