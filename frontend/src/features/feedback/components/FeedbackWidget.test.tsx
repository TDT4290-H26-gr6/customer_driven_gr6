import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackWidget } from "./FeedbackWidget";
import { sendFeedback } from "../api";

vi.mock("../api", () => ({
  sendFeedback: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderWidget(path = "/results") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <FeedbackWidget />
    </MemoryRouter>,
  );
}

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /feedback/i }));
  return screen.getByRole("dialog", { name: /share your feedback/i });
}

describe("FeedbackWidget", () => {
  it("opens the form with the first field focused", async () => {
    const user = userEvent.setup();
    renderWidget();

    await openForm(user);

    expect(screen.getByLabelText(/what should be improved/i)).toHaveFocus();
  });

  it("can't be sent until something is written", async () => {
    const user = userEvent.setup();
    renderWidget();
    await openForm(user);

    const send = screen.getByRole("button", { name: /send feedback/i });
    expect(send).toBeDisabled();

    await user.type(screen.getByLabelText(/what should be improved/i), "   ");
    expect(send).toBeDisabled();
  });

  it("sends trimmed text with the current page, then thanks the tester", async () => {
    vi.mocked(sendFeedback).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWidget("/results/details");
    await openForm(user);

    await user.type(screen.getByLabelText(/what should be improved/i), "  Chart is hard to read ");
    await user.type(screen.getByLabelText(/how would you improve it/i), "Bigger labels");
    await user.click(screen.getByRole("button", { name: /send feedback/i }));

    expect(sendFeedback).toHaveBeenCalledWith({
      message: "Chart is hard to read",
      suggestion: "Bigger labels",
      page: "/results/details",
    });
    expect(await screen.findByRole("dialog", { name: /thank you/i })).toBeInTheDocument();
  });

  it("sends a blank suggestion as null", async () => {
    vi.mocked(sendFeedback).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWidget();
    await openForm(user);

    await user.type(screen.getByLabelText(/what should be improved/i), "Slow");
    await user.click(screen.getByRole("button", { name: /send feedback/i }));

    expect(sendFeedback).toHaveBeenCalledWith({
      message: "Slow",
      suggestion: null,
      page: "/results",
    });
  });

  it("keeps the text and shows an error when sending fails", async () => {
    vi.mocked(sendFeedback).mockRejectedValue({ status: 0, message: "offline" });
    const user = userEvent.setup();
    renderWidget();
    await openForm(user);

    await user.type(screen.getByLabelText(/what should be improved/i), "Slow");
    await user.click(screen.getByRole("button", { name: /send feedback/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not send/i);
    expect(screen.getByLabelText(/what should be improved/i)).toHaveValue("Slow");
  });

  it("closes on Escape, keeps the draft, and returns focus to the button", async () => {
    const user = userEvent.setup();
    renderWidget();
    await openForm(user);
    await user.type(screen.getByLabelText(/what should be improved/i), "Half-written");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /feedback/i })).toHaveFocus();

    await openForm(user);
    expect(screen.getByLabelText(/what should be improved/i)).toHaveValue("Half-written");
  });

  it("starts empty again after feedback was sent", async () => {
    vi.mocked(sendFeedback).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWidget();
    await openForm(user);
    await user.type(screen.getByLabelText(/what should be improved/i), "Slow");
    await user.click(screen.getByRole("button", { name: /send feedback/i }));
    await screen.findByRole("dialog", { name: /thank you/i });

    await user.click(screen.getByRole("button", { name: /^close$/i }));
    await openForm(user);

    await waitFor(() => expect(screen.getByLabelText(/what should be improved/i)).toHaveValue(""));
  });
});
