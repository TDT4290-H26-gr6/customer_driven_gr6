// Single source of truth for backend paths. Rename here if the API changes.
export const endpoints = {
  auth: {
    google: "/auth/google",
    me: "/auth/me",
    myRole: "/auth/me/role",
    myPrivacyNotice: "/auth/me/privacy-notice",
    myInitialAssessment: "/auth/me/initial-assessment",
    myProfile: "/auth/me/profile",
  },
  roles: "/roles",
  competenceScoresBySection: "/competence-scores/by-section",
  competenceScoresProgress: "/competence-scores/progress",
  learningJourneys: "/learning-journeys",
  learningJourneyRecommendations: "/learning-journeys/recommendations",
  learningJourneyWeakCompetences: "/learning-journeys/weak-competences",
  feedback: "/feedback",
  advice: "/advice",
  competencies: "/competencies",
  assessment: {
    progress: "/assessment/progress",
    path: "/assessment/path",
    responses: "/assessment/responses",
    views: "/assessment/views",
    complete: "/assessment/complete",
    active: "/assessment/active",
    sections: "/assessment/sections",
    start: "/assessment/start",
    journey: "/assessment/journey",
    history: "/assessment/history",
  },
  admin: {
    visibility: "/admin/visibility",
    feedback: "/admin/feedback",
    dropoff: "/admin/sat/dropoff",
    statsTests: "/admin/stats/tests.csv",
    statsQuestions: "/admin/stats/questions.csv",
    roleSection: (roleId: string, sectionId: string) =>
      `/admin/roles/${encodeURIComponent(roleId)}/sections/${encodeURIComponent(sectionId)}`,
    roleCompetence: (roleId: string, competenceId: string) =>
      `/admin/roles/${encodeURIComponent(roleId)}/competences/${encodeURIComponent(competenceId)}`,
  },
} as const;
