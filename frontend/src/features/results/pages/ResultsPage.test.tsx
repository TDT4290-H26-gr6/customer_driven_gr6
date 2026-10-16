import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResultsPage } from "./ResultsPage";
import { getProgress } from "@/features/assessment";
import { getRecommendedJourneys } from "@/features/learningJourney";
import { getAdvice } from "@/features/advisor";
import { getDashboardProgress } from "../api";
import type { DashboardProgress } from "../types";

const auth = {
  learner: { name: "Ada", hasCompletedInitialAssessment: true, hasCompletedProfile: true },
};
vi.mock("@/app/providers/AuthProvider", () => ({ useAuth: () => auth }));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  Navigate: ({ to }: { to: string }) => <p>redirected to {to}</p>,
}));

vi.mock("@/features/assessment", () => ({ getProgress: vi.fn() }));
vi.mock("../api", () => ({ getDashboardProgress: vi.fn() }));
vi.mock("@/features/learningJourney", () => ({
  getRecommendedJourneys: vi.fn().mockResolvedValue(null),
  // Shows what the dashboard hands the component: which journeys, in what
  // order, labelled how, and why.
  RecommendedJourneys: ({
    ranked,
    source,
  }: {
    ranked: { journey: { name: string }; reason: string | null }[];
    source: string;
  }) => (
    <p>
      journeys [{source}]:{" "}
      {ranked.map((r) => `${r.journey.name}${r.reason ? ` (${r.reason})` : ""}`).join(" > ")}
    </p>
  ),
}));
vi.mock("@/features/advisor", () => ({
  getAdvice: vi.fn().mockResolvedValue(null),
  AdviceCard: () => null,
}));
// jsdom has no matchMedia.
vi.mock("@/shared/hooks/useMediaQuery", () => ({ useMediaQuery: () => false }));
// The radar is an SVG chart with its own tests; here we only check what it's given.
vi.mock("../components/CompetenceRadar", () => ({
  CompetenceRadar: ({ compare }: { compare?: unknown }) => (
    <p>{compare ? "radar with comparison" : "radar"}</p>
  ),
}));

const ongoing = { satInstanceId: "instance-1", journey: null, responses: [] };

const oneAssessment: DashboardProgress = {
  latest: { instanceNum: 1, completedAt: "2026-09-20T10:00:00.000Z" },
  previous: null,
  sections: [
    {
      section: { id: "sec-a", code: "A", name: "Research data" },
      levelCount: 4,
      latest: { instanceNum: 1, score: 4, maxScore: 10, level: 1 },
      previous: null,
    },
  ],
};

const twoAssessments: DashboardProgress = {
  latest: { instanceNum: 2, completedAt: "2026-10-03T10:00:00.000Z" },
  previous: { instanceNum: 1, completedAt: "2026-09-20T10:00:00.000Z" },
  sections: [
    {
      section: { id: "sec-a", code: "A", name: "Research data" },
      levelCount: 4,
      latest: { instanceNum: 2, score: 7, maxScore: 10, level: 2 },
      previous: { instanceNum: 1, score: 4, maxScore: 10, level: 1 },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDashboardProgress).mockResolvedValue(oneAssessment);
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

describe("ResultsPage results", () => {
  beforeEach(() => {
    vi.mocked(getProgress).mockResolvedValue(null);
  });

  it("after one assessment, shows its results without a comparison", async () => {
    render(<ResultsPage />);

    expect(await screen.findByText("radar")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your results by section" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Chart legend")).not.toBeInTheDocument();
  });

  it("after two assessments, overlays both on the radar and shows the progress", async () => {
    vi.mocked(getDashboardProgress).mockResolvedValue(twoAssessments);
    render(<ResultsPage />);

    expect(await screen.findByText("radar with comparison")).toBeInTheDocument();
    const legend = screen.getByLabelText("Chart legend");
    expect(legend).toHaveTextContent("Assessment 2 (latest)");
    expect(legend).toHaveTextContent("Assessment 1");
    expect(screen.getByRole("heading", { name: "Your progress" })).toBeInTheDocument();
    expect(screen.getByText(/changed since last time/i)).toBeInTheDocument();
  });

  it("says so when the results can't be loaded, and still offers a retake", async () => {
    vi.mocked(getDashboardProgress).mockRejectedValue({ status: 0, message: "offline" });
    render(<ResultsPage />);

    expect(await screen.findByText(/couldn't load your scores/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /your progress|your results/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retake assessment" })).toBeInTheDocument();
  });
});

describe("ResultsPage recommended journeys", () => {
  const journeyOf = (name: string) => ({
    id: name,
    name,
    description: null,
    moodleUrl: null,
    modules: [],
  });
  const adviceRanking = (...picks: [string, string | null][]) => ({
    summary: "ok",
    steps: [],
    journeys: picks.map(([name, reason]) => ({ journey: journeyOf(name), reason })),
    model: "test",
    generatedAt: "2026-10-12T10:00:00.000Z",
  });

  beforeEach(() => {
    vi.mocked(getProgress).mockResolvedValue(null);
    vi.mocked(getRecommendedJourneys).mockResolvedValue({
      source: "recommended",
      journeys: [journeyOf("LJ3 — Education"), journeyOf("LJ1 — Officer")],
    });
  });

  it("shows the AI's ranking of two, on scores and profile, with reasons", async () => {
    vi.mocked(getAdvice).mockResolvedValue(
      adviceRanking(
        ["LJ2 — Research Data", "Built for data stewards."],
        ["LJ1 — Officer", "Broader."],
      ),
    );

    render(<ResultsPage />);

    expect(
      await screen.findByText(
        "journeys [recommended]: LJ2 — Research Data (Built for data stewards.) > LJ1 — Officer (Broader.)",
      ),
    ).toBeInTheDocument();
  });

  it("tops up an older one-journey AI pick with the score-based next best", async () => {
    vi.mocked(getAdvice).mockResolvedValue(adviceRanking(["LJ1 — Officer", "Fits."]));

    render(<ResultsPage />);

    expect(
      await screen.findByText("journeys [recommended]: LJ1 — Officer (Fits.) > LJ3 — Education"),
    ).toBeInTheDocument();
  });

  it("shows the score-based two while the AI advice is unavailable", async () => {
    vi.mocked(getAdvice).mockRejectedValue({ status: 503, message: "unavailable" });

    render(<ResultsPage />);

    expect(
      await screen.findByText("journeys [recommended]: LJ3 — Education > LJ1 — Officer"),
    ).toBeInTheDocument();
  });

  it("keeps the 'to keep improving' label when nothing was weak", async () => {
    vi.mocked(getRecommendedJourneys).mockResolvedValue({
      source: "suggested",
      journeys: [journeyOf("LJ1 — Officer")],
    });
    vi.mocked(getAdvice).mockResolvedValue(adviceRanking(["LJ6 — Policy", null]));

    render(<ResultsPage />);

    expect(
      await screen.findByText("journeys [suggested]: LJ6 — Policy > LJ1 — Officer"),
    ).toBeInTheDocument();
  });

  it("shows no journeys when there are none to recommend", async () => {
    vi.mocked(getRecommendedJourneys).mockResolvedValue(null);
    vi.mocked(getAdvice).mockResolvedValue(null);

    render(<ResultsPage />);

    await screen.findByText("radar");
    expect(screen.queryByText(/^journeys/)).not.toBeInTheDocument();
  });
});
