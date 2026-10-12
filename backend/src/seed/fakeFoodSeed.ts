import seedData from "./data/aios_fake_food_seed.json";
import { createDatasetLoader } from "./datasetLoader";

// The FAKE food-themed dataset in data/aios_fake_food_seed.json: test data
// with the same shape as the real curriculum (5 sections x 4 leveled modules
// x 3 questions). The default dataset for now (SEED_DATASET=fake) — see
// seed/index.ts — and loadable by hand via `npx prisma db seed`.

export const fakeFoodDataset = createDatasetLoader(seedData);

export const seedFakeFood = fakeFoodDataset.seed;
export const seedIfIncomplete = fakeFoodDataset.seedIfIncomplete;
