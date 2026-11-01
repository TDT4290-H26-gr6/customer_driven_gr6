import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { JourneyModal } from "./JourneyModal";
import type { LearningJourney } from "../types";

const section = (code: string, coverageLevel: "M" | "R" | "S") => ({
  sectionId: `sec-${code}`,
  coverageLevel,
  section: { code, name: `Section ${code}` },
});

const journey: LearningJourney = {
  id: "journey-wp2-lj2",
  name: "LJ2 - Research Data, Reproducibility and AI Practices",
  description: "Final applied output: a documented workflow package.",
  moodleUrl: "https://moodle.example.org/course/view.php?id=2002",
  modules: [{ id: "step-1", order: 1, title: "Plan your data", description: "Write a DMP" }],
  sections: [section("E", "R"), section("A", "M"), section("C", "S"), section("B", "M")],
};

function renderModal(overrides: Partial<Parameters<typeof JourneyModal>[0]> = {}) {
  const props = {
    journey,
    index: 0,
    onClose: vi.fn(),
    onAssess: vi.fn(),
    starting: false,
    assessDisabled: false,
    ...overrides,
  };
  render(<JourneyModal {...props} />);
  return props;
}

describe("JourneyModal", () => {
  it("shows the journey in full: code, title, description and facts", () => {
    renderModal();

    const dialog = screen.getByRole("dialog", {
      name: "Research Data, Reproducibility and AI Practices",
    });
    expect(within(dialog).getByText("LJ2")).toBeInTheDocument();
    expect(within(dialog).getByText(/documented workflow package/)).toBeInTheDocument();
    expect(within(dialog).getByText("A, B")).toBeInTheDocument();
  });

  it("lists each section's coverage, core first, and the steps", () => {
    renderModal();

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

  it("has the assess and Moodle actions", async () => {
    const props = renderModal();

    await userEvent.click(screen.getByRole("button", { name: "Assess this journey" }));

    expect(props.onAssess).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: /open in moodle/i })).toHaveAttribute(
      "href",
      journey.moodleUrl,
    );
  });

  it("disables assessing when asked to, and shows when it is starting", () => {
    renderModal({ assessDisabled: true, starting: true });
    expect(screen.getByRole("button", { name: "Starting…" })).toBeDisabled();
  });

  it("closes with the X, with Escape and with a click outside it, but not from inside", async () => {
    const props = renderModal();
    const user = userEvent.setup();

    await user.click(screen.getByText("Plan your data"));
    expect(props.onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Close journey" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("presentation"));
    expect(props.onClose).toHaveBeenCalledTimes(3);
  });

  it("puts focus on the close button and keeps Tab inside", async () => {
    const user = userEvent.setup();
    renderModal();
    const close = screen.getByRole("button", { name: "Close journey" });
    expect(close).toHaveFocus();

    screen.getByRole("link", { name: /open in moodle/i }).focus();
    await user.tab();
    expect(close).toHaveFocus();
  });
});
