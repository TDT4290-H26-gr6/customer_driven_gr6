import { describe, expect, it, vi } from "vitest";
import wp2Data from "./data/aios_wp2_seed.json";
import { wp2Dataset } from "./wp2Seed";

vi.mock("../db/prisma", () => ({ prisma: {} }));

const idsOf = (data: unknown, table: string) =>
  ((data as Record<string, { id: string }[]>)[table] ?? []).map((row) => row.id);

describe("the WP2 dataset loader", () => {
  it("is built from its own JSON file", () => {
    expect(wp2Dataset.sectionIds).toEqual(idsOf(wp2Data, "aios.assessment.section"));
    expect(wp2Dataset.questionIds).toEqual(idsOf(wp2Data, "aios.assessment.question"));
    expect(wp2Dataset.sectionIds.length).toBeGreaterThan(0);
  });
});
