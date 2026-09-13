// The only place that reads process.env.
export const config = {
  port: process.env.BACKEND_PORT ? Number(process.env.BACKEND_PORT) : 4000,
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
};
