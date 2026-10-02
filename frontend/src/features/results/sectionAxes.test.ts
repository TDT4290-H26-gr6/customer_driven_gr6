import { describe, expect, it } from "vitest";
import { sectionAxes } from "./sectionAxes";

describe("sectionAxes", () => {
  it("sums each section's competences into one axis, labelled with the section's name", () => {
    const result = sectionAxes([
      {
        section: { id: "s1", name: "Knife Skills" },
        assessed: true,
        assessedAt: "2026-10-01T12:00:00.000Z",
        competences: [
          { competence: { name: "Onion Dicing" }, score: 2, maxScore: 5 },
          { competence: { name: "Finger Keeping" }, score: 1, maxScore: 1 },
        ],
      },
      {
        section: { id: "s2", name: "Baking & Pastry" },
        assessed: true,
        assessedAt: "2026-10-01T12:00:00.000Z",
        competences: [{ competence: { name: "Oven Temperature" }, score: 0, maxScore: 5 }],
      },
    ]);

    expect(result).toEqual([
      { competence: { name: "Knife Skills" }, score: 3, maxScore: 6 },
      { competence: { name: "Baking & Pastry" }, score: 0, maxScore: 5 },
    ]);
  });

  it("gives a section with no competences a 0/0 axis, not a missing one", () => {
    expect(
      sectionAxes([
        {
          section: { id: "s1", name: "Empty" },
          assessed: false,
          assessedAt: null,
          competences: [],
        },
      ]),
    ).toEqual([{ competence: { name: "Empty" }, score: 0, maxScore: 0 }]);
  });

  it("returns an empty list for no sections", () => {
    expect(sectionAxes([])).toEqual([]);
  });
});
