import { describe, expect, it } from "vitest";
import { buildPath, seededRandom, shuffle, skillLevel, type PathSection } from "./assessment.path";

type Score = { score: number | null; maxScore: number | null };
const right: Score = { score: 1, maxScore: 1 };
const wrong: Score = { score: 0, maxScore: 1 };

/** Section `code` with one 3-question module per level: A1-1, A1-2, A1-3, A2-1, … */
function section(code: string, levels = 4, perModule = 3): PathSection {
  return {
    id: code,
    modules: Array.from({ length: levels }, (_, i) => ({
      id: `${code}${i + 1}`,
      level: i + 1,
      questionIds: Array.from({ length: perModule }, (_, q) => `${code}${i + 1}-${q + 1}`),
    })),
  };
}

/** Answers first given in the order listed (one second apart). */
function answers(entries: Record<string, Score>) {
  return new Map(
    Object.entries(entries).map(([id, s], i) => [id, { ...s, answeredAt: new Date(1000 * i) }]),
  );
}

describe("buildPath", () => {
  it("starts with the first question of the first section's level 1", () => {
    expect(buildPath([section("A"), section("B")], new Map())).toEqual({
      answered: [],
      next: "A1-1",
    });
  });

  it("asks every question of a level, even once 2 of 3 are right", () => {
    const path = buildPath([section("A")], answers({ "A1-1": right, "A1-2": right }));
    expect(path).toEqual({ answered: ["A1-1", "A1-2"], next: "A1-3" });
  });

  it("moves up a level once all its questions are answered with 2 of 3 right", () => {
    const path = buildPath(
      [section("A")],
      answers({ "A1-1": right, "A1-2": right, "A1-3": wrong }),
    );
    expect(path).toEqual({ answered: ["A1-1", "A1-2", "A1-3"], next: "A2-1" });
  });

  it("keeps asking while the level is still undecided", () => {
    const path = buildPath([section("A")], answers({ "A1-1": right, "A1-2": wrong }));
    expect(path.next).toBe("A1-3");
  });

  it("fails a level as soon as 2 of 3 is out of reach and moves to the next section", () => {
    // 2 wrong of 3: at most 1/3 left, A1-3 and A2–A4 are skipped.
    const path = buildPath([section("A"), section("B")], answers({ "A1-1": wrong, "A1-2": wrong }));
    expect(path).toEqual({ answered: ["A1-1", "A1-2"], next: "B1-1" });
  });

  it("needs 3 of 4 on a 4-question level (2 of 4 is only half)", () => {
    const sections = [section("A", 2, 4), section("B")];
    expect(buildPath(sections, answers({ "A1-1": right, "A1-2": right, "A1-3": wrong })).next).toBe(
      "A1-4",
    );
    expect(
      buildPath(sections, answers({ "A1-1": right, "A1-2": right, "A1-3": wrong, "A1-4": wrong }))
        .next,
    ).toBe("B1-1");
  });

  it("counts partial credit (fractional scores) toward the 60%", () => {
    const path = buildPath(
      [section("A")],
      answers({ "A1-1": { score: 0.5, maxScore: 1 }, "A1-2": right, "A1-3": wrong }),
    );
    // 1.5 / 3 < 60%: failed.
    expect(path).toEqual({ answered: ["A1-1", "A1-2", "A1-3"], next: null });
  });

  it("finishes once every section is passed or failed", () => {
    const all: Record<string, Score> = {};
    for (const level of [1, 2, 3, 4]) {
      all[`A${level}-1`] = right;
      all[`A${level}-2`] = right;
      all[`A${level}-3`] = right;
    }
    expect(buildPath([section("A")], answers(all))).toEqual({
      answered: Object.keys(all),
      next: null,
    });
  });

  it("orders modules by level, whatever order they're given in", () => {
    const shuffledLevels: PathSection = {
      id: "A",
      modules: [...section("A").modules].reverse(),
    };
    expect(buildPath([shuffledLevels], new Map()).next).toBe("A1-1");
  });

  it("skips a level with no questions (e.g. none visible to the role) instead of failing it", () => {
    const sparse: PathSection = {
      id: "A",
      modules: [
        { id: "A1", level: 1, questionIds: [] },
        { id: "A2", level: 2, questionIds: ["A2-1"] },
      ],
    };
    expect(buildPath([sparse], new Map()).next).toBe("A2-1");
  });

  it("doesn't let an unscorable answer block the level", () => {
    const path = buildPath(
      [section("A", 1, 2)],
      answers({ "A1-1": { score: null, maxScore: null }, "A1-2": right }),
    );
    // Only A1-2 counts: 1 / 1.
    expect(path).toEqual({ answered: ["A1-1", "A1-2"], next: null });
  });
});

describe("buildPath: the 60% threshold", () => {
  it("passes on exactly 60% of points (1.8 of 3) from partial credit", () => {
    const path = buildPath(
      [section("A")],
      answers({
        "A1-1": { score: 0.4, maxScore: 1 },
        "A1-2": { score: 0.7, maxScore: 1 },
        "A1-3": { score: 0.7, maxScore: 1 },
      }),
    );
    expect(path.next).toBe("A2-1");
  });

  it("keeps going after one wrong answer only while both remaining could still be right", () => {
    expect(buildPath([section("A")], answers({ "A1-1": wrong })).next).toBe("A1-2");
    // 0 + 0.5 + at most 1 = 1.5 < 1.8: out of reach.
    expect(
      buildPath(
        [section("A"), section("B")],
        answers({ "A1-1": wrong, "A1-2": { score: 0.5, maxScore: 1 } }),
      ).next,
    ).toBe("B1-1");
  });
});

describe("buildPath: answered questions are history", () => {
  it("keeps every answered question after an earlier answer changes", () => {
    // A1 was passed and A2-1 answered, then A1's answers were changed
    // to wrong. A1 would now have failed, but A2-1 stays on the path.
    const path = buildPath(
      [section("A"), section("B")],
      answers({ "A1-1": wrong, "A1-2": wrong, "A2-1": right }),
    );
    expect(path.answered).toEqual(["A1-1", "A1-2", "A2-1"]);
  });

  it("carries on from the latest answered level, not from the changed one", () => {
    // As above: A1 is not reopened (A1-3 isn't asked); A2 continues.
    const path = buildPath(
      [section("A"), section("B")],
      answers({ "A1-1": right, "A1-2": wrong, "A2-1": right }),
    );
    expect(path.next).toBe("A2-2");
  });

  it("lets a change to the latest level decide what comes next", () => {
    // Latest is A1-3: wrong fails A1 (the section ends); right passes it.
    const first = { "A1-1": right, "A1-2": wrong };
    expect(buildPath([section("A")], answers({ ...first, "A1-3": wrong })).next).toBeNull();
    expect(buildPath([section("A")], answers({ ...first, "A1-3": right })).next).toBe("A2-1");
  });

  it("never returns to a section already left", () => {
    // A was failed and B started; even if A's answers are later made right,
    // the path carries on in B.
    const path = buildPath(
      [section("A"), section("B")],
      answers({ "A1-1": right, "A1-2": right, "B1-1": wrong }),
    );
    expect(path.next).toBe("B1-2");
  });

  it("lists answered questions in the order they were first answered", () => {
    const sections = [section("A"), section("B")];
    const given = new Map([
      ["B1-1", { ...wrong, answeredAt: new Date(2000) }],
      ["A1-1", { ...wrong, answeredAt: new Date(1000) }],
    ]);
    expect(buildPath(sections, given).answered).toEqual(["A1-1", "B1-1"]);
  });

  it("ignores answers to questions that are no longer in the bank", () => {
    const path = buildPath([section("A")], answers({ "deleted-q": right, "A1-1": right }));
    expect(path.answered).toEqual(["A1-1"]);
    expect(path.next).toBe("A1-2");
  });
});

describe("buildPath: exhaustive (partial reassessment)", () => {
  it("keeps asking the rest of a level even once 2 of 3 is already out of reach", () => {
    // Non-exhaustive would fail the level here and skip straight to B.
    const path = buildPath(
      [section("A"), section("B")],
      answers({ "A1-1": wrong, "A1-2": wrong }),
      true,
    );
    expect(path.next).toBe("A1-3");
  });

  it("moves on to the next level even once the current one has failed", () => {
    const path = buildPath(
      [section("A")],
      answers({ "A1-1": wrong, "A1-2": wrong, "A1-3": wrong }),
      true,
    );
    expect(path.next).toBe("A2-1");
  });

  it("asks every question of every level before finishing the section", () => {
    const all: Record<string, Score> = {};
    for (const level of [1, 2, 3]) {
      all[`A${level}-1`] = wrong;
      all[`A${level}-2`] = wrong;
      all[`A${level}-3`] = wrong;
    }
    const path = buildPath([section("A", 4)], answers(all), true);
    expect(path.next).toBe("A4-1");
  });

  it("finishes once every question in every section is answered", () => {
    const all: Record<string, Score> = {};
    for (const level of [1, 2, 3, 4]) {
      all[`A${level}-1`] = wrong;
      all[`A${level}-2`] = wrong;
      all[`A${level}-3`] = wrong;
    }
    expect(buildPath([section("A")], answers(all), true).next).toBeNull();
  });

  it("isn't exhaustive by default (unaffected callers keep the adaptive route)", () => {
    const given = answers({ "A1-1": wrong, "A1-2": wrong });
    expect(buildPath([section("A"), section("B")], given).next).toBe("B1-1");
  });
});

describe("seededRandom / shuffle", () => {
  it("gives the same order for the same seed", () => {
    const items = ["A", "B", "C", "D", "E"];
    expect(shuffle(items, seededRandom("learner-1:2"))).toEqual(
      shuffle(items, seededRandom("learner-1:2")),
    );
  });

  it("keeps every item exactly once", () => {
    const items = ["A", "B", "C", "D", "E"];
    expect([...shuffle(items, seededRandom("x"))].sort()).toEqual(items);
  });

  it("varies across seeds", () => {
    const items = ["A", "B", "C", "D", "E"];
    const orders = new Set(
      Array.from({ length: 20 }, (_, i) => shuffle(items, seededRandom(`seed-${i}`)).join("")),
    );
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe("skillLevel", () => {
  const modules = section("A").modules;

  it("is 0 when level 1 isn't passed", () => {
    expect(skillLevel(modules, answers({ "A1-1": wrong, "A1-2": wrong }))).toBe(0);
  });

  it("counts levels passed from 1 upwards", () => {
    const given = answers({
      "A1-1": right,
      "A1-2": right,
      "A2-1": right,
      "A2-2": wrong,
      "A2-3": right,
      "A3-1": wrong,
      "A3-2": wrong,
    });
    expect(skillLevel(modules, given)).toBe(2);
  });

  it("is 4 when every level is passed", () => {
    const all: Record<string, Score> = {};
    for (const level of [1, 2, 3, 4]) {
      all[`A${level}-1`] = right;
      all[`A${level}-2`] = right;
    }
    expect(skillLevel(modules, answers(all))).toBe(4);
  });

  it("doesn't count a level passed above one that isn't", () => {
    // A2 passed, but A1 failed (e.g. after an earlier answer was changed).
    const given = answers({ "A1-1": wrong, "A1-2": wrong, "A2-1": right, "A2-2": right });
    expect(skillLevel(modules, given)).toBe(0);
  });

  it("counts a level at 2 of 3 right with the third never asked (older SATs skipped it)", () => {
    expect(skillLevel(modules, answers({ "A1-1": right, "A1-2": right }))).toBe(1);
  });

  it("orders levels by number, whatever order the modules come in", () => {
    const given = answers({ "A1-1": right, "A1-2": right });
    expect(skillLevel([...modules].reverse(), given)).toBe(1);
  });
});
