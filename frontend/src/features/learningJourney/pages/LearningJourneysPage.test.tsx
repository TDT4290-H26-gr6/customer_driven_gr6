import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LearningJourneysPage } from "./LearningJourneysPage";
import { listJourneys, startJourneyAssessment } from "../api";
import type { LearningJourney } from "../types";

vi.mock("../api", () => ({
  listJourneys: vi.fn(),
  startJourneyAssessment: vi.fn(),
}));

const navigate = vi.fn();
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));

beforeEach(() => {
  vi.clearAllMocks();
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
