import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SectionDetailsPage } from "./SectionDetailsPage";
import { getSectionCompetenceScores, getSkillLevels } from "../api";

vi.mock("../api", () => ({
  getSectionCompetenceScores: vi.fn(),
  getSkillLevels: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
// jsdom has no matchMedia.
vi.mock("@/shared/hooks/useMediaQuery", () => ({ useMediaQuery: () => false }));
// The radar is an SVG chart with its own tests; not what's under test here.
vi.mock("../components/CompetenceRadar", () => ({ CompetenceRadar: () => null }));

const sections = [
  {
    section: { id: "sec-a", code: "A", name: "Knife Skills" },
    assessed: true,
    assessedAt: "2026-10-01T12:00:00.000Z",
    competences: [],
  },
  {
    section: { id: "sec-b", code: "B", name: "Baking" },
    assessed: true,
    assessedAt: "2026-10-01T12:00:00.000Z",
    competences: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSectionCompetenceScores).mockResolvedValue(sections);
});

describe("SectionDetailsPage", () => {
  it("shows each section's skill level in a box under its radar", async () => {
    vi.mocked(getSkillLevels).mockResolvedValue([
      { section: { id: "sec-a", code: "A", name: "Knife Skills" }, level: 2, levelCount: 4 },
      { section: { id: "sec-b", code: "B", name: "Baking" }, level: 0, levelCount: 4 },
    ]);

    render(<SectionDetailsPage />);

    const knife = await screen.findByRole("region", { name: "Knife Skills" });
    expect(await within(knife).findByText("A2")).toBeInTheDocument();
    const baking = screen.getByRole("region", { name: "Baking" });
    expect(within(baking).getByText("Not yet at B1")).toBeInTheDocument();
  });

  it("shows when each section's scores were taken, and no date for an untouched one", async () => {
    vi.mocked(getSectionCompetenceScores).mockResolvedValue([
      {
        section: { id: "sec-a", code: "A", name: "Knife Skills" },
        assessed: true,
        assessedAt: "2026-03-05T12:00:00.000Z",
        competences: [],
      },
      {
        section: { id: "sec-b", code: "B", name: "Baking" },
        assessed: true,
        assessedAt: "2026-01-20T12:00:00.000Z",
        competences: [],
      },
      {
        section: { id: "sec-c", code: "C", name: "Sauces" },
        assessed: false,
        assessedAt: null,
        competences: [],
      },
    ]);
    vi.mocked(getSkillLevels).mockResolvedValue([]);
    const format = (iso: string) =>
      new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(iso));

    render(<SectionDetailsPage />);

    const knife = await screen.findByRole("region", { name: "Knife Skills" });
    expect(
      within(knife).getByText(`Assessed ${format("2026-03-05T12:00:00.000Z")}`),
    ).toBeInTheDocument();
    const baking = screen.getByRole("region", { name: "Baking" });
    expect(
      within(baking).getByText(`Assessed ${format("2026-01-20T12:00:00.000Z")}`),
    ).toBeInTheDocument();
    const sauces = screen.getByRole("region", { name: "Sauces" });
    expect(within(sauces).queryByText(/^Assessed /)).not.toBeInTheDocument();
  });

  it("shows an untouched section too, marked as not assessed yet", async () => {
    vi.mocked(getSectionCompetenceScores).mockResolvedValue([
      ...sections,
      {
        section: { id: "sec-c", code: "C", name: "Sauces" },
        assessed: false,
        assessedAt: null,
        competences: [],
      },
    ]);
    vi.mocked(getSkillLevels).mockResolvedValue([]);

    render(<SectionDetailsPage />);

    const sauces = await screen.findByRole("region", { name: "Sauces" });
    expect(within(sauces).getByText("Not assessed yet")).toBeInTheDocument();
  });

  it("still shows the radars when the levels fail to load", async () => {
    vi.mocked(getSkillLevels).mockRejectedValue({ status: 0, message: "offline" });

    render(<SectionDetailsPage />);

    expect(await screen.findByRole("region", { name: "Knife Skills" })).toBeInTheDocument();
    expect(screen.queryByText("Your skill level")).not.toBeInTheDocument();
  });
});
