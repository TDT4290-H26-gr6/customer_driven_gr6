import { describe, expect, it, vi } from "vitest";
import fakeData from "./data/aios_fake_food_seed.json";
import wp2Data from "./data/aios_wp2_seed.json";
import { fakeFoodDataset, seedFakeFood, seedIfIncomplete } from "./fakeFoodSeed";
import { wp2Dataset } from "./wp2Seed";

vi.mock("../db/prisma", () => ({ prisma: {} }));

const idsOf = (data: unknown, table: string) =>
  ((data as Record<string, { id: string }[]>)[table] ?? []).map((row) => row.id);

describe("the dataset loaders", () => {
  it.each([
    ["fake", fakeFoodDataset, fakeData],
    ["wp2", wp2Dataset, wp2Data],
  ])("%s is built from its own JSON file", (_name, dataset, data) => {
    expect(dataset.sectionIds).toEqual(idsOf(data, "aios.assessment.section"));
    expect(dataset.questionIds).toEqual(idsOf(data, "aios.assessment.question"));
    expect(dataset.sectionIds.length).toBeGreaterThan(0);
  });

  it("the two datasets share no sections, so they can be told apart in a database", () => {
    const shared = fakeFoodDataset.sectionIds.filter((id) => wp2Dataset.sectionIds.includes(id));
    expect(shared).toEqual([]);
  });

  it("the fake dataset's shortcuts are its loader's own functions", () => {
    expect(seedFakeFood).toBe(fakeFoodDataset.seed);
    expect(seedIfIncomplete).toBe(fakeFoodDataset.seedIfIncomplete);
  });
});
