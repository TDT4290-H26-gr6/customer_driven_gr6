import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { JourneyCard } from "./JourneyCard";
import type { LearningJourney } from "../types";

const section = (code: string, coverageLevel: "M" | "R" | "S") => ({
  sectionId: `sec-${code}`,
  coverageLevel,
  section: { code, name: `Section ${code}` },
});

const journey: LearningJourney = {
  id: "journey-wp2-lj2",
  name: "LJ2 — Research Data, Reproducibility and AI Practices",
  description:
    "Final applied output: Documented research-data and responsible-AI workflow package.",
  moodleUrl: "https://moodle.example.org/course/view.php?id=2002",
  modules: [{ id: "step-1", order: 1, title: "Plan your data", description: "Write a DMP" }],
  sections: [section("E", "R"), section("A", "M"), section("C", "S"), section("B", "M")],
};

function renderCard() {
  const props = {
    onOpen: vi.fn(),
    onAssess: vi.fn(),
    starting: false,
    assessDisabled: false,
  };
  render(<JourneyCard journey={journey} index={0} {...props} />);
  return props;
}

describe("JourneyCard", () => {
  it("shows the journey code as a badge and the rest of the name as the title", () => {
    renderCard();

    expect(screen.getByText("LJ2")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Research Data, Reproducibility and AI Practices" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Final applied output/)).toBeInTheDocument();
  });

  it("lists the core sections and how many it covers", () => {
    renderCard();

    expect(screen.getByText("A, B")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("opens the details when the card is clicked, and keeps them out of the card itself", async () => {
    const props = renderCard();

    expect(screen.queryByText("What it covers")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan your data")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /view details/i }));

    expect(props.onOpen).toHaveBeenCalledOnce();
  });

  it("assesses the journey and links to it in Moodle from the footer", async () => {
    const props = renderCard();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Assess this journey" }));
    expect(props.onAssess).toHaveBeenCalledOnce();
    expect(props.onOpen).not.toHaveBeenCalled();
    const footer = screen.getByRole("link", { name: /open in moodle/i });
    expect(footer).toHaveAttribute("href", journey.moodleUrl);
    expect(within(footer.parentElement!).getByRole("button")).toBeInTheDocument();
  });
});
