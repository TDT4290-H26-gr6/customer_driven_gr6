import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeakCompetencesSection } from "./WeakCompetencesSection";
import type { WeakCompetence } from "../types";

describe("WeakCompetencesSection", () => {
  it("shows a positive message instead of a list when nothing is weak", () => {
    render(<WeakCompetencesSection competences={[]} />);

    expect(screen.getByText(/sufficient in every area/i)).toBeInTheDocument();
  });

  it("lists every weak competence with its score and matched journey", () => {
    const competences: WeakCompetence[] = [
      {
        competenceId: "legal",
        competenceName: "Legal",
        score: 3,
        maxScore: 10,
        journey: { id: "journey-legal", name: "Legal Journey", moodleUrl: null },
      },
      {
        competenceId: "open-science",
        competenceName: "Open Science",
        score: 5,
        maxScore: 10,
        journey: null,
      },
    ];

    render(<WeakCompetencesSection competences={competences} />);

    expect(screen.getByText("Legal")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("Covered by: Legal Journey")).toBeInTheDocument();
    expect(screen.getByText("Open Science")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("doesn't show a journey line for a competence with no matching journey", () => {
    render(
      <WeakCompetencesSection
        competences={[
          { competenceId: "a", competenceName: "A", score: 1, maxScore: 5, journey: null },
        ]}
      />,
    );

    expect(screen.queryByText(/covered by/i)).not.toBeInTheDocument();
  });

  it("links the journey to its page in Moodle, in a new tab", () => {
    render(
      <WeakCompetencesSection
        competences={[
          {
            competenceId: "legal",
            competenceName: "Legal",
            score: 3,
            maxScore: 10,
            journey: {
              id: "journey-legal",
              name: "Legal Journey",
              moodleUrl: "https://moodle.example.org/course/view.php?id=2001",
            },
          },
        ]}
      />,
    );

    const link = screen.getByRole("link", { name: /legal journey/i });
    expect(link).toHaveAttribute("href", "https://moodle.example.org/course/view.php?id=2001");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
