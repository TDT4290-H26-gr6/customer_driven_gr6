import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAllFeedback } from "../api";
import { FeedbackAdminPage } from "./FeedbackAdminPage";

vi.mock("../api", () => ({ getAllFeedback: vi.fn() }));

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/admin/feedback"]}>
      <Routes>
        <Route path="/admin/feedback" element={<FeedbackAdminPage />} />
        <Route path="/admin" element={<p>admin mode</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const named = {
  id: "fb-1",
  message: "The chart is hard to read",
  suggestion: "Bigger labels",
  page: "/dashboard",
  rating: 4,
  createdAt: "2026-03-01T12:00:00.000Z",
  learner: { name: "Ada", email: "ada@example.com" },
};
const anonymous = {
  id: "fb-2",
  message: "Typo on the FAQ",
  suggestion: null,
  page: null,
  rating: null,
  createdAt: "2026-02-01T12:00:00.000Z",
  learner: { name: null, email: "zoe@example.com" },
};

beforeEach(() => {
  vi.mocked(getAllFeedback).mockReset();
});

describe("FeedbackAdminPage", () => {
  it("lists every piece of feedback with who sent it, from where, and when", async () => {
    vi.mocked(getAllFeedback).mockResolvedValue([named, anonymous]);
    renderPage();

    expect(await screen.findByText("2 responses")).toBeInTheDocument();
    const [first, second] = within(screen.getByRole("list", { name: "Feedback" })).getAllByRole(
      "listitem",
    );

    expect(within(first).getByText("Ada")).toBeInTheDocument();
    expect(within(first).getByText("ada@example.com")).toBeInTheDocument();
    expect(within(first).getByText("/dashboard")).toBeInTheDocument();
    expect(within(first).getByText("Bigger labels")).toBeInTheDocument();
    expect(first.querySelector("time")).toHaveAttribute("datetime", named.createdAt);
    expect(within(first).getByText("Happy")).toBeInTheDocument();

    // No name: the email stands in, once; no suggestion or page: left out.
    expect(within(second).getAllByText("zoe@example.com")).toHaveLength(1);
    expect(within(second).queryByText("How to improve it")).not.toBeInTheDocument();
  });

  it("sums up satisfaction: the median face, how many ratings, and how many chose each face", async () => {
    vi.mocked(getAllFeedback).mockResolvedValue([
      { ...named, id: "a", rating: 5 },
      { ...named, id: "b", rating: 4 },
      { ...named, id: "c", rating: 1 },
      { ...anonymous, id: "d" }, // no rating: not counted
    ]);
    renderPage();

    const summary = await screen.findByRole("region", { name: "Overall satisfaction" });
    expect(summary).toHaveTextContent("Median: Happy (4 of 5)");
    expect(summary).toHaveTextContent("from 3 ratings");
    const counts = within(summary)
      .getAllByRole("listitem")
      .map((li) => li.textContent?.replace(/\s+/g, " ").trim());
    expect(counts).toEqual([
      "😄Very happy: 1",
      "🙂Happy: 1",
      "😐Neutral: 0",
      "🙁Unhappy: 0",
      "😞Very unhappy: 1",
    ]);
  });

  it("names both faces when the median falls between them", async () => {
    vi.mocked(getAllFeedback).mockResolvedValue([
      { ...named, id: "a", rating: 3 },
      { ...named, id: "b", rating: 4 },
    ]);
    renderPage();
    expect(await screen.findByRole("region", { name: "Overall satisfaction" })).toHaveTextContent(
      "Median: Neutral to Happy (3.5 of 5)",
    );
  });

  it("shows a rating sent without text, and says when nobody has rated yet", async () => {
    vi.mocked(getAllFeedback).mockResolvedValue([{ ...anonymous, message: null, rating: 2 }]);
    renderPage();
    const card = within(await screen.findByRole("list", { name: "Feedback" })).getByRole(
      "listitem",
    );
    expect(within(card).getByText("Unhappy")).toBeInTheDocument();
    expect(within(card).queryByText("What should be improved")).not.toBeInTheDocument();
  });

  it("says so when no feedback has a rating yet", async () => {
    vi.mocked(getAllFeedback).mockResolvedValue([anonymous]);
    renderPage();
    expect(await screen.findByText("No satisfaction ratings yet.")).toBeInTheDocument();
  });

  it("says one response, not one responses", async () => {
    vi.mocked(getAllFeedback).mockResolvedValue([named]);
    renderPage();
    expect(await screen.findByText("1 response")).toBeInTheDocument();
  });

  it("says so when there's no feedback yet", async () => {
    vi.mocked(getAllFeedback).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("No feedback yet.")).toBeInTheDocument();
  });

  it("says so when the feedback can't be loaded", async () => {
    vi.mocked(getAllFeedback).mockRejectedValue(new Error("403"));
    renderPage();
    expect(await screen.findByText("Could not load the feedback.")).toBeInTheDocument();
  });

  it("goes back to admin mode", async () => {
    vi.mocked(getAllFeedback).mockResolvedValue([]);
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Back to admin mode" }));
    expect(screen.getByText("admin mode")).toBeInTheDocument();
  });
});
