import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../db/prisma";
import { wp2Dataset } from "./wp2Seed";
import { holdsOldFakeDataset, seedWp2 } from ".";

vi.mock("../db/prisma", () => ({ prisma: { section: { count: vi.fn() } } }));
vi.mock("./wp2Seed", () => ({ wp2Dataset: { seedIfEmpty: vi.fn() } }));

const sectionCount = vi.mocked(prisma.section.count);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(wp2Dataset.seedIfEmpty).mockResolvedValue(true);
});

describe("seedWp2", () => {
  it("loads WP2", async () => {
    sectionCount.mockResolvedValue(0);
    await expect(seedWp2()).resolves.toBe(true);
    expect(wp2Dataset.seedIfEmpty).toHaveBeenCalledOnce();
  });

  it("refuses a database that still holds the old test dataset, rather than mixing them", async () => {
    sectionCount.mockResolvedValue(5);
    await expect(seedWp2()).rejects.toThrow(/old food-themed test dataset/);
    expect(wp2Dataset.seedIfEmpty).not.toHaveBeenCalled();
  });
});

describe("holdsOldFakeDataset", () => {
  it("looks for the old test dataset's sections", async () => {
    sectionCount.mockResolvedValue(0);
    await expect(holdsOldFakeDataset()).resolves.toBe(false);
    expect(sectionCount).toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(["sec-fake-knife"]) } },
    });
  });
});
