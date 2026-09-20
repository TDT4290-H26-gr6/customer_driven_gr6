// Single source of truth for backend paths. Rename here if the API changes.
export const endpoints = {
  auth: {
    google: "/auth/google",
    me: "/auth/me",
    myRole: "/auth/me/role",
    myInitialAssessment: "/auth/me/initial-assessment",
  },
  roles: "/roles",
  questions: "/questions",
  satInstances: "/sat-instances",
  satInstanceComplete: (id: string) => `/sat-instances/${id}/complete`,
  responses: "/responses",
  competenceScores: "/competence-scores",
  courses: "/courses",
} as const;
