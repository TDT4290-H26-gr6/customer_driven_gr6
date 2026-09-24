import { buildServer } from "./server";
import { config } from "./config";
import { seedIfEmpty } from "./seed/fakeFoodSeed";

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

  buildServer().listen(config.port, () => {
    console.log(`AIOS backend listening on http://localhost:${config.port}`);
  });
}

main();
