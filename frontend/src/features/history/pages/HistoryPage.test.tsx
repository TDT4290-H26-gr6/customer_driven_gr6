import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryPage } from "./HistoryPage";
import { getSatHistory } from "../api";
import type { SatHistoryEntry } from "../types";

vi.mock("../api", () => ({
  getSatHistory: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const FULL_1: SatHistoryEntry = {
  instanceNum: 1,
  completedAt: "2026-01-15T00:00:00.000Z",
  sumScore: 4,
  sumMaxScore: 6,
  sections: [
    {
      code: "A",
      name: "Knife Skills",
      areas: [{ name: "Onion Dicing", score: 3, maxScore: 3 }],
    },
    {
      code: "B",
      name: "Baking",
      areas: [{ name: "Dough Proofing", score: 1, maxScore: 3 }],
    },
  ],
  completedJourney: null,
  reassessedSections: [],
};

// A later full attempt, to test ordering within the Full tab.
const FULL_3: SatHistoryEntry = {
  ...FULL_1,
  instanceNum: 3,
  completedAt: "2026-03-15T00:00:00.000Z",
};

const PARTIAL_2: SatHistoryEntry = {
  instanceNum: 2,
  completedAt: "2026-02-15T00:00:00.000Z",
  sumScore: 5,
  sumMaxScore: 6,
  sections: [
    {
      code: "A",
      name: "Knife Skills",
      areas: [{ name: "Onion Dicing", score: 2, maxScore: 3 }],
    },
    {
      code: "B",
      name: "Baking",
      areas: [{ name: "Dough Proofing", score: 3, maxScore: 3 }],
    },
  ],
  completedJourney: "Knife Ninja Journey",
  reassessedSections: ["Knife Skills", "Kitchen Safety"],
};

const ENTRIES = [FULL_1, PARTIAL_2, FULL_3];

describe("HistoryPage", () => {
  it("shows full assessments by default, most recent first, and switches to partial ones on the other tab", async () => {
    vi.mocked(getSatHistory).mockResolvedValue(ENTRIES);
    const user = userEvent.setup();

    render(<HistoryPage />);

    const headings = await screen.findAllByRole("heading", { name: /^Assessment \d$/ });
    expect(headings.map((h) => h.textContent)).toEqual(["Assessment 3", "Assessment 1"]);
    expect(screen.queryByText("Assessment 2")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Partial assessments" }));

    expect(await screen.findByText("Assessment 2")).toBeInTheDocument();
    expect(screen.queryByText("Assessment 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Assessment 3")).not.toBeInTheDocument();
  });

  it("shows the sum score and percentage for the active tab's entries", async () => {
    vi.mocked(getSatHistory).mockResolvedValue([FULL_1]);

    render(<HistoryPage />);

    expect(await screen.findByText("4 / 6")).toBeInTheDocument();
    expect(screen.getByText("(67%)")).toBeInTheDocument();
  });

  it("shows the completed journey and reassessed sections on the Partial tab", async () => {
    vi.mocked(getSatHistory).mockResolvedValue(ENTRIES);
    const user = userEvent.setup();

    render(<HistoryPage />);
    await user.click(await screen.findByRole("tab", { name: "Partial assessments" }));

    expect(await screen.findByText("Knife Ninja Journey")).toBeInTheDocument();
    expect(screen.getByText("Reassessed: Knife Skills, Kitchen Safety")).toBeInTheDocument();
  });

  it("shows the reassessed section of a reassessment without a journey", async () => {
    vi.mocked(getSatHistory).mockResolvedValue([
      { ...PARTIAL_2, completedJourney: null, reassessedSections: ["Baking"] },
    ]);
    const user = userEvent.setup();

    render(<HistoryPage />);
    await user.click(await screen.findByRole("tab", { name: "Partial assessments" }));

    expect(await screen.findByText("Reassessed: Baking")).toBeInTheDocument();
    expect(screen.queryByText(/after completing/i)).not.toBeInTheDocument();
  });

  it("lists each instance's module scores under the section they belong to", async () => {
    vi.mocked(getSatHistory).mockResolvedValue([FULL_1]);

    render(<HistoryPage />);

    const knife = await screen.findByRole("heading", { name: "Section A · Knife Skills" });
    const baking = screen.getByRole("heading", { name: "Section B · Baking" });
    // Each module sits right under its own section's heading.
    expect(within(knife.parentElement!).getByText("Onion Dicing")).toBeInTheDocument();
    expect(within(knife.parentElement!).queryByText("Dough Proofing")).not.toBeInTheDocument();
    expect(within(baking.parentElement!).getByText("Dough Proofing")).toBeInTheDocument();
    expect(within(baking.parentElement!).getByText("1 / 3")).toBeInTheDocument();
  });

  it("shows a tab-specific empty message when one tab has nothing, without hiding the other tab's entries", async () => {
    vi.mocked(getSatHistory).mockResolvedValue([FULL_1]);
    const user = userEvent.setup();

    render(<HistoryPage />);
    expect(await screen.findByText("Assessment 1")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Partial assessments" }));
    expect(await screen.findByText(/haven't completed a partial reassessment/i)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Full assessments" }));
    expect(await screen.findByText("Assessment 1")).toBeInTheDocument();
  });

  it("shows no tabs and the overall empty-state message when nothing's been completed yet", async () => {
    vi.mocked(getSatHistory).mockResolvedValue([]);

    render(<HistoryPage />);

    expect(await screen.findByText(/haven't completed a self-assessment/i)).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("shows an error message instead of crashing when the request fails", async () => {
    vi.mocked(getSatHistory).mockRejectedValue(new Error("network error"));

    render(<HistoryPage />);

    expect(await screen.findByText(/couldn't load your history/i)).toBeInTheDocument();
  });
});
