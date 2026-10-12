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

  it("is labelled as recommended by default", () => {
    render(<RecommendedJourneyCard journey={journey} />);
    expect(screen.getByText("Recommended for you")).toBeInTheDocument();
  });

  it("labels a suggestion as one to keep improving with", () => {
    render(<RecommendedJourneyCard journey={journey} source="suggested" />);
    expect(screen.getByText("To keep improving")).toBeInTheDocument();
  });

  it("shows why the journey was chosen, when there's a reason", () => {
    render(<RecommendedJourneyCard journey={journey} reason="It centres on research data." />);
    expect(screen.getByText(/why this journey/i).parentElement).toHaveTextContent(
      "Why this journey: It centres on research data.",
    );
  });

  it("shows no reason line without one", () => {
    render(<RecommendedJourneyCard journey={journey} />);
    expect(screen.queryByText(/why this journey/i)).not.toBeInTheDocument();
  });
});
