import { buildServer } from "./server";
import { config } from "./config";
import { prisma } from "./db/prisma";
import { seedIfEmpty } from "./seed/fakeFoodSeed";
import { seedOpenScienceContent } from "./seed/openScienceSeed";

/** How long in-flight requests get to finish on shutdown before we exit anyway. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

// Last-resort nets. Routes go through asyncHandler, so reaching these means a
// bug: a stray rejection is logged and the process carries on; an uncaught
// exception leaves it in an unknown state, so it exits and Docker
// (restart: unless-stopped) brings up a clean one.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception — exiting:", err);
  process.exit(1);
});

async function main() {
  // A fresh database starts with the fake dataset (roles, questions, sources,
  // journeys). Awaited before listening so the first request never sees an
  // empty question bank. A failure here is logged, not fatal — the API still
  // starts, it just has nothing to show.
  try {
    if (await seedIfEmpty()) console.log("Fake dataset was missing — loaded the fake seed data.");
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

  const server = buildServer().listen(config.port, () => {
    console.log(`AIOS backend listening on http://localhost:${config.port}`);
  });

  // e.g. EADDRINUSE — without this the error is thrown asynchronously.
  server.on("error", (err) => {
    console.error("HTTP server failed:", err);
    process.exit(1);
  });

  // Stop taking new requests, let in-flight ones finish, then release the
  // database connections — so a restart (docker stop, tsx watch reload)
  // never cuts a response or a transaction off halfway.
  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received — shutting down.`);

    setTimeout(() => {
      console.error("Shutdown timed out — forcing exit.");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    server.close(() => {
      prisma
        .$disconnect()
        .catch((err) => console.error("Prisma disconnect failed:", err))
        .finally(() => process.exit(0));
    });
    server.closeIdleConnections();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Backend failed to start:", err);
  process.exit(1);
});
