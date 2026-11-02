import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LearningJourneysPage } from "./LearningJourneysPage";
import { getJourneyHistory, listJourneys, startJourneyAssessment } from "../api";
import type { JourneyHistoryEntry, LearningJourney } from "../types";

vi.mock("../api", () => ({
  listJourneys: vi.fn(),
  startJourneyAssessment: vi.fn(),
  getJourneyHistory: vi.fn(),
}));

const navigate = vi.fn();
let locationState: unknown = null;
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: "/journeys", state: locationState }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  locationState = null;
  vi.mocked(getJourneyHistory).mockResolvedValue([]);
});

const section = (code: string, coverageLevel: "M" | "R" | "S") => ({
  sectionId: `sec-${code}`,
  coverageLevel,
  section: { code, name: `Section ${code}` },
});

const JOURNEYS: LearningJourney[] = [
  {
    id: "journey-1",
    name: "Open Science Foundations",
    description: "Start here.",
    modules: [],
    sections: [section("D", "M"), section("A", "M"), section("B", "R"), section("E", "S")],
  },
  {
    id: "journey-2",
    name: "Legal Deep Dive",
    description: null,
    modules: [{ id: "mod-1", order: 1, title: "GDPR basics", description: null }],
    sections: [section("C", "R")],
  },
];

describe("LearningJourneysPage", () => {
  it("lists every journey as a card, with the core sections assessing it covers", async () => {
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);

    render(<LearningJourneysPage />);

    const first = (await screen.findByText("Open Science Foundations")).closest("article")!;
    expect(first).toHaveTextContent("Core sectionsA, D");
    expect(screen.getByText("Legal Deep Dive")).toBeInTheDocument();
  });

  it("opens a journey's details in a modal, and closes it again", async () => {
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);
    const user = userEvent.setup();

    render(<LearningJourneysPage />);
    const card = (await screen.findAllByRole("button", { name: /view details/i }))[1];
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(card);
    const dialog = screen.getByRole("dialog", { name: "Legal Deep Dive" });
    expect(dialog).toHaveTextContent("What it covers");
    expect(dialog).toHaveTextContent("GDPR basics");

    await user.click(screen.getByRole("button", { name: "Close journey" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(card).toHaveFocus();
  });

  it("opens the requested journey's modal on arrival, then clears it from history", async () => {
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);
    locationState = { openJourneyId: "journey-2" };

    render(<LearningJourneysPage />);

    expect(await screen.findByRole("dialog", { name: "Legal Deep Dive" })).toBeInTheDocument();
    expect(navigate).toHaveBeenCalledWith("/journeys", { replace: true, state: null });
  });

  it("starts the assessment from the modal and closes it", async () => {
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);
    vi.mocked(startJourneyAssessment).mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<LearningJourneysPage />);
    await user.click((await screen.findAllByRole("button", { name: /view details/i }))[0]);
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Assess this journey" }));

    expect(startJourneyAssessment).toHaveBeenCalledWith("journey-1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/assessment"));
  });

  it("starts a journey assessment and goes to the assessment", async () => {
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);
    vi.mocked(startJourneyAssessment).mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<LearningJourneysPage />);
    const [first] = await screen.findAllByRole("button", { name: "Assess this journey" });
    await user.click(first);

    expect(startJourneyAssessment).toHaveBeenCalledWith("journey-1");
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/assessment"));
  });

  it("can't assess a journey with no core (M) sections", async () => {
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);

    render(<LearningJourneysPage />);

    const buttons = await screen.findAllByRole("button", { name: "Assess this journey" });
    expect(buttons[0]).toBeEnabled();
    expect(buttons[1]).toBeDisabled();
  });

  it("explains, and offers to continue, when another assessment is in progress", async () => {
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);
    vi.mocked(startJourneyAssessment).mockRejectedValue({ status: 409, message: "busy" });
    const user = userEvent.setup();

    render(<LearningJourneysPage />);
    const [first] = await screen.findAllByRole("button", { name: "Assess this journey" });
    await user.click(first);

    expect(await screen.findByRole("alert")).toHaveTextContent(/assessment in progress/i);
    await user.click(screen.getByRole("button", { name: "Continue assessment" }));
    expect(navigate).toHaveBeenCalledWith("/assessment");
  });

  it("shows a message with a retry when loading fails", async () => {
    vi.mocked(listJourneys)
      .mockRejectedValueOnce({ status: 0, message: "offline" })
      .mockResolvedValueOnce(JOURNEYS);
    const user = userEvent.setup();

    render(<LearningJourneysPage />);
    expect(await screen.findByText(/couldn't load the journeys/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Open Science Foundations")).toBeInTheDocument();
  });
});

const HISTORY_ENTRY: JourneyHistoryEntry = {
  instanceNum: 1,
  completedAt: "2026-02-15T00:00:00.000Z",
  journeyName: "Open Science Foundations",
  sumScore: 5,
  sumMaxScore: 6,
  sections: [
    {
      code: "A",
      name: "Knife Skills",
      areas: [{ name: "Onion Dicing", score: 2, maxScore: 3 }],
    },
    {
      code: "D",
      name: "Data Management",
      areas: [{ name: "FAIR Principles", score: 3, maxScore: 3 }],
    },
  ],
};

describe("LearningJourneysPage's History tab", () => {
  it("doesn't fetch the history until the History tab is opened", async () => {
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);
    const user = userEvent.setup();

    render(<LearningJourneysPage />);
    await screen.findByText("Open Science Foundations");
    expect(getJourneyHistory).not.toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: "History" }));
    await user.click(screen.getByRole("tab", { name: "Overview" }));
    await user.click(screen.getByRole("tab", { name: "History" }));
    expect(getJourneyHistory).toHaveBeenCalledOnce();
  });

  it("lists every past journey attempt, most recent first, numbered per journey", async () => {
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);
    const later = { ...HISTORY_ENTRY, instanceNum: 2, completedAt: "2026-03-15T00:00:00.000Z" };
    const other = {
      ...HISTORY_ENTRY,
      instanceNum: 3,
      completedAt: "2026-04-15T00:00:00.000Z",
      journeyName: "Legal Deep Dive",
    };
    vi.mocked(getJourneyHistory).mockResolvedValue([HISTORY_ENTRY, later, other]);
    const user = userEvent.setup();

    render(<LearningJourneysPage />);
    await user.click(await screen.findByRole("tab", { name: "History" }));

    const headings = await screen.findAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "Legal Deep Dive · attempt 1",
      "Open Science Foundations · attempt 2",
      "Open Science Foundations · attempt 1",
    ]);
  });

  it("shows each attempt's score breakdown", async () => {
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);
    const later = { ...HISTORY_ENTRY, instanceNum: 2, completedAt: "2026-03-15T00:00:00.000Z" };
    vi.mocked(getJourneyHistory).mockResolvedValue([HISTORY_ENTRY, later]);
    const user = userEvent.setup();

    render(<LearningJourneysPage />);
    await user.click(await screen.findByRole("tab", { name: "History" }));

    expect(await screen.findAllByText("5 / 6")).toHaveLength(2);
    expect(screen.getAllByText("5 / 6")).toHaveLength(2);
    expect(screen.getAllByText("(83%)")).toHaveLength(2);
    expect(screen.getAllByText("Section A · Knife Skills")).toHaveLength(2);
    expect(screen.getAllByText("Onion Dicing")).toHaveLength(2);
  });

  it("opens on the History tab when navigated here with that tab requested", async () => {
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);
    vi.mocked(getJourneyHistory).mockResolvedValue([HISTORY_ENTRY]);
    locationState = { tab: "history" };

    render(<LearningJourneysPage />);

    expect(await screen.findByText("Open Science Foundations · attempt 1")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows an empty-state message when no journey has been assessed on its own yet", async () => {
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);
    vi.mocked(getJourneyHistory).mockResolvedValue([]);
    const user = userEvent.setup();

    render(<LearningJourneysPage />);
    await user.click(await screen.findByRole("tab", { name: "History" }));

    expect(await screen.findByText(/haven't assessed a learning journey/i)).toBeInTheDocument();
  });

  it("shows a message with a retry when loading the journey history fails", async () => {
    vi.mocked(listJourneys).mockResolvedValue(JOURNEYS);
    vi.mocked(getJourneyHistory)
      .mockRejectedValueOnce({ status: 0, message: "offline" })
      .mockResolvedValueOnce([HISTORY_ENTRY]);
    const user = userEvent.setup();

    render(<LearningJourneysPage />);
    await user.click(await screen.findByRole("tab", { name: "History" }));
    expect(await screen.findByText(/couldn't load your journey history/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Open Science Foundations · attempt 1")).toBeInTheDocument();
  });
});
