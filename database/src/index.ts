import { prisma } from "./db/prisma";
import { seedWp2 } from "./seed";

// The last step of `db-init` (see Dockerfile): after the schema is pushed,
// load the WP2 curriculum into an empty database. A database that already has its
// content is left alone: admins change it in the curriculum editor, and
// dataset updates are applied on purpose with `npm run content:sync`. Also
// `npm run seed` / `npx prisma db seed` by hand.
//
// A seeding failure stops db-init (exit code 1), so the backend doesn't start
// on a database that doesn't hold WP2. That includes refusing a database that
// still holds the old test dataset (see seed/index.ts): nothing is changed,
// and the reason is in `docker compose logs db-init`.
async function main() {
  try {
    const changed = await seedWp2();
    console.log(
      changed
        ? "WP2 curriculum loaded (or missing question details filled in)."
        : `The database already holds its content; nothing loaded. ` +
            `Use \`npm run content:sync\` to apply dataset changes.`,
    );
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exitCode = 1;
  }
}

main().finally(() => prisma.$disconnect());
