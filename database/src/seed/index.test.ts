import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../db/prisma";
import { fakeFoodDataset } from "./fakeFoodSeed";
import { wp2Dataset } from "./wp2Seed";
import { otherDatasetsPresent, seedChosenDataset } from ".";

vi.mock("../db/prisma", () => ({ prisma: { section: { count: vi.fn() } } }));
vi.mock("./fakeFoodSeed", () => ({
  fakeFoodDataset: { sectionIds: ["sec-fake-a"], seedIfEmpty: vi.fn() },
}));
vi.mock("./wp2Seed", () => ({
  wp2Dataset: { sectionIds: ["sec-wp2-a"], seedIfEmpty: vi.fn() },
}));

const sectionCount = vi.mocked(prisma.section.count);

/** Pretends the database holds the sections of these datasets. */
function databaseHolds(...ids: string[]) {
  sectionCount.mockImplementation(
    (async (args: { where: { id: { in: string[] } } }) =>
      args.where.id.in.filter((id) => ids.includes(id)).length) as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fakeFoodDataset.seedIfEmpty).mockResolvedValue(true);
  vi.mocked(wp2Dataset.seedIfEmpty).mockResolvedValue(true);
});

describe("seedChosenDataset", () => {
  it("loads the chosen dataset into an empty database", async () => {
    databaseHolds();

    await expect(seedChosenDataset("wp2")).resolves.toBe(true);
    expect(wp2Dataset.seedIfEmpty).toHaveBeenCalledOnce();
    expect(fakeFoodDataset.seedIfEmpty).not.toHaveBeenCalled();
  });

  it("updates the chosen dataset when it's already there", async () => {
    databaseHolds("sec-fake-a");

    await seedChosenDataset("fake");
    expect(fakeFoodDataset.seedIfEmpty).toHaveBeenCalledOnce();
  });

  it("refuses, loading nothing, when the database holds another dataset", async () => {
    databaseHolds("sec-fake-a");

    await expect(seedChosenDataset("wp2")).rejects.toThrow(/already holds the "fake" dataset/);
    expect(wp2Dataset.seedIfEmpty).not.toHaveBeenCalled();
  });
});

describe("otherDatasetsPresent", () => {
  it("names the other datasets found in the database", async () => {
    databaseHolds("sec-wp2-a");

    await expect(otherDatasetsPresent("fake")).resolves.toEqual(["wp2"]);
    await expect(otherDatasetsPresent("wp2")).resolves.toEqual([]);
  });
});
