import { config } from "./config";
import { prisma } from "./db/prisma";
import { seedChosenDataset } from "./seed";

// The last step of `db-init` (see Dockerfile): after the schema is pushed,
// load the dataset SEED_DATASET names (the fake one by default; "wp2" for the
// real curriculum) into a fresh database, or bring an older one up to date
// with whatever that dataset has gained since. Also `npm run seed` /
// `npx prisma db seed` by hand.
//
// A seeding failure is logged but doesn't fail db-init, so the backend still
// starts: it just has nothing (new) to show. That includes refusing to mix two
// datasets (see seed/index.ts). A schema push that fails does stop it.
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
  }
}

main().finally(() => prisma.$disconnect());
