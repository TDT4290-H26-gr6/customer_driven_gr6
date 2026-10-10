import { describe, expect, it } from "vitest";
import { selectTargets } from "./advisor.candidates";

const THRESHOLD = 0.5;
const c = (name: string, percent: number) => ({ name, percent });

describe("selectTargets", () => {
  it("targets every competence at or below the threshold, weakest first", () => {
    const result = selectTargets([c("a", 10), c("b", 40), c("c", 50), c("d", 80)], THRESHOLD);

    expect(result.targets.map((t) => t.name)).toEqual(["a", "b", "c"]);
    expect(result.minSteps).toBe(1);
  });

  it("still targets the lowest competence when none is below the threshold", () => {
    const result = selectTargets([c("a", 60), c("b", 75), c("c", 100)], THRESHOLD);

    expect(result.targets.map((t) => t.name)).toEqual(["a"]);
    expect(result.minSteps).toBe(1);
  });

  it("skips perfect competences when picking the lowest", () => {
    const result = selectTargets([c("a", 100), c("b", 90)], THRESHOLD);

    expect(result.targets.map((t) => t.name)).toEqual(["b"]);
    expect(result.minSteps).toBe(1);
  });

  it("targets nothing after a perfect score", () => {
    expect(selectTargets([c("a", 100), c("b", 100)], THRESHOLD)).toEqual({
      targets: [],
      minSteps: 0,
    });
  });

  it("targets nothing when there are no scores at all", () => {
    expect(selectTargets([], THRESHOLD)).toEqual({ targets: [], minSteps: 0 });
  });
});
