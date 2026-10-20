import { config } from "./config";
import { prisma } from "./db/prisma";
import { seedChosenDataset } from "./seed";

// The last step of `db-init` (see Dockerfile): after the schema is pushed,
// load the dataset SEED_DATASET names (the fake one by default; "wp2" for the
// real curriculum) into a fresh database, or bring an older one up to date
// with whatever that dataset has gained since. Also `npm run seed` /
// `npx prisma db seed` by hand.
//
// A seeding failure stops db-init (exit code 1), so the backend doesn't start
// on a database that doesn't hold what SEED_DATASET asks for. That includes
// refusing to mix two datasets (see seed/index.ts): nothing is changed, and
// the reason is in `docker compose logs db-init`.
async function main() {
  try {
    const changed = await seedChosenDataset();
    console.log(
      changed
        ? `Dataset "${config.seedDataset}" loaded or brought up to date.`
        : `Dataset "${config.seedDataset}" already up to date.`,
    );
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exitCode = 1;
  }
}

main().finally(() => prisma.$disconnect());
