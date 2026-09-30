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
  competenceScoresBySection: "/competence-scores/by-section",
  sources: "/sources",
  learningJourneys: "/learning-journeys",
  learningJourneyRecommendation: "/learning-journeys/recommendation",
  feedback: "/feedback",
  advice: "/advice",
  assessment: {
    progress: "/assessment/progress",
    responses: "/assessment/responses",
    complete: "/assessment/complete",
    history: "/assessment/history",
  },
  admin: {
    visibility: "/admin/visibility",
    feedback: "/admin/feedback",
    roleSection: (roleId: string, sectionId: string) =>
      `/admin/roles/${encodeURIComponent(roleId)}/sections/${encodeURIComponent(sectionId)}`,
    roleCompetence: (roleId: string, competenceId: string) =>
      `/admin/roles/${encodeURIComponent(roleId)}/competences/${encodeURIComponent(competenceId)}`,
  },
} as const;
