import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecommendedJourneyCard } from "./RecommendedJourneyCard";
import type { LearningJourney } from "../types";

const journey: LearningJourney = {
  id: "journey-wp2-lj2",
  name: "LJ2 — Research Data, Reproducibility and AI Practices",
  description:
    "Final applied output: Documented research-data and responsible-AI workflow package.",
  moodleUrl: "https://moodle.example.org/course/view.php?id=2002",
  modules: [],
};

describe("RecommendedJourneyCard", () => {
  it("links to the journey in Moodle, in a new tab", () => {
    render(<RecommendedJourneyCard journey={journey} />);

    const link = screen.getByRole("link", { name: /open in moodle/i });
    expect(link).toHaveAttribute("href", journey.moodleUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows no Moodle link for a journey without one", () => {
    render(<RecommendedJourneyCard journey={{ ...journey, moodleUrl: null }} />);

    expect(screen.queryByRole("link", { name: /open in moodle/i })).not.toBeInTheDocument();
  });

  it("says whether the learner chose the journey or it was recommended", () => {
    const { rerender } = render(<RecommendedJourneyCard journey={journey} />);
    expect(screen.getByText("Recommended for you")).toBeInTheDocument();

    rerender(<RecommendedJourneyCard journey={journey} source="selected" />);
    expect(screen.getByText("Your journey")).toBeInTheDocument();
  });
});
