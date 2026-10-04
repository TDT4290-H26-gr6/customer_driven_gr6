import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResultsPage } from "./ResultsPage";
import { getProgress } from "@/features/assessment";

const auth = { learner: { name: "Ada", hasCompletedInitialAssessment: true } };
vi.mock("@/app/providers/AuthProvider", () => ({ useAuth: () => auth }));

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

vi.mock("@/features/assessment", () => ({ getProgress: vi.fn() }));
vi.mock("../api", () => ({ getSectionCompetenceScores: vi.fn().mockResolvedValue([]) }));
vi.mock("@/features/learningJourney", () => ({
  getRecommendedJourney: vi.fn().mockResolvedValue(null),
  RecommendedJourneyCard: () => null,
}));
vi.mock("@/features/advisor", () => ({
  getAdvice: vi.fn().mockResolvedValue(null),
  AdviceCard: () => null,
}));
// jsdom has no matchMedia.
vi.mock("@/shared/hooks/useMediaQuery", () => ({ useMediaQuery: () => false }));
// The radar is an SVG chart with its own tests; not what's under test here.
vi.mock("../components/CompetenceRadar", () => ({ CompetenceRadar: () => null }));

const ongoing = { satInstanceId: "instance-1", responses: [] };

beforeEach(() => {
  vi.clearAllMocks();
  auth.learner.hasCompletedInitialAssessment = true;
});

describe("ResultsPage assessment button", () => {
  it("says 'Assess yourself' when there's no unfinished assessment", async () => {
    vi.mocked(getProgress).mockResolvedValue(null);
    render(<ResultsPage />);
    expect(await screen.findByRole("button", { name: "Assess yourself" })).toBeInTheDocument();
  });

  it("says 'Continue assessment' while a retake is unfinished", async () => {
    vi.mocked(getProgress).mockResolvedValue(ongoing);
    render(<ResultsPage />);
    expect(await screen.findByRole("button", { name: "Continue assessment" })).toBeInTheDocument();
  });

  it("falls back to 'Assess yourself' when progress can't be loaded", async () => {
    vi.mocked(getProgress).mockRejectedValue({ status: 0, message: "offline" });
    render(<ResultsPage />);
    expect(await screen.findByRole("button", { name: "Assess yourself" })).toBeInTheDocument();
  });

  it("says 'Continue assessment' on the welcome screen for an unfinished first assessment", async () => {
    auth.learner.hasCompletedInitialAssessment = false;
    vi.mocked(getProgress).mockResolvedValue(ongoing);
    render(<ResultsPage />);
    expect(await screen.findByRole("button", { name: "Continue assessment" })).toBeInTheDocument();
    expect(screen.getByText(/your answers are saved/i)).toBeInTheDocument();
  });

  it("says 'Take self assessment' on the welcome screen before a first start", async () => {
    auth.learner.hasCompletedInitialAssessment = false;
    vi.mocked(getProgress).mockResolvedValue(null);
    render(<ResultsPage />);
    expect(await screen.findByRole("button", { name: "Take self assessment" })).toBeInTheDocument();
  });
});
