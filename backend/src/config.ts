// The only place that reads process.env. Read once at startup: a setting
// that's missing or malformed stops the process here with a clear message,
// rather than surfacing later as a confusing per-request failure.

const isProduction = process.env.NODE_ENV === "production";

/** A value copied unchanged from .env.example, e.g. `<some-long-random-string>`. */
function isPlaceholder(value: string): boolean {
  return value.includes("<") || value.includes(">");
}

/** A value that must be set in production; in development it falls back, with a warning. */
function required(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value && !isPlaceholder(value)) return value;

  const problem = value ? "still has its .env.example placeholder" : "is not set";
  if (isProduction) throw new Error(`Environment variable ${name} ${problem}`);
  console.warn(`${name} ${problem} — using a development fallback. Never do this in production.`);
  return devFallback;
}

/** A comma-separated list; empty entries dropped. */
function list(name: string): string[] | null {
  const raw = process.env[name];
  if (!raw) return null;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function port(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} must be a port number (1-65535), got "${raw}"`);
  }
  return value;
}

/**
 * Which browser origins may call the API (CORS_ORIGIN, comma-separated).
 * Unset: any origin in development (with a warning); required in production.
 */
function corsOrigins(): string[] | true {
  const origins = list("CORS_ORIGIN");
  if (origins?.length) return origins;
  if (isProduction) throw new Error("Environment variable CORS_ORIGIN is not set");
  console.warn("CORS_ORIGIN is not set — allowing any origin. Never do this in production.");
  return true;
}

/**
 * Who may use admin mode (ADMIN_EMAILS, comma-separated, case-insensitive).
 * Unset: everyone in development — today's demo behaviour, with a warning —
 * and nobody in production (fail closed).
 */
function adminEmails(): string[] | "everyone" {
  const emails = list("ADMIN_EMAILS");
  if (emails?.length) return emails.map((email) => email.toLowerCase());
  if (isProduction) return [];
  console.warn("ADMIN_EMAILS is not set — every signed-in learner can use admin mode.");
  return "everyone";
}

/**
 * The NTNU IDUN LLM (OpenAI-compatible API) behind the AI advice on the
 * results page. Optional: with no LLM_API_KEY the feature is simply off, so
 * local development and CI don't need a key. Only reachable from NTNU's
 * network or VPN.
 */
function llm() {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey || isPlaceholder(apiKey)) {
    console.warn("LLM_API_KEY is not set — AI advice on the results page is turned off.");
    return null;
  }
  return {
    apiKey,
    baseUrl: (process.env.LLM_BASE_URL || "https://llm.hpc.ntnu.no/v1").replace(/\/+$/, ""),
    model: process.env.LLM_MODEL || "openai/gpt-oss-120b",
  };
}

/**
 * Which content the backend loads into the database: "fake" (the
 * food-themed test data, the default for now) or "wp2" (the real AIOS WP2
 * curriculum — sections A–E, its competences, modules, learning journeys and
 * the self-assessment items delivered so far). The two never share a
 * database; see seed/index.ts.
 */
function seedDataset(): "fake" | "wp2" {
  const value = process.env.SEED_DATASET?.trim().toLowerCase();
  if (!value || value === "fake") return "fake";
  if (value === "wp2") return "wp2";
  throw new Error(`SEED_DATASET must be "fake" or "wp2", got "${process.env.SEED_DATASET}"`);
}

/**
 * The Moodle site the learning material lives on ("soft" integration: AIOS
 * only links to it). Seed data names each module's Moodle course by id, and
 * links are built from this base — a placeholder until the real site and
 * course ids are known.
 */
function moodleBaseUrl(): string {
  return (process.env.MOODLE_BASE_URL || "https://moodle.example.org").replace(/\/+$/, "");
}

export const config = {
  /**
   * TEMPORARILY OFF. When on, a learner picks a persona role after first
   * signing in (the frontend's RoleGateModal), role-gated routes refuse
   * learners without one (requireRole), and retakes only ask the questions
   * the role has been granted. While off, nobody needs a role and every SAT
   * covers the whole question bank. Set back to true — together with
   * ROLE_SELECTION_ENABLED in frontend/src/shared/lib/features.ts — to
   * bring roles back.
   */
  roleSelectionEnabled: false,
  port: port("BACKEND_PORT", 4000),
  jwtSecret: required("JWT_SECRET", "dev-secret-change-me"),
  googleClientId: required("GOOGLE_CLIENT_ID", ""),
  corsOrigins: corsOrigins(),
  adminEmails: adminEmails(),
  llm: llm(),
  seedDataset: seedDataset(),
  moodleBaseUrl: moodleBaseUrl(),
};
