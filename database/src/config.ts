// The only place this package reads process.env (DATABASE_URL is read by
// Prisma itself). Read once at startup: a setting that's malformed stops the
// process here with a clear message.

/**
 * Which content goes into the database: "fake" (the food-themed test data,
 * the default for now) or "wp2" (the real AIOS WP2 curriculum: sections A–E,
 * its competences, modules, learning journeys and the self-assessment items
 * delivered so far). The two never share a database; see seed/index.ts.
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
 * links are built from this base, a placeholder until the real site and
 * course ids are known.
 *
 * The links are stored and shown to learners, so the base must be a real web
 * address: https, or http only for a local test server. Anything else
 * (a typo, or a `javascript:` URL) stops the process here.
 */
function moodleBaseUrl(): string {
  const raw = process.env.MOODLE_BASE_URL?.trim() || "https://moodle.example.org";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`MOODLE_BASE_URL must be a full web address, got "${raw}"`);
  }
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
    throw new Error(
      `MOODLE_BASE_URL must start with https:// (http:// only for localhost), got "${raw}"`,
    );
  }
  return raw.replace(/\/+$/, "");
}

export const config = {
  seedDataset: seedDataset(),
  moodleBaseUrl: moodleBaseUrl(),
};
