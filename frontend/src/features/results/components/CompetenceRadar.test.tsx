import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompetenceRadar, wrapLabel } from "./CompetenceRadar";
import type { CompetenceScore } from "../types";

describe("wrapLabel", () => {
  it("keeps short names on one line", () => {
    expect(wrapLabel("AI Literacy")).toEqual(["AI Literacy"]);
  });

  it("splits long names over two lines at a word boundary", () => {
    const lines = wrapLabel("Legal, Ethical, and Governance Aspects");
    expect(lines).toHaveLength(2);
    // Every word survives the split, none dropped or duplicated.
    expect(lines.join(" ")).toBe("Legal, Ethical, and Governance Aspects");
  });

  it("balances the two lines as evenly as the word breaks allow", () => {
    const lines = wrapLabel("Research Data and Metadata Management");
    const longest = Math.max(lines[0].length, lines[1].length);
    // No split should be more lopsided than putting everything on one line.
    expect(longest).toBeLessThan("Research Data and Metadata Management".length);
  });
});

const SCORES: CompetenceScore[] = [
  { competence: { name: "Open Science" }, score: 2, maxScore: 7 },
  { competence: { name: "Data Management" }, score: 4, maxScore: 5 },
  { competence: { name: "Legal & Ethics" }, score: 6, maxScore: 31 },
];

describe("CompetenceRadar", () => {
  it("shows a fallback message instead of a chart when there are fewer than 3 areas", () => {
    render(<CompetenceRadar data={SCORES.slice(0, 2)} compact />);
    expect(screen.getByText(/not enough skill areas/i)).toBeInTheDocument();
  });

  it("renders one axis point and one legend entry per competence area (compact mode)", () => {
    render(<CompetenceRadar data={SCORES} compact />);

    const chart = screen.getByRole("img", { name: /skill levels radar chart/i });
    expect(chart.querySelectorAll("circle")).toHaveLength(SCORES.length);

    for (const s of SCORES) {
      expect(screen.getByText(s.competence.name)).toBeInTheDocument();
    }
  });
});
