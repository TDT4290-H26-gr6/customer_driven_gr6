import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LearningJourneysPage } from "./LearningJourneysPage";
import { listJourneys, getSelectedJourney, selectJourney } from "../api";
import type { LearningJourney } from "../types";

vi.mock("../api", () => ({
  listJourneys: vi.fn(),
  getSelectedJourney: vi.fn(),
  selectJourney: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const JOURNEYS: LearningJourney[] = [
  { id: "journey-1", name: "Open Science Foundations", description: "Start here.", modules: [] },
  {
    id: "journey-2",
    name: "Legal Deep Dive",
    description: null,
    modules: [{ id: "mod-1", order: 1, title: "GDPR basics", description: null }],
  },
];

describe("LearningJourneysPage", () => {
  it("lists every journey, not just the recommended one", async () => {
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);
    vi.mocked(getSelectedJourney).mockResolvedValue(null);

    render(<LearningJourneysPage />);

    expect(await screen.findByText("Open Science Foundations")).toBeInTheDocument();
    expect(screen.getByText("Legal Deep Dive")).toBeInTheDocument();
    expect(screen.getByText("GDPR basics")).toBeInTheDocument();
  });

  it("marks the currently-selected journey and disables its own select button", async () => {
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);
    vi.mocked(getSelectedJourney).mockResolvedValue(JOURNEYS[0]);

    render(<LearningJourneysPage />);
    await screen.findByText("Open Science Foundations");

    expect(screen.getByText("Selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /currently selected/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^select this journey$/i })).toBeEnabled();
  });

  it("selects a journey on click and marks it selected once it resolves", async () => {
    const user = userEvent.setup();
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);
    vi.mocked(getSelectedJourney).mockResolvedValue(null);
    vi.mocked(selectJourney).mockResolvedValue(JOURNEYS[1]);

    render(<LearningJourneysPage />);
    await screen.findByText("Legal Deep Dive");

    await user.click(screen.getAllByRole("button", { name: /^select this journey$/i })[1]);

    expect(selectJourney).toHaveBeenCalledWith("journey-2");
    expect(await screen.findByText("Selected")).toBeInTheDocument();
  });

  it("shows an error, not a crash, when selecting fails", async () => {
    const user = userEvent.setup();
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);
    vi.mocked(getSelectedJourney).mockResolvedValue(null);
    vi.mocked(selectJourney).mockRejectedValue(new Error("network error"));

    render(<LearningJourneysPage />);
    await screen.findByText("Open Science Foundations");

    await user.click(screen.getAllByRole("button", { name: /^select this journey$/i })[0]);

    expect(await screen.findByText(/couldn't save your choice/i)).toBeInTheDocument();
  });

  it("shows an empty-state message when there are no journeys", async () => {
    vi.mocked(listJourneys).mockResolvedValue([]);
    vi.mocked(getSelectedJourney).mockResolvedValue(null);

    render(<LearningJourneysPage />);

    expect(await screen.findByText(/no learning journeys/i)).toBeInTheDocument();
  });

  it("shows an error message instead of crashing when loading fails", async () => {
    vi.mocked(listJourneys).mockRejectedValue(new Error("network error"));
    vi.mocked(getSelectedJourney).mockResolvedValue(null);

    render(<LearningJourneysPage />);

    expect(await screen.findByText(/couldn't load the journeys/i)).toBeInTheDocument();
  });
});
