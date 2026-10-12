import { prisma } from "../src/db/prisma";
import { config } from "../src/config";
import { seedChosenDataset } from "../src/seed";

// `npx prisma db seed` — loads the dataset SEED_DATASET names ("fake" by
// default, or "wp2") by hand. The backend also does this by itself on start.
seedChosenDataset()
  .then((changed) =>
    console.log(
      changed ? `Seeded "${config.seedDataset}".` : `"${config.seedDataset}" already up to date.`,
    ),
  )
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
