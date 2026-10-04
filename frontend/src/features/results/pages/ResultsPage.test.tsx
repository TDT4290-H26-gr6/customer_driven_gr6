import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResultsPage } from "./ResultsPage";
import { getProgress } from "@/features/assessment";

const auth = {
  learner: { name: "Ada", hasCompletedInitialAssessment: true, hasCompletedProfile: true },
};
vi.mock("@/app/providers/AuthProvider", () => ({ useAuth: () => auth }));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  Navigate: ({ to }: { to: string }) => <p>redirected to {to}</p>,
}));

vi.mock("@/features/assessment", () => ({ getProgress: vi.fn() }));
vi.mock("../api", () => ({ getSectionCompetenceScores: vi.fn().mockResolvedValue(null) }));
vi.mock("@/features/learningJourney", () => ({
  getCurrentJourney: vi.fn().mockResolvedValue(null),
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
  auth.learner.hasCompletedProfile = true;
});

describe("ResultsPage profile step", () => {
  it("sends a new learner to fill in their profile before the welcome screen", () => {
    auth.learner.hasCompletedInitialAssessment = false;
    auth.learner.hasCompletedProfile = false;
    vi.mocked(getProgress).mockResolvedValue(null);
    render(<ResultsPage />);
    expect(screen.getByText("redirected to /profile")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Take self assessment" })).not.toBeInTheDocument();
  });

  it("keeps a returning learner on their dashboard even without a complete profile", async () => {
    auth.learner.hasCompletedProfile = false;
    vi.mocked(getProgress).mockResolvedValue(null);
    render(<ResultsPage />);
    expect(await screen.findByRole("button", { name: "Retake assessment" })).toBeInTheDocument();
  });
});

describe("ResultsPage assessment button", () => {
  it("says 'Retake assessment' when there's no unfinished assessment", async () => {
    vi.mocked(getProgress).mockResolvedValue(null);
    render(<ResultsPage />);
    expect(await screen.findByRole("button", { name: "Retake assessment" })).toBeInTheDocument();
  });

  it("says 'Continue assessment' while a retake is unfinished", async () => {
    vi.mocked(getProgress).mockResolvedValue(ongoing);
    render(<ResultsPage />);
    expect(await screen.findByRole("button", { name: "Continue assessment" })).toBeInTheDocument();
  });

  it("falls back to 'Retake assessment' when progress can't be loaded", async () => {
    vi.mocked(getProgress).mockRejectedValue({ status: 0, message: "offline" });
    render(<ResultsPage />);
    expect(await screen.findByRole("button", { name: "Retake assessment" })).toBeInTheDocument();
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
