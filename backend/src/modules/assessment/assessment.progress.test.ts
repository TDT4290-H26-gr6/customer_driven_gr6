import { describe, expect, it } from "vitest";
import { buildSectionProgress, snapshotAsOf, type AttemptForProgress } from "./assessment.progress";

const A = { id: "sec-a", code: "A", name: "Data" };
const B = { id: "sec-b", code: "B", name: "Publishing" };

type CompetenceFixture = { id: string; score: number; maxScore: number; reached: boolean };

function section(
  s: typeof A,
  competences: CompetenceFixture[] | null,
  level: number | null = null,
): AttemptForProgress["sections"][number] {
  return {
    section: s,
    assessed: competences !== null,
    level: competences === null ? null : level,
    levelCount: 4,
    competences: (competences ?? []).map(({ id, score, maxScore, reached }) => ({
      competence: { id },
      score,
      maxScore,
      reached,
    })),
  };
}

const a1 = (score: number, reached = true) => ({ id: "a1", score, maxScore: 5, reached });
const a2 = (score: number, reached = true) => ({ id: "a2", score, maxScore: 5, reached });
const b1 = (score: number, reached = true) => ({ id: "b1", score, maxScore: 10, reached });

// Newest first, as the service passes them.
const third: AttemptForProgress = {
  instanceNum: 3,
  // A reassessment after a journey: only section A, and within it only a1 —
  // a2 is never reached (e.g. a1's level failed first).
  sections: [section(A, [a1(4), a2(0, false)], 3), section(B, null)],
};
const second: AttemptForProgress = {
  instanceNum: 2,
  sections: [section(A, [a1(2), a2(2)], 1), section(B, [b1(6)], 2)],
};
const first: AttemptForProgress = {
  instanceNum: 1,
  sections: [section(A, [a1(1), a2(1)], 0), section(B, [b1(2)], 1)],
};

describe("snapshotAsOf", () => {
  it("sums each section's competences from that SAT, when it reached all of them", () => {
    expect(snapshotAsOf([second, first], 2).get("sec-a")).toEqual({
      instanceNum: 2,
      score: 4,
      maxScore: 10,
      level: 1,
    });
  });

  it("backfills a competence the newest SAT didn't reach, from the newest earlier SAT that did", () => {
    // third reached only a1 (a2 never asked, failed before it); second reached
    // both. The section is "as of" third (its newest-touching SAT and level),
    // but a2's own number still comes from second.
    expect(snapshotAsOf([third, second, first], 3).get("sec-a")).toEqual({
      instanceNum: 3,
      score: 6, // third's a1 (4) + second's a2 (2)
      maxScore: 10,
      level: 3,
    });
  });

  it("leaves out a competence no SAT up to then has ever reached", () => {
    const attempt: AttemptForProgress = {
      instanceNum: 1,
      sections: [section(A, [a1(1), a2(0, false)])],
    };
    expect(snapshotAsOf([attempt], 1).get("sec-a")).toEqual({
      instanceNum: 1,
      score: 1,
      maxScore: 5,
      level: null,
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
      sections: [section(A, [a1(1)]), section(B, null)],
    };
    expect(snapshotAsOf([onlyA], 1).has("sec-b")).toBe(false);
  });
});

describe("buildSectionProgress", () => {
  it("pairs the latest and previous result for every section, in order", () => {
    const progress = buildSectionProgress([third, second, first], 3, 2);

    expect(progress.map((p) => p.section.code)).toEqual(["A", "B"]);
    expect(progress[0].latest).toMatchObject({ instanceNum: 3, score: 6, level: 3 });
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
      sections: [section(A, [a1(1)]), section(B, null)],
    };
    const [, b] = buildSectionProgress([onlyA], 1, null);

    expect(b).toEqual({ section: B, levelCount: 4, latest: null, previous: null });
  });
});
