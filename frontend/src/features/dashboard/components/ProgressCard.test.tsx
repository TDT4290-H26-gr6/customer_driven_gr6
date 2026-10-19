import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressCard } from "./ProgressCard";
import type { DashboardProgress } from "../types";

const sectionA = { id: "sec-a", code: "A", name: "Research data" };
const sectionB = { id: "sec-b", code: "B", name: "Open publishing" };
const sectionC = { id: "sec-c", code: "C", name: "AI ethics" };

const once: DashboardProgress = {
  latest: { instanceNum: 1, completedAt: "2026-09-20T10:00:00.000Z" },
  previous: null,
  sections: [
    {
      section: sectionA,
      levelCount: 4,
      latest: { instanceNum: 1, score: 4, maxScore: 10, level: 1 },
      previous: null,
    },
  ],
};

const twice: DashboardProgress = {
  latest: { instanceNum: 2, completedAt: "2026-10-03T10:00:00.000Z" },
  previous: { instanceNum: 1, completedAt: "2026-09-20T10:00:00.000Z" },
  sections: [
    {
      section: sectionA,
      levelCount: 4,
      latest: { instanceNum: 2, score: 7, maxScore: 10, level: 2 },
      previous: { instanceNum: 1, score: 4, maxScore: 10, level: 1 },
    },
    {
      section: sectionB,
      levelCount: 4,
      latest: { instanceNum: 2, score: 3, maxScore: 10, level: 1 },
      previous: { instanceNum: 1, score: 5, maxScore: 10, level: 1 },
    },
    {
      section: sectionC,
      levelCount: 4,
      latest: { instanceNum: 1, score: 6, maxScore: 10, level: 2 },
      previous: { instanceNum: 1, score: 6, maxScore: 10, level: 2 },
    },
  ],
};

function rowFor(name: string) {
  return screen.getByText(name).closest("li")!;
}

describe("ProgressCard after one assessment", () => {
  it("shows each section's score and invites a retake", () => {
    render(<ProgressCard progress={once} />);

    expect(screen.getByRole("heading", { name: "Your results by section" })).toBeInTheDocument();
    expect(screen.getByText(/take it again later/i)).toBeInTheDocument();
    const row = rowFor("Research data");
    expect(within(row).getByText("40%")).toBeInTheDocument();
    expect(within(row).queryByText(/pts|no change/i)).not.toBeInTheDocument();
  });
});

describe("ProgressCard after two assessments", () => {
  it("names both assessments being compared", () => {
    render(<ProgressCard progress={twice} />);

    expect(screen.getByRole("heading", { name: "Your progress" })).toBeInTheDocument();
    expect(screen.getByText(/assessment 2 \(3 oct 2026\) compared with/i)).toHaveTextContent(
      "Assessment 1 (20 Sept 2026)",
    );
  });

  it("shows an improvement with before → after and a + badge", () => {
    render(<ProgressCard progress={twice} />);
    const row = rowFor("Research data");

    expect(row).toHaveTextContent("40% → 70%");
    expect(within(row).getByLabelText("Up 30 percentage points")).toHaveTextContent("+30 pts");
  });

  it("shows a drop with a − badge", () => {
    render(<ProgressCard progress={twice} />);

    expect(
      within(rowFor("Open publishing")).getByLabelText("Down 20 percentage points"),
    ).toBeInTheDocument();
  });

  it("says where a section the latest assessment didn't retake gets its result from", () => {
    render(<ProgressCard progress={twice} />);
    const row = rowFor("AI ethics");

    expect(row).toHaveTextContent("60%");
    expect(row).toHaveTextContent(/not part of your latest assessment, result from assessment 1/i);
    expect(within(row).queryByText(/pts|no change/i)).not.toBeInTheDocument();
  });
});
