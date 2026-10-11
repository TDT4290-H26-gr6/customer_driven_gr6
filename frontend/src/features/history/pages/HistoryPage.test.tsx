import { render, screen, within } from "@testing-library/react";
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

const ENTRIES: SatHistoryEntry[] = [
  {
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
  },
  {
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
  },
];

describe("HistoryPage", () => {
  it("lists every completed instance with its sum score and percentage", async () => {
    vi.mocked(getSatHistory).mockResolvedValue(ENTRIES);

    render(<HistoryPage />);

    expect(await screen.findByText("Assessment 1")).toBeInTheDocument();
    expect(screen.getByText("Assessment 2")).toBeInTheDocument();
    expect(screen.getByText("4 / 6")).toBeInTheDocument();
    expect(screen.getByText("(67%)")).toBeInTheDocument();
    expect(screen.getByText("5 / 6")).toBeInTheDocument();
    expect(screen.getByText("(83%)")).toBeInTheDocument();
  });

  it("shows the completed journey and the reassessed sections, only on that attempt", async () => {
    vi.mocked(getSatHistory).mockResolvedValue(ENTRIES);

    render(<HistoryPage />);

    expect(await screen.findByText("Knife Ninja Journey")).toBeInTheDocument();
    expect(screen.getAllByText(/after completing/i)).toHaveLength(1);
    expect(screen.getByText("Reassessed: Knife Skills, Kitchen Safety")).toBeInTheDocument();
  });

  it("shows the reassessed section of a reassessment without a journey", async () => {
    vi.mocked(getSatHistory).mockResolvedValue([
      { ...ENTRIES[1], completedJourney: null, reassessedSections: ["Baking"] },
    ]);

    render(<HistoryPage />);

    expect(await screen.findByText("Reassessed: Baking")).toBeInTheDocument();
    expect(screen.queryByText(/after completing/i)).not.toBeInTheDocument();
  });

  it("lists each instance's module scores under the section they belong to", async () => {
    vi.mocked(getSatHistory).mockResolvedValue([ENTRIES[0]]);

    render(<HistoryPage />);

    const knife = await screen.findByRole("heading", { name: "Section A · Knife Skills" });
    const baking = screen.getByRole("heading", { name: "Section B · Baking" });
    // Each module sits right under its own section's heading.
    expect(within(knife.parentElement!).getByText("Onion Dicing")).toBeInTheDocument();
    expect(within(knife.parentElement!).queryByText("Dough Proofing")).not.toBeInTheDocument();
    expect(within(baking.parentElement!).getByText("Dough Proofing")).toBeInTheDocument();
    expect(within(baking.parentElement!).getByText("1 / 3")).toBeInTheDocument();
  });

  it("shows an empty-state message when nothing's been completed yet", async () => {
    vi.mocked(getSatHistory).mockResolvedValue([]);

    render(<HistoryPage />);

    expect(await screen.findByText(/haven't completed/i)).toBeInTheDocument();
  });

  it("shows an error message instead of crashing when the request fails", async () => {
    vi.mocked(getSatHistory).mockRejectedValue(new Error("network error"));

    render(<HistoryPage />);

    expect(await screen.findByText(/couldn't load your history/i)).toBeInTheDocument();
  });
});
