import { prisma } from "../db/prisma";
import { config } from "../config";
import { fakeFoodDataset } from "./fakeFoodSeed";
import { wp2Dataset } from "./wp2Seed";

const DATASETS = { fake: fakeFoodDataset, wp2: wp2Dataset } as const;
export type DatasetName = keyof typeof DATASETS;

/** The datasets other than `name` whose sections are already in the database. */
export async function otherDatasetsPresent(name: DatasetName): Promise<DatasetName[]> {
  const others = (Object.keys(DATASETS) as DatasetName[]).filter((other) => other !== name);
  const present: DatasetName[] = [];
  for (const other of others) {
    const count = await prisma.section.count({
      where: { id: { in: DATASETS[other].sectionIds } },
    });
    if (count > 0) present.push(other);
  }
  return present;
}

/**
 * Loads the dataset chosen by SEED_DATASET (or brings it up to date). Two
 * datasets never share a database: a learner's first assessment covers the
 * whole question bank, so a mix would hand them both. When the database
 * already holds another dataset this refuses and says so — switching means
 * backing the database up and starting from an empty one; nothing is
 * deleted automatically. Returns whether anything was added or changed.
 */
export async function seedChosenDataset(name: DatasetName = config.seedDataset): Promise<boolean> {
  const conflicting = await otherDatasetsPresent(name);
  if (conflicting.length > 0) {
    throw new Error(
      `SEED_DATASET is "${name}", but the database already holds the "${conflicting.join(", ")}" ` +
        `dataset. Datasets can't be mixed: back up the database and start from an empty one, ` +
        `or set SEED_DATASET back to "${conflicting[0]}". Nothing was loaded.`,
    );
  }
  return DATASETS[name].seedIfIncomplete();
}
