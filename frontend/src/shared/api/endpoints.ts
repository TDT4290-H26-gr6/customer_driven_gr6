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
  competenceScores: "/competence-scores",
  sources: "/sources",
  learningJourneys: "/learning-journeys",
  learningJourneyRecommendation: "/learning-journeys/recommendation",
  assessment: {
    progress: "/assessment/progress",
    responses: "/assessment/responses",
    complete: "/assessment/complete",
  },
  admin: {
    visibility: "/admin/visibility",
    roleSection: (roleId: string, sectionId: string) =>
      `/admin/roles/${encodeURIComponent(roleId)}/sections/${encodeURIComponent(sectionId)}`,
    roleCompetence: (roleId: string, competenceId: string) =>
      `/admin/roles/${encodeURIComponent(roleId)}/competences/${encodeURIComponent(competenceId)}`,
  },
} as const;
