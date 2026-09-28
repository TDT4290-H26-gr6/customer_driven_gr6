import { render, screen } from "@testing-library/react";
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
    areas: [
      { name: "Open Science", score: 3, maxScore: 3 },
      { name: "Data Management", score: 1, maxScore: 3 },
    ],
  },
  {
    instanceNum: 2,
    completedAt: "2026-02-15T00:00:00.000Z",
    sumScore: 5,
    sumMaxScore: 6,
    areas: [
      { name: "Open Science", score: 2, maxScore: 3 },
      { name: "Data Management", score: 3, maxScore: 3 },
    ],
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

  it("shows each instance's own area breakdown", async () => {
    vi.mocked(getSatHistory).mockResolvedValue(ENTRIES);

    render(<HistoryPage />);

    expect(await screen.findAllByText("Open Science")).toHaveLength(2);
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
