import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FaqPage, filterFaq } from "./FaqPage";
import { FAQ } from "../faqContent";

describe("FaqPage", () => {
  it("shows every topic, with its questions collapsed", () => {
    render(<FaqPage />);

    for (const category of FAQ) {
      expect(screen.getByRole("heading", { name: category.title })).toBeInTheDocument();
    }
    const question = screen.getByText("What is AIOS?");
    expect(question.closest("details")).not.toHaveAttribute("open");
  });

  it("opens a question to show its answer", async () => {
    const user = userEvent.setup();
    render(<FaqPage />);

    await user.click(screen.getByText("How do I delete my account?"));

    expect(screen.getByText("How do I delete my account?").closest("details")).toHaveAttribute(
      "open",
    );
    expect(screen.getByText(/permanently deletes your account/i)).toBeVisible();
  });

  it("filters to matching questions, opened, as you type", async () => {
    const user = userEvent.setup();
    render(<FaqPage />);

    await user.type(screen.getByRole("searchbox", { name: /search the questions/i }), "moodle");

    expect(screen.getByText("A link to Moodle doesn't open the course. Why?")).toBeInTheDocument();
    expect(screen.queryByText("How do I delete my account?")).not.toBeInTheDocument();
    expect(
      screen.getByText("A link to Moodle doesn't open the course. Why?").closest("details"),
    ).toHaveAttribute("open");
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    render(<FaqPage />);

    await user.type(screen.getByRole("searchbox"), "zzqx");

    expect(screen.getByRole("status")).toHaveTextContent('No questions match "zzqx"');
  });
});

describe("filterFaq", () => {
  it("matches questions and answers, case-insensitively, needing every word", () => {
    const hits = filterFaq(FAQ, "DELETE everything").flatMap((c) =>
      c.entries.map((e) => e.question),
    );
    expect(hits).toEqual(["How do I delete my account?"]);
  });

  it("returns everything for an empty search, and drops empty topics", () => {
    expect(filterFaq(FAQ, "   ")).toBe(FAQ);
    expect(filterFaq(FAQ, "retake").every((c) => c.entries.length > 0)).toBe(true);
  });
});

describe("FAQ content", () => {
  it("has a unique question and a non-empty answer for every entry", () => {
    const questions = FAQ.flatMap((c) => c.entries.map((e) => e.question));
    expect(new Set(questions).size).toBe(questions.length);
    for (const entry of FAQ.flatMap((c) => c.entries)) {
      expect(entry.answer.length).toBeGreaterThan(0);
      for (const paragraph of entry.answer) expect(paragraph.trim()).not.toBe("");
    }
  });
});
