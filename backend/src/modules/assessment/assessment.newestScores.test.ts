import { describe, expect, it } from "vitest";
import { newestPerCompetence } from "./assessment.newestScores";

describe("newestPerCompetence", () => {
  it("keeps the first (newest) row per competence and drops older ones", () => {
    const rows = [
      { competenceId: "a", score: 3, from: "newest" },
      { competenceId: "b", score: 1, from: "newest" },
      { competenceId: "a", score: 0, from: "older" },
      { competenceId: "c", score: 2, from: "older" },
    ];

    expect(newestPerCompetence(rows)).toEqual([
      { competenceId: "a", score: 3, from: "newest" },
      { competenceId: "b", score: 1, from: "newest" },
      { competenceId: "c", score: 2, from: "older" },
    ]);
  });

  it("drops scores whose competence has since been deleted", () => {
    const rows = [
      { competenceId: null, competence: null, score: 9 },
      { competenceId: "a", competence: { name: "A" }, score: 1 },
    ];

    expect(newestPerCompetence(rows)).toEqual([
      { competenceId: "a", competence: { name: "A" }, score: 1 },
    ]);
  });

  it("returns an empty list for no rows", () => {
    expect(newestPerCompetence([])).toEqual([]);
  });
});
