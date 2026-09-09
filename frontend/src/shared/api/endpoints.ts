// Single source of truth for backend paths. Rename here if the API changes.
export const endpoints = {
  auth: {
    google: "/auth/google",
    me: "/auth/me",
    myRole: "/auth/me/role",
  },
  roles: "/roles",
  questions: "/questions",
} as const;
