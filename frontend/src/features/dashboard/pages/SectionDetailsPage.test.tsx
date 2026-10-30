import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SectionDetailsPage } from "./SectionDetailsPage";
import { getSectionCompetenceScores } from "../api";
import { getSatHistory, type SatHistoryEntry } from "@/features/history";
import type { AttemptScores } from "../types";
import { DATE_FORMAT } from "@/shared/lib/format";

vi.mock("../api", () => ({ getSectionCompetenceScores: vi.fn() }));
vi.mock("@/features/history", () => ({ getSatHistory: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

function attempt(
  instanceNum: number,
  completedAt: string,
  journey: string | null = null,
  reassessedSections: string[] = [],
) {
  return {
    instanceNum,
    completedAt,
    sumScore: 0,
    sumMaxScore: 0,
    sections: [],
    completedJourney: journey,
    reassessedSections,
  } satisfies SatHistoryEntry;
}

const FIRST = "2026-01-20T12:00:00.000Z";
const SECOND = "2026-03-05T12:00:00.000Z";

const scoresOf: Record<number, AttemptScores> = {
  1: {
    instanceNum: 1,
    completedAt: FIRST,
    sections: [
      {
        section: { id: "sec-a", code: "A", name: "Knife Skills" },
        assessed: true,
        level: 1,
        levelCount: 4,
        competences: [{ competence: { name: "Chopping" }, score: 1, maxScore: 4 }],
      },
      {
        section: { id: "sec-b", code: "B", name: "Baking" },
        assessed: true,
        level: 0,
        levelCount: 4,
        competences: [{ competence: { name: "Proofing" }, score: 2, maxScore: 4 }],
      },
    ],
  },
  2: {
    instanceNum: 2,
    completedAt: SECOND,
    sections: [
      {
        section: { id: "sec-a", code: "A", name: "Knife Skills" },
        assessed: true,
        level: 3,
        levelCount: 4,
        competences: [{ competence: { name: "Chopping" }, score: 3, maxScore: 4 }],
      },
      {
        section: { id: "sec-b", code: "B", name: "Baking" },
        assessed: false,
        level: null,
        levelCount: 4,
        competences: [],
      },
    ],
  },
};

const format = (iso: string) => DATE_FORMAT.format(new Date(iso));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSatHistory).mockResolvedValue([
    attempt(1, FIRST),
    attempt(2, SECOND, "Knife Ninja Journey"),
  ]);
  vi.mocked(getSectionCompetenceScores).mockImplementation(async (n) => scoresOf[n!]);
});

describe("SectionDetailsPage", () => {
  it("has a tab per assessment, Assessment 1 first, with the latest selected", async () => {
    render(<SectionDetailsPage />);

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Assessment 1", "Assessment 2"]);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
    await waitFor(() => expect(getSectionCompetenceScores).toHaveBeenCalledWith(2));
  });

  it("marks a partial reassessment's tab and names the sections it was limited to", async () => {
    vi.mocked(getSatHistory).mockResolvedValue([
      attempt(1, FIRST),
      attempt(2, SECOND, null, ["Baking"]),
    ]);

    render(<SectionDetailsPage />);

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Assessment 1", "Assessment 2 (partial)"]);
    expect(await screen.findByText("Partial reassessment — limited to: Baking")).toBeInTheDocument();
  });

  it("heads the selected assessment with its date and, for a retake, the journey", async () => {
    render(<SectionDetailsPage />);

    expect(
      await screen.findByRole("heading", { name: `Date taken: ${format(SECOND)}` }),
    ).toBeInTheDocument();
    expect(screen.getByText("Knife Ninja Journey")).toBeInTheDocument();
  });

  it("shows only that assessment's sections and levels, untouched ones as not assessed", async () => {
    render(<SectionDetailsPage />);

    const knife = await screen.findByRole("region", { name: "Knife Skills" });
    expect(within(knife).getByText("Level 3 of 4 passed")).toBeInTheDocument();
    const baking = screen.getByRole("region", { name: "Baking" });
    expect(within(baking).getByText("Not assessed yet")).toBeInTheDocument();
  });

  it("switches to an earlier assessment, which keeps its own results", async () => {
    const user = userEvent.setup();
    render(<SectionDetailsPage />);
    await screen.findByRole("region", { name: "Knife Skills" });

    await user.click(screen.getByRole("tab", { name: "Assessment 1" }));

    expect(
      await screen.findByRole("heading", { name: `Date taken: ${format(FIRST)}` }),
    ).toBeInTheDocument();
    const knife = await screen.findByRole("region", { name: "Knife Skills" });
    expect(await within(knife).findByText("Level 1 of 4 passed")).toBeInTheDocument();
    const baking = screen.getByRole("region", { name: "Baking" });
    expect(within(baking).getByText("Level 1 not yet passed")).toBeInTheDocument();
    expect(screen.queryByText("Knife Ninja Journey")).not.toBeInTheDocument();
  });

  it("doesn't refetch an assessment it already loaded", async () => {
    const user = userEvent.setup();
    render(<SectionDetailsPage />);
    await screen.findByRole("region", { name: "Knife Skills" });

    await user.click(screen.getByRole("tab", { name: "Assessment 1" }));
    await screen.findByText("Level 1 not yet passed");
    await user.click(screen.getByRole("tab", { name: "Assessment 2" }));
    await screen.findByText("Level 3 of 4 passed");

    expect(getSectionCompetenceScores).toHaveBeenCalledTimes(2);
  });

  it("lists the other assessments in Compare with, by number only", async () => {
    render(<SectionDetailsPage />);
    await screen.findByRole("region", { name: "Knife Skills" });

    const options = within(screen.getByLabelText("Compare with")).getAllByRole("option");
    // A blank "no comparison" option, then every assessment but the one shown.
    expect(options.map((o) => o.textContent)).toEqual(["", "Assessment 1"]);
  });

  it("offers no comparison with only one assessment", async () => {
    vi.mocked(getSatHistory).mockResolvedValue([attempt(1, FIRST)]);
    render(<SectionDetailsPage />);

    await screen.findByRole("region", { name: "Knife Skills" });
    expect(screen.queryByLabelText("Compare with")).not.toBeInTheDocument();
  });

  it("compares with another assessment: both scores per competence, the level box unchanged", async () => {
    const user = userEvent.setup();
    render(<SectionDetailsPage />);
    const knife = await screen.findByRole("region", { name: "Knife Skills" });
    expect(within(knife).getByText("Chopping").closest("li")).not.toHaveTextContent("→");

    await user.selectOptions(screen.getByLabelText("Compare with"), "1");

    // "was% → is%": Assessment 1 (compared with) scored 25%, Assessment 2 (shown) 75%.
    await waitFor(() =>
      expect(within(knife).getByText("Chopping").closest("li")).toHaveTextContent("25% → 75%"),
    );
    // The level box stays about the selected assessment only.
    expect(within(knife).getByText("Level 3 of 4 passed")).toBeInTheDocument();
    expect(getSectionCompetenceScores).toHaveBeenCalledWith(1);
  });

  it("shows the other assessment's score for a competence this one didn't assess", async () => {
    const user = userEvent.setup();
    render(<SectionDetailsPage />);
    const baking = await screen.findByRole("region", { name: "Baking" });

    await user.selectOptions(screen.getByLabelText("Compare with"), "1");

    // Assessment 2 (shown) never assessed Baking, so Proofing has no score of its own.
    await waitFor(() =>
      expect(within(baking).getByText("Proofing").closest("li")).toHaveTextContent("50% → –"),
    );
    expect(within(baking).getByText("Not assessed yet")).toBeInTheDocument();
  });

  it("shows no comparison for a section the compared assessment didn't assess", async () => {
    const user = userEvent.setup();
    render(<SectionDetailsPage />);
    await screen.findByRole("region", { name: "Knife Skills" });
    await user.click(screen.getByRole("tab", { name: "Assessment 1" }));
    await screen.findByText("Level 1 not yet passed");

    await user.selectOptions(screen.getByLabelText("Compare with"), "2");

    // Knife Skills was assessed in both, so it gets a comparison; Baking wasn't in 2.
    const knife = screen.getByRole("region", { name: "Knife Skills" });
    await waitFor(() =>
      expect(within(knife).getByText("Chopping").closest("li")).toHaveTextContent("75% → 25%"),
    );
    const baking = screen.getByRole("region", { name: "Baking" });
    const proofing = within(baking).getByText("Proofing").closest("li");
    expect(proofing).toHaveTextContent("50%");
    expect(proofing).not.toHaveTextContent("→");
  });

  it("stops comparing when switching to the assessment being compared with", async () => {
    const user = userEvent.setup();
    render(<SectionDetailsPage />);
    await screen.findByRole("region", { name: "Knife Skills" });
    await user.selectOptions(screen.getByLabelText("Compare with"), "1");
    await waitFor(() => expect(screen.getByText("Chopping").closest("li")).toHaveTextContent("→"));

    await user.click(screen.getByRole("tab", { name: "Assessment 1" }));

    expect(screen.getByLabelText("Compare with")).toHaveValue("");
    await screen.findByText("Level 1 not yet passed");
    expect(screen.getByText("Chopping").closest("li")).not.toHaveTextContent("→");
  });

  it("says so when nothing has been assessed yet", async () => {
    vi.mocked(getSatHistory).mockResolvedValue([]);
    render(<SectionDetailsPage />);

    expect(await screen.findByText(/no section has been assessed yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("says so when the assessments can't be loaded", async () => {
    vi.mocked(getSatHistory).mockRejectedValue({ status: 0, message: "offline" });
    render(<SectionDetailsPage />);

    expect(await screen.findByText(/couldn't load your scores/i)).toBeInTheDocument();
  });
});
