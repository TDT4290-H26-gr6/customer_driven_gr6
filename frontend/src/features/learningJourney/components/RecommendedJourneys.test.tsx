import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecommendedJourneys, type RankedJourney } from "./RecommendedJourneys";

const ranked = (
  name: string,
  reason: string | null,
  moodleUrl: string | null = null,
): RankedJourney => ({
  journey: {
    id: name,
    name,
    description: "Final applied output: a plan.",
    moodleUrl,
    modules: [{ id: `${name}-1`, order: 1, title: "First step", description: null }],
  },
  reason,
});

const best = ranked("LJ2 - Research Data", "Built for data stewards.", "https://moodle.test/lj2");
const second = ranked("LJ1 - Officer", "Broader, institution-wide.", "https://moodle.test/lj1");

describe("RecommendedJourneys", () => {
  it("highlights the best fit, and shows the runner-up second, smaller", () => {
    render(<RecommendedJourneys ranked={[best, second]} source="recommended" />);

    const first = screen.getByText("★ Best fit for you").closest("li")!;
    expect(first).toHaveTextContent("★ Best fit for you");
    expect(within(first).getByRole("heading", { name: "LJ2 - Research Data" })).toBeInTheDocument();
    expect(first).toHaveTextContent("Why it fits you best: Built for data stewards.");
    expect(within(first).getByText("First step")).toBeInTheDocument();

    const runnerUpCard = screen.getByText("Also a good fit").closest("li")!;
    expect(runnerUpCard).not.toBe(first);
    expect(
      within(runnerUpCard).getByRole("heading", { name: "LJ1 - Officer" }),
    ).toBeInTheDocument();
    expect(runnerUpCard).toHaveTextContent("Broader, institution-wide.");
    // The runner-up stays compact: no step list.
    expect(within(runnerUpCard).queryByText("First step")).not.toBeInTheDocument();
  });

  it("links both to Moodle, the best fit as a button-style link", () => {
    render(<RecommendedJourneys ranked={[best, second]} source="recommended" />);

    const links = screen.getAllByRole("link", { name: /open in moodle/i });
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "https://moodle.test/lj2",
      "https://moodle.test/lj1",
    ]);
    for (const link of links) expect(link).toHaveAttribute("target", "_blank");
  });

  it("labels the pair by why they're recommended", () => {
    const { rerender } = render(<RecommendedJourneys ranked={[best]} source="recommended" />);
    expect(screen.getByRole("heading", { name: "Recommended for you" })).toBeInTheDocument();

    rerender(<RecommendedJourneys ranked={[best]} source="suggested" />);
    expect(screen.getByRole("heading", { name: "To keep improving" })).toBeInTheDocument();
  });

  it("shows just the best fit when there's only one, and no reason line without a reason", () => {
    render(<RecommendedJourneys ranked={[ranked("LJ5 - Business", null)]} source="recommended" />);

    expect(screen.getByText("★ Best fit for you")).toBeInTheDocument();
    expect(screen.queryByText("Also a good fit")).not.toBeInTheDocument();
    expect(screen.queryByText(/why it fits you best/i)).not.toBeInTheDocument();
  });

  it("renders nothing without journeys", () => {
    const { container } = render(<RecommendedJourneys ranked={[]} source="recommended" />);
    expect(container).toBeEmptyDOMElement();
  });
});
