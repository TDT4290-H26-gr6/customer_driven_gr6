import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompetenciesPage } from "./CompetenciesPage";
import { getCompetencies } from "../api";
import type { Competencies, CompetencyModule, CompetencySection } from "../types";

vi.mock("../api", () => ({ getCompetencies: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

const moduleOf = (overrides: Partial<CompetencyModule>): CompetencyModule => ({
  id: "mod",
  code: "A1",
  name: "A1 — Intro",
  moodleUrl: null,
  relevant: false,
  best: null,
  ...overrides,
});

const DATA: Competencies = {
  recommendedJourney: { id: "journey-2", name: "LJ2 — Research Data", moodleUrl: null },
  sections: [
    {
      id: "sec-b",
      code: "B",
      name: "Repositories",
      relevant: true,
      percent: 80,
      assessedModules: 1,
      moduleCount: 2,
      modules: [
        moduleOf({
          id: "mod-b1",
          code: "B1",
          name: "B1 — Repositories",
          relevant: true,
          moodleUrl: "https://moodle.test/b1",
          best: {
            percent: 80,
            completedAt: "2026-10-05T10:00:00.000Z",
            kind: "journey",
            journeyName: "LJ2 — Research Data",
          },
        }),
        moduleOf({ id: "mod-b2", code: "B2", name: "B2 — Storage", relevant: true }),
      ],
    },
    {
      id: "sec-a",
      code: "A",
      name: "Fundamentals",
      relevant: false,
      percent: 50,
      assessedModules: 1,
      moduleCount: 1,
      modules: [
        moduleOf({
          id: "mod-a1",
          best: {
            percent: 50,
            completedAt: "2026-10-01T10:00:00.000Z",
            kind: "main",
            journeyName: null,
          },
        }),
      ],
    },
  ],
};

function sectionOf(letter: string): CompetencySection {
  return {
    id: `sec-${letter}`,
    code: letter,
    name: `Section ${letter}`,
    relevant: false,
    percent: null,
    assessedModules: 0,
    moduleCount: 0,
    modules: [],
  };
}

const FIVE_SECTIONS: Competencies = {
  recommendedJourney: null,
  sections: ["A", "B", "C", "D", "E"].map(sectionOf),
};

describe("CompetenciesPage", () => {
  it("puts the recommended journey's modules at the top", async () => {
    vi.mocked(getCompetencies).mockResolvedValue(DATA);

    render(<CompetenciesPage />);

    const relevant = await screen.findByRole("region", { name: "LJ2 — Research Data" });
    expect(within(relevant).getByText("B1 — Repositories")).toBeInTheDocument();
    expect(within(relevant).getByText("B2 — Storage")).toBeInTheDocument();
    expect(within(relevant).queryByText("A1 — Intro")).not.toBeInTheDocument();
  });

  it("shows each section's percentage and how many modules have a result", async () => {
    vi.mocked(getCompetencies).mockResolvedValue(DATA);

    render(<CompetenciesPage />);

    const sectionB = await screen.findByRole("region", { name: "Repositories" });
    expect(within(sectionB).getAllByText("80%").length).toBeGreaterThan(0);
    expect(within(sectionB).getByText("1 of 2 modules assessed")).toBeInTheDocument();
  });

  it("says where each module's best result came from, or that it isn't assessed yet", async () => {
    vi.mocked(getCompetencies).mockResolvedValue(DATA);

    render(<CompetenciesPage />);

    const sectionB = await screen.findByRole("region", { name: "Repositories" });
    expect(
      within(sectionB).getByText("Best: LJ2 — Research Data assessment, 5 Oct 2026"),
    ).toBeInTheDocument();
    expect(within(sectionB).getByText("Not assessed yet")).toBeInTheDocument();
    const sectionA = screen.getByRole("region", { name: "Fundamentals" });
    expect(within(sectionA).getByText("Best: Self-assessment, 1 Oct 2026")).toBeInTheDocument();
  });

  it("links a module to its page in Moodle", async () => {
    vi.mocked(getCompetencies).mockResolvedValue(DATA);

    render(<CompetenciesPage />);

    const sectionB = await screen.findByRole("region", { name: "Repositories" });
    expect(within(sectionB).getByRole("link", { name: /open in moodle/i })).toHaveAttribute(
      "href",
      "https://moodle.test/b1",
    );
  });

  it("invites the learner to get results when there are none yet", async () => {
    vi.mocked(getCompetencies).mockResolvedValue({
      recommendedJourney: null,
      sections: DATA.sections.map((s) => ({
        ...s,
        relevant: false,
        percent: null,
        assessedModules: 0,
        modules: s.modules.map((m) => ({ ...m, relevant: false, best: null })),
      })),
    });

    render(<CompetenciesPage />);

    expect(await screen.findByText(/no results yet/i)).toBeInTheDocument();
    expect(screen.queryByText("Most relevant for you")).not.toBeInTheDocument();
  });

  it("says so when it can't load", async () => {
    vi.mocked(getCompetencies).mockRejectedValue({ status: 0, message: "offline" });

    render(<CompetenciesPage />);

    expect(await screen.findByText(/couldn't load your competencies/i)).toBeInTheDocument();
  });

  it("labels every score in words as well as colour, and gives each section a ring", async () => {
    vi.mocked(getCompetencies).mockResolvedValue(DATA);

    render(<CompetenciesPage />);

    const sectionB = await screen.findByRole("region", { name: "Repositories" });
    expect(within(sectionB).getByText("Good")).toBeInTheDocument(); // B1: 80%
    expect(within(sectionB).getByRole("img", { name: "80%, good" })).toBeInTheDocument();
    const sectionA = screen.getByRole("region", { name: "Fundamentals" });
    expect(within(sectionA).getByText("Weak")).toBeInTheDocument(); // A1: 50%
    expect(within(sectionA).getByRole("img", { name: "50%, weak" })).toBeInTheDocument();
  });

  it("shows no arrow buttons when there are 3 sections or fewer", async () => {
    vi.mocked(getCompetencies).mockResolvedValue(DATA);

    render(<CompetenciesPage />);

    await screen.findByRole("region", { name: "Repositories" });
    expect(screen.queryByRole("button", { name: "Next section" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous section" })).not.toBeInTheDocument();
  });

  it("starts at the first section with Previous disabled", async () => {
    vi.mocked(getCompetencies).mockResolvedValue(FIVE_SECTIONS);

    render(<CompetenciesPage />);
    await screen.findByRole("region", { name: "Section A" });

    expect(screen.getByRole("button", { name: "Previous section" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next section" })).toBeEnabled();
  });

  it("stops at the last section instead of wrapping around", async () => {
    vi.mocked(getCompetencies).mockResolvedValue(FIVE_SECTIONS);
    const user = userEvent.setup();

    render(<CompetenciesPage />);
    await screen.findByRole("region", { name: "Section A" });

    const next = screen.getByRole("button", { name: "Next section" });
    // 5 sections, 3 shown at a time: 2 steps reaches the end.
    await user.click(next);
    await user.click(next);

    expect(next).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous section" })).toBeEnabled();

    // Already disabled; clicking again doesn't do anything further.
    await user.click(next);
    expect(next).toBeDisabled();
  });

  it("steps back with Previous until it's disabled at the start again", async () => {
    vi.mocked(getCompetencies).mockResolvedValue(FIVE_SECTIONS);
    const user = userEvent.setup();

    render(<CompetenciesPage />);
    await screen.findByRole("region", { name: "Section A" });

    const next = screen.getByRole("button", { name: "Next section" });
    await user.click(next);
    await user.click(next);
    const prev = screen.getByRole("button", { name: "Previous section" });
    await user.click(prev);
    await user.click(prev);

    expect(prev).toBeDisabled();
    expect(next).toBeEnabled();
  });
});
