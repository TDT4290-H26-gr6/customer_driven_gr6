import { describe, expect, it } from "vitest";
import { alignForComparison } from "./alignForComparison";

const score = (name: string, value: number) => ({
  competence: { name },
  score: value,
  maxScore: 3,
});

describe("alignForComparison", () => {
  it("keeps the main order and lines the other SAT's scores up with it", () => {
    const { main, other } = alignForComparison(
      [score("Onion", 3), score("Fingers", 1)],
      [score("Fingers", 2), score("Onion", 0)],
    );

    expect(main.map((c) => c.competence.name)).toEqual(["Onion", "Fingers"]);
    expect(other.map((c) => [c.competence.name, c.score])).toEqual([
      ["Onion", 0],
      ["Fingers", 2],
    ]);
  });

  it("adds axes only one side has, at 0/0 on the other", () => {
    const { main, other } = alignForComparison([score("Onion", 3)], [score("Herbs", 2)]);

    expect(main).toEqual([
      score("Onion", 3),
      { competence: { name: "Herbs" }, score: 0, maxScore: 0 },
    ]);
    expect(other).toEqual([
      { competence: { name: "Onion" }, score: 0, maxScore: 0 },
      score("Herbs", 2),
    ]);
  });
});
