import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toast, TOAST_FADE_MS, TOAST_VISIBLE_MS } from "./Toast";

describe("Toast", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("fades after five seconds, then closes", () => {
    const onClose = vi.fn();
    render(<Toast title="Partial assessment completed." onClose={onClose} />);
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Partial assessment completed.");

    act(() => vi.advanceTimersByTime(TOAST_VISIBLE_MS));
    expect(toast.className).toMatch(/fading/);
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(TOAST_FADE_MS));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("can be closed at any time with the ×", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Toast title="Done" onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onClose).toHaveBeenCalledOnce();
    // The timer that would have closed it later doesn't close it twice.
    act(() => vi.advanceTimersByTime(TOAST_VISIBLE_MS + TOAST_FADE_MS));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("is a button when it has an action, which runs it and closes", async () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <Toast
        title="Assessment completed."
        action={{ label: "How was it? Give feedback", onAction }}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole("button", { name: /give feedback/i }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays while the pointer is on it, so reaching for it doesn't lose it", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Toast title="Done" onClose={onClose} />);
    await user.hover(screen.getByRole("status"));
    act(() => vi.advanceTimersByTime(TOAST_VISIBLE_MS * 3));
    expect(onClose).not.toHaveBeenCalled();

    await user.unhover(screen.getByRole("status"));
    act(() => vi.advanceTimersByTime(TOAST_VISIBLE_MS + TOAST_FADE_MS));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
