import { describe, expect, it } from "vitest";
import { bestPerModule, sectionPercent, type AnswerRow } from "./assessment.competencies";

const day = (n: number) => new Date(`2026-10-${String(n).padStart(2, "0")}T10:00:00Z`);

function answer(overrides: Partial<AnswerRow>): AnswerRow {
  return {
    moduleId: "mod-a2",
    satInstanceId: "sat-1",
    kind: "main",
    completedAt: day(1),
    journeyName: null,
    score: 1,
    maxScore: 1,
    ...overrides,
  };
}

describe("bestPerModule", () => {
  it("adds up a module's answers within one assessment", () => {
    const best = bestPerModule([
      answer({ score: 1 }),
      answer({ score: 0 }),
      answer({ score: 0.5 }),
      answer({ score: 0.5 }),
    ]);
    expect(best.get("mod-a2")?.percent).toBe(50);
  });

  it("keeps the best of several assessments, main and journey alike", () => {
    const best = bestPerModule([
      answer({ satInstanceId: "main-1", score: 0, completedAt: day(1) }),
      answer({
        satInstanceId: "journey-1",
        kind: "journey",
        journeyName: "LJ2 - Research Data",
        score: 1,
        completedAt: day(5),
      }),
      answer({ satInstanceId: "main-2", score: 0.5, completedAt: day(9) }),
    ]);

    expect(best.get("mod-a2")).toEqual({
      percent: 100,
      completedAt: day(5),
      kind: "journey",
      journeyName: "LJ2 - Research Data",
    });
  });

  it("keeps the newest result on a tie", () => {
    const best = bestPerModule([
      answer({ satInstanceId: "a", completedAt: day(1) }),
      answer({ satInstanceId: "b", completedAt: day(3) }),
    ]);
    expect(best.get("mod-a2")?.completedAt).toEqual(day(3));
  });

  it("scores each module separately and skips ones with nothing scorable", () => {
    const best = bestPerModule([
      answer({ moduleId: "mod-a2", score: 1 }),
      answer({ moduleId: "mod-b1", score: 0 }),
      answer({ moduleId: "mod-c1", score: 0, maxScore: 0 }),
    ]);
    expect(best.get("mod-a2")?.percent).toBe(100);
    expect(best.get("mod-b1")?.percent).toBe(0);
    expect(best.has("mod-c1")).toBe(false);
  });
});

describe("sectionPercent", () => {
  const result = (percent: number) => ({
    percent,
    completedAt: day(1),
    kind: "main",
    journeyName: null,
  });

  it("averages the modules' best results, each module counting equally", () => {
    expect(sectionPercent([result(100), result(50), result(0)])).toBe(50);
  });

  it("leaves out modules without a result instead of counting them as 0", () => {
    expect(sectionPercent([result(80), null, null, result(60)])).toBe(70);
  });

  it("is null when no module has a result yet", () => {
    expect(sectionPercent([null, null])).toBeNull();
    expect(sectionPercent([])).toBeNull();
  });
});
