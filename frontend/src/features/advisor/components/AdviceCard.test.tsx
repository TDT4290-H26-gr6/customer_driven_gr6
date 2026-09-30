import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdviceCard } from "./AdviceCard";
import type { Advice } from "../types";

const advice: Advice = {
  summary: "Your biggest gap is data management. Start with the FAIR foundations journey.",
  steps: [
    {
      kind: "module",
      title: "Intro to FAIR",
      url: null,
      reason: "Covers your weakest area.",
    },
    {
      kind: "source",
      title: "Research Data Management (NTNU)",
      url: "https://moodle.example.org/course/view.php?id=101",
      reason: "Goes deeper on data management plans.",
    },
  ],
  model: "openai/gpt-oss-120b",
  generatedAt: "2026-09-30T10:00:00.000Z",
};

describe("AdviceCard", () => {
  it("says it's working while the advice loads", () => {
    render(<AdviceCard state={{ status: "loading" }} />);

    expect(screen.getByRole("status")).toHaveTextContent(/preparing advice/i);
  });

  it("shows the summary and each step with its reason", () => {
    render(<AdviceCard state={{ status: "ready", advice }} />);

    expect(screen.getByText(/biggest gap is data management/i)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Journey step")).toBeInTheDocument();
    expect(screen.getByText("Covers your weakest area.")).toBeInTheDocument();
  });

  it("links a step with a URL, opening in a new tab", () => {
    render(<AdviceCard state={{ status: "ready", advice }} />);

    const link = screen.getByRole("link", { name: "Research Data Management (NTNU)" });
    expect(link).toHaveAttribute("href", advice.steps[1].url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    // No URL, no link.
    expect(screen.queryByRole("link", { name: "Intro to FAIR" })).not.toBeInTheDocument();
  });

  it("always labels the advice as AI-generated", () => {
    render(<AdviceCard state={{ status: "ready", advice }} />);

    expect(screen.getByText(/written by an ai model/i)).toBeInTheDocument();
  });

  it("explains when advice isn't available", () => {
    render(<AdviceCard state={{ status: "unavailable" }} />);

    expect(screen.getByText(/isn't available right now/i)).toBeInTheDocument();
  });
});
