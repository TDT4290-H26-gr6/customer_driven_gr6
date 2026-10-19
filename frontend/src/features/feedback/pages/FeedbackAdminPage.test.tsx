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
  createdAt: "2026-03-01T12:00:00.000Z",
  learner: { name: "Ada", email: "ada@example.com" },
};
const anonymous = {
  id: "fb-2",
  message: "Typo on the FAQ",
  suggestion: null,
  page: null,
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
    const [first, second] = screen.getAllByRole("listitem");

    expect(within(first).getByText("Ada")).toBeInTheDocument();
    expect(within(first).getByText("ada@example.com")).toBeInTheDocument();
    expect(within(first).getByText("/dashboard")).toBeInTheDocument();
    expect(within(first).getByText("Bigger labels")).toBeInTheDocument();
    expect(first.querySelector("time")).toHaveAttribute("datetime", named.createdAt);

    // No name: the email stands in, once; no suggestion or page: left out.
    expect(within(second).getAllByText("zoe@example.com")).toHaveLength(1);
    expect(within(second).queryByText("How to improve it")).not.toBeInTheDocument();
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
