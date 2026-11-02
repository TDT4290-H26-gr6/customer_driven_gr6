import { prisma } from "../db/prisma";
import { wp2Dataset } from "./wp2Seed";

/**
 * The sections of the food-themed test dataset that used to be loaded by
 * default (it was removed). A database that still holds them was seeded with
 * it, and loading WP2 on top would mix the two question banks: a learner's
 * first assessment covers the whole bank, so they'd get both.
 */
const OLD_FAKE_SECTION_IDS = [
  "sec-fake-knife",
  "sec-fake-baking",
  "sec-fake-sauces",
  "sec-fake-safety",
  "sec-fake-critique",
];

export const OLD_FAKE_DATASET_MESSAGE =
  "The database holds the old food-themed test dataset, which has been removed. " +
  "WP2 can't be loaded on top of it: back up the database and start from an empty one. " +
  "Nothing was changed.";

/** Whether the database still holds the removed food-themed test dataset. */
export async function holdsOldFakeDataset(): Promise<boolean> {
  return (await prisma.section.count({ where: { id: { in: OLD_FAKE_SECTION_IDS } } })) > 0;
}

/**
 * Loads the WP2 curriculum into an empty database (see seedIfEmpty: a
 * database that already holds it is left alone), refusing one that still
 * holds the old test dataset rather than mixing the two; nothing is deleted
 * automatically. Returns whether anything was added or filled in.
 */
export async function seedWp2(): Promise<boolean> {
  if (await holdsOldFakeDataset()) throw new Error(OLD_FAKE_DATASET_MESSAGE);
  return wp2Dataset.seedIfEmpty();
}
