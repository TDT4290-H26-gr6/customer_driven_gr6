import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompetenceRadar, outlineEdges, wrapLabel } from "./CompetenceRadar";
import type { CompetenceScore } from "../types";

describe("wrapLabel", () => {
  it("keeps short names on one line", () => {
    expect(wrapLabel("AI Literacy")).toEqual(["AI Literacy"]);
  });

  it("breaks every name at the same fixed width, word by word", () => {
    expect(wrapLabel("FAKE Onion Dicing")).toEqual(["FAKE Onion", "Dicing"]);
    expect(wrapLabel("FAKE Hand Washing")).toEqual(["FAKE Hand", "Washing"]);
    expect(wrapLabel("FAKE Cross-Contamination Control")).toEqual([
      "FAKE Cross-",
      "Contamination",
      "Control",
    ]);
  });

  it("wraps long names onto as many lines as needed, none over 14 characters", () => {
    const name = "Legal, Ethical, and Governance Aspects of Open Research";
    const lines = wrapLabel(name);
    expect(lines.length).toBeGreaterThan(2);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(14);
    // Every word survives the split, none dropped or duplicated.
    expect(lines.join(" ")).toBe(name);
  });

  it("splits an over-long word at its own hyphens first", () => {
    const lines = wrapLabel("Cross-Contamination-Prevention-Strategies");
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(14);
    expect(lines.join("")).toBe("Cross-Contamination-Prevention-Strategies");
  });

  it("splits a word with no hyphens into hyphenated chunks", () => {
    const lines = wrapLabel("Supercalifragilisticexpialidocious");
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(14);
    expect(lines[0].endsWith("-")).toBe(true);
    expect(lines.join("").replace(/-/g, "")).toBe("Supercalifragilisticexpialidocious");
  });
});

describe("outlineEdges", () => {
  const centre = { x: 0, y: 0 };

  it("lists each edge of a normal shape once, closing it back to the start", () => {
    const a = { x: 0, y: -1 };
    const b = { x: 1, y: 0 };
    const c = { x: 0, y: 1 };
    expect(outlineEdges([a, b, c])).toEqual([
      [a, b],
      [b, c],
      [c, a],
    ]);
  });

  it("draws a shape collapsed to one spoke as a single edge, not out-and-back", () => {
    // Only the first score is above 0: centre → tip → centre → centre.
    const tip = { x: 0, y: -1 };
    expect(outlineEdges([tip, centre, centre, centre])).toEqual([[tip, centre]]);
  });

  it("returns nothing when every point is the centre", () => {
    expect(outlineEdges([centre, centre, centre])).toEqual([]);
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

  it("draws a dashed comparison outline only when given matching scores", () => {
    const { rerender } = render(<CompetenceRadar data={SCORES} compact />);
    expect(screen.queryByTestId("compare-area")).not.toBeInTheDocument();

    rerender(<CompetenceRadar data={SCORES} compare={SCORES} compact />);
    expect(screen.getByTestId("compare-area")).toBeInTheDocument();
    // A point per axis for each of the two SATs.
    const chart = screen.getByRole("img", { name: /skill levels radar chart/i });
    expect(chart.querySelectorAll("circle")).toHaveLength(SCORES.length * 2);

    // A comparison that doesn't line up with the axes is left out.
    rerender(<CompetenceRadar data={SCORES} compare={SCORES.slice(0, 2)} compact />);
    expect(screen.queryByTestId("compare-area")).not.toBeInTheDocument();
  });

  it("labels compact tips and legend entries with the given short labels, e.g. A1", () => {
    render(<CompetenceRadar data={SCORES} compact tipLabels={["A1", "A2", "A3"]} />);

    const chart = screen.getByRole("img", { name: /skill levels radar chart/i });
    expect([...chart.querySelectorAll("text")].map((t) => t.textContent)).toEqual([
      "A1",
      "A2",
      "A3",
    ]);
    // The legend pairs each short label with the full name.
    expect(screen.getAllByText("A1")).toHaveLength(2);
    expect(screen.getByText("Open Science")).toBeInTheDocument();
  });

  it("numbers compact tips 1, 2, 3 … without tip labels", () => {
    render(<CompetenceRadar data={SCORES} compact />);

    const chart = screen.getByRole("img", { name: /skill levels radar chart/i });
    expect([...chart.querySelectorAll("text")].map((t) => t.textContent)).toEqual(["1", "2", "3"]);
  });

  it("grows a many-line label above the chart upwards, so it never runs into the chart", () => {
    const data: CompetenceScore[] = [
      {
        competence: { name: "A very long name that wraps onto several lines" },
        score: 1,
        maxScore: 2,
      },
      { competence: { name: "Right" }, score: 1, maxScore: 2 },
      { competence: { name: "Bottom" }, score: 1, maxScore: 2 },
      { competence: { name: "Left" }, score: 1, maxScore: 2 },
    ];
    render(<CompetenceRadar data={data} />);

    const chart = screen.getByRole("img", { name: /skill levels radar chart/i });
    const [top, , bottom] = chart.querySelectorAll("text");
    const firstDy = (text: Element) => parseFloat(text.querySelector("tspan")!.getAttribute("dy")!);
    const lineCount = top.querySelectorAll("tspan").length;
    expect(lineCount).toBeGreaterThan(2);
    // Top label: its first line starts (lines - 1) line-heights above the tip.
    expect(firstDy(top)).toBeCloseTo(-(lineCount - 1) * 1.2);
    // Bottom label: its first line sits at the tip, the rest below.
    expect(firstDy(bottom)).toBe(0);
  });

  it("draws no dot for a score of 0, in either SAT", () => {
    const withZero: CompetenceScore[] = [
      ...SCORES.slice(0, 2),
      { competence: { name: "Legal & Ethics" }, score: 0, maxScore: 31 },
    ];
    render(<CompetenceRadar data={withZero} compare={withZero} compact />);

    const chart = screen.getByRole("img", { name: /skill levels radar chart/i });
    // Two non-zero scores per SAT; the 0 would only be a dot in the centre.
    expect(chart.querySelectorAll("circle")).toHaveLength(4);
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
