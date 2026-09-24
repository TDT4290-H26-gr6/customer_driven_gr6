// Single source of truth for backend paths. Rename here if the API changes.
export const endpoints = {
  auth: {
    google: "/auth/google",
    me: "/auth/me",
    myRole: "/auth/me/role",
    myInitialAssessment: "/auth/me/initial-assessment",
    myProfile: "/auth/me/profile",
  },
  roles: "/roles",
  questions: "/questions",
  competenceScores: "/competence-scores",
  courses: "/courses",
  learningJourneys: "/learning-journeys",
  learningJourneyRecommendation: "/learning-journeys/recommendation",
  assessment: {
    progress: "/assessment/progress",
    responses: "/assessment/responses",
    complete: "/assessment/complete",
    history: "/assessment/history",
  },
} as const;
