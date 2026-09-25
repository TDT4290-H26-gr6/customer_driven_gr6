import { buildServer } from "./server";
import { config } from "./config";
import { seedIfEmpty } from "./seed/fakeFoodSeed";
import { seedOpenScienceContent } from "./seed/openScienceSeed";

async function main() {
  // A fresh database starts with the fake dataset (roles, questions, sources,
  // journeys). Awaited before listening so the first request never sees an
  // empty question bank. A failure here is logged, not fatal — the API still
  // starts, it just has nothing to show.
  try {
    if (await seedIfEmpty()) console.log("Database had no questions — loaded the fake seed data.");
  } catch (err) {
    console.error("Startup seeding failed:", err);
  }

  // The real open-science content (CD-74) is seeded unconditionally, every
  // boot — every insert skips rows that already exist, so this is a no-op
  // once it has run, and it fills in the real content even on a database
  // that already has the fake dataset (or came from before this seed
  // existed).
  try {
    await seedOpenScienceContent();
  } catch (err) {
    console.error("Startup seeding of open-science content failed:", err);
  }

  buildServer().listen(config.port, () => {
    console.log(`AIOS backend listening on http://localhost:${config.port}`);
  });
}

main();
