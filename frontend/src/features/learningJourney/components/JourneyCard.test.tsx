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

function renderCard(expanded = false) {
  const props = {
    onToggle: vi.fn(),
    onAssess: vi.fn(),
    starting: false,
    assessDisabled: false,
  };
  render(<JourneyCard journey={journey} index={0} expanded={expanded} {...props} />);
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

  it("shows each section's coverage, core first, and the steps in the popup when expanded", () => {
    renderCard(true);

    const rows = screen
      .getAllByRole("listitem")
      .filter((li) => li.textContent?.includes("Section"));
    expect(rows.map((r) => r.textContent)).toEqual([
      "ASection ACore",
      "BSection BCore",
      "ESection ERecommended",
      "CSection CSelective",
    ]);
    expect(screen.getByText("Plan your data")).toBeInTheDocument();
  });

  it("hides the details until expanded", () => {
    renderCard(false);
    expect(screen.queryByText("What it covers")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /read more/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("assesses the journey and links to it in Moodle from the footer", async () => {
    const props = renderCard();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Assess this journey" }));
    expect(props.onAssess).toHaveBeenCalledOnce();
    expect(props.onToggle).not.toHaveBeenCalled();
    const footer = screen.getByRole("link", { name: /open in moodle/i });
    expect(footer).toHaveAttribute("href", journey.moodleUrl);
    expect(within(footer.parentElement!).getByRole("button")).toBeInTheDocument();
  });

  it("shows the details as a dialog only when expanded", () => {
    renderCard(true);

    const dialog = screen.getByRole("dialog", {
      name: "Research Data, Reproducibility and AI Practices",
    });
    expect(within(dialog).getByText("What it covers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /read more/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("doesn't render a dialog while collapsed", () => {
    renderCard(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes with the X, Escape or a click outside, but not a click inside", async () => {
    const props = renderCard(true);
    const user = userEvent.setup();
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByText("What it covers"));
    expect(props.onToggle).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.keyboard("{Escape}");
    await user.click(dialog.parentElement!);
    expect(props.onToggle).toHaveBeenCalledTimes(3);
  });

  it("can start the assessment from inside the dialog", async () => {
    const props = renderCard(true);
    const user = userEvent.setup();

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Assess this journey" }),
    );
    expect(props.onAssess).toHaveBeenCalledOnce();
  });
});
