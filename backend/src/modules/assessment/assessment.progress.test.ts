import { describe, expect, it } from "vitest";
import {
  buildSectionProgress,
  isProgressComplete,
  snapshotAsOf,
  type AttemptForProgress,
} from "./assessment.progress";

const A = { id: "sec-a", code: "A", name: "Data" };
const B = { id: "sec-b", code: "B", name: "Publishing" };

function section(
  s: typeof A,
  scores: [number, number][] | null,
  level: number | null = null,
): AttemptForProgress["sections"][number] {
  return {
    section: s,
    assessed: scores !== null,
    level: scores === null ? null : level,
    levelCount: 4,
    competences: (scores ?? [[0, 0]]).map(([score, maxScore]) => ({ score, maxScore })),
  };
}

// Newest first, as the service passes them.
const third: AttemptForProgress = {
  instanceNum: 3,
  // A reassessment after a journey: only section A.
  sections: [
    section(
      A,
      [
        [4, 5],
        [3, 5],
      ],
      3,
    ),
    section(B, null),
  ],
};
const second: AttemptForProgress = {
  instanceNum: 2,
  sections: [
    section(
      A,
      [
        [2, 5],
        [2, 5],
      ],
      1,
    ),
    section(B, [[6, 10]], 2),
  ],
};
const first: AttemptForProgress = {
  instanceNum: 1,
  sections: [
    section(
      A,
      [
        [1, 5],
        [1, 5],
      ],
      0,
    ),
    section(B, [[2, 10]], 1),
  ],
};

describe("snapshotAsOf", () => {
  it("sums each section's competences from that SAT", () => {
    expect(snapshotAsOf([second, first], 2).get("sec-a")).toEqual({
      instanceNum: 2,
      score: 4,
      maxScore: 10,
      level: 1,
    });
  });

  it("carries a section the SAT didn't cover over from the newest earlier SAT", () => {
    const snapshot = snapshotAsOf([third, second, first], 3);

    expect(snapshot.get("sec-a")?.instanceNum).toBe(3);
    expect(snapshot.get("sec-b")).toEqual({ instanceNum: 2, score: 6, maxScore: 10, level: 2 });
  });

  it("ignores SATs newer than the one it's as of", () => {
    expect(snapshotAsOf([third, second, first], 1).get("sec-a")?.instanceNum).toBe(1);
  });

  it("leaves out a section no SAT up to then has covered", () => {
    const onlyA: AttemptForProgress = {
      instanceNum: 1,
      sections: [section(A, [[1, 2]]), section(B, null)],
    };
    expect(snapshotAsOf([onlyA], 1).has("sec-b")).toBe(false);
  });
});

describe("buildSectionProgress", () => {
  it("pairs the latest and previous result for every section, in order", () => {
    const progress = buildSectionProgress([third, second, first], 3, 2);

    expect(progress.map((p) => p.section.code)).toEqual(["A", "B"]);
    expect(progress[0].latest).toMatchObject({ instanceNum: 3, score: 7, level: 3 });
    expect(progress[0].previous).toMatchObject({ instanceNum: 2, score: 4, level: 1 });
    // B wasn't retaken: the same result on both sides, from assessment 2.
    expect(progress[1].latest).toEqual(progress[1].previous);
    expect(progress[1].latest?.instanceNum).toBe(2);
  });

  it("has no previous results after a single assessment", () => {
    const progress = buildSectionProgress([first], 1, null);

    expect(progress.every((p) => p.previous === null)).toBe(true);
    expect(progress[1].latest).toMatchObject({ instanceNum: 1, score: 2, maxScore: 10 });
  });

  it("keeps a never-assessed section, with no results", () => {
    const onlyA: AttemptForProgress = {
      instanceNum: 1,
      sections: [section(A, [[1, 2]]), section(B, null)],
    };
    const [, b] = buildSectionProgress([onlyA], 1, null);

    expect(b).toEqual({ section: B, levelCount: 4, latest: null, previous: null });
  });
});

describe("isProgressComplete", () => {
  it("is complete once every section has its results", () => {
    expect(isProgressComplete(buildSectionProgress([third, second], 3, 2), true)).toBe(true);
  });

  it("isn't while a section still lacks a previous result", () => {
    // Without assessment 2 loaded, B has nothing as of 3 or as of 2.
    expect(isProgressComplete(buildSectionProgress([third], 3, 2), true)).toBe(false);
  });

  it("only needs latest results when there's no previous assessment", () => {
    expect(isProgressComplete(buildSectionProgress([first], 1, null), false)).toBe(true);
  });
});
