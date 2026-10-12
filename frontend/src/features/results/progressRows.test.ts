import { describe, expect, it } from "vitest";
import { progressRows, radarAxes } from "./progressRows";
import type { DashboardProgress, SectionProgress } from "./types";

function section(
  code: string,
  latest: SectionProgress["latest"],
  previous: SectionProgress["previous"],
): SectionProgress {
  return {
    section: { id: `sec-${code}`, code, name: `Section ${code}` },
    levelCount: 4,
    latest,
    previous,
  };
}

const twoAssessments: DashboardProgress = {
  latest: { instanceNum: 2, completedAt: "2026-10-03T10:00:00.000Z" },
  previous: { instanceNum: 1, completedAt: "2026-09-20T10:00:00.000Z" },
  sections: [
    // Retaken and improved.
    section(
      "A",
      { instanceNum: 2, score: 7, maxScore: 10, level: 2 },
      { instanceNum: 1, score: 4, maxScore: 10, level: 0 },
    ),
    // Not retaken: the same result on both sides, from assessment 1.
    section(
      "B",
      { instanceNum: 1, score: 5, maxScore: 10, level: 1 },
      { instanceNum: 1, score: 5, maxScore: 10, level: 1 },
    ),
    // Never assessed.
    section("C", null, null),
  ],
};

describe("progressRows", () => {
  it("shows a retaken section's before, after and change", () => {
    const [a] = progressRows(twoAssessments);

    expect(a).toMatchObject({
      code: "A",
      previousPercent: 40,
      latestPercent: 70,
      previousLevel: "below A1",
      latestLevel: "A2",
      change: 30,
      carriedFrom: null,
      assessed: true,
    });
  });

  it("shows a section the latest assessment skipped as carried over, with no change", () => {
    const [, b] = progressRows(twoAssessments);

    expect(b.carriedFrom).toBe(1);
    expect(b.change).toBeNull();
    expect(b.latestPercent).toBe(50);
  });

  it("marks a section that was never assessed", () => {
    const [, , c] = progressRows(twoAssessments);

    expect(c).toMatchObject({
      assessed: false,
      latestPercent: null,
      latestLevel: null,
      change: null,
    });
  });

  it("has no previous values or changes after one assessment", () => {
    const rows = progressRows({
      ...twoAssessments,
      latest: { instanceNum: 1, completedAt: "2026-09-20T10:00:00.000Z" },
      previous: null,
      sections: [section("A", { instanceNum: 1, score: 3, maxScore: 4, level: 1 }, null)],
    });

    expect(rows[0]).toMatchObject({
      latestPercent: 75,
      previousPercent: null,
      previousLevel: null,
      change: null,
      carriedFrom: null,
    });
  });

  it("shows no change, not a drop, when the score stayed the same", () => {
    const [row] = progressRows({
      ...twoAssessments,
      sections: [
        section(
          "A",
          { instanceNum: 2, score: 5, maxScore: 10, level: 1 },
          { instanceNum: 1, score: 5, maxScore: 10, level: 1 },
        ),
      ],
    });

    expect(row.change).toBe(0);
  });
});

describe("radarAxes", () => {
  it("gives one axis per section, with 0/0 for one without a result", () => {
    expect(radarAxes(twoAssessments, "previous")).toEqual([
      { competence: { name: "Section A" }, score: 4, maxScore: 10 },
      { competence: { name: "Section B" }, score: 5, maxScore: 10 },
      { competence: { name: "Section C" }, score: 0, maxScore: 0 },
    ]);
    expect(radarAxes(twoAssessments, "latest")[0]).toEqual({
      competence: { name: "Section A" },
      score: 7,
      maxScore: 10,
    });
  });
});
