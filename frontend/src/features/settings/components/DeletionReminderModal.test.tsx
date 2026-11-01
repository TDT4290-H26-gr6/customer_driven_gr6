import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeletionReminderModal } from "./DeletionReminderModal";
import { cancelAccountDeletion, getToken, type Learner } from "@/features/auth";
import { useAuth } from "@/app/providers/AuthProvider";

vi.mock("@/features/auth", () => ({
  cancelAccountDeletion: vi.fn(),
  getToken: vi.fn(),
}));

const updateLearner = vi.fn();
vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

function signedInAs(deletionScheduledFor: string | null) {
  const learner = { id: "learner-1", deletionScheduledFor } as Learner;
  vi.mocked(useAuth).mockReturnValue({ learner, updateLearner } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Only the clock: real timers keep userEvent working.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T12:00:00.000Z"));
  vi.mocked(getToken).mockReturnValue("header.payload.signature-of-session-1");
  signedInAs("2026-12-01T00:00:00.000Z");
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

describe("DeletionReminderModal", () => {
  it("asks whether the learner still wants the pending deletion", () => {
    render(<DeletionReminderModal />);

    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Your account is scheduled for deletion in 30 days",
    );
    expect(screen.getByText("Do you still want to delete your account?")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Do not remind me again" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "No, keep my account" })).toHaveFocus();
  });

  it.each([
    ["2026-11-01T18:00:00.000Z", "in 1 day"],
    ["2026-11-01T00:30:00.000Z", "today"],
  ])("counts down to the deletion (%s → %s)", (scheduledFor, expected) => {
    signedInAs(scheduledFor);
    render(<DeletionReminderModal />);
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      `Your account is scheduled for deletion ${expected}`,
    );
  });

  it("shows nothing when no deletion is pending", () => {
    signedInAs(null);
    render(<DeletionReminderModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancels the deletion when the learner keeps their account, and confirms it", async () => {
    const kept = { id: "learner-1", deletionScheduledFor: null } as Learner;
    vi.mocked(cancelAccountDeletion).mockResolvedValue(kept);
    const user = userEvent.setup();
    const { rerender } = render(<DeletionReminderModal />);

    await user.click(screen.getByRole("button", { name: "No, keep my account" }));

    expect(updateLearner).toHaveBeenCalledWith(kept);
    // The session now has no deletion pending; the confirmation stays up anyway.
    vi.mocked(useAuth).mockReturnValue({ learner: kept, updateLearner } as never);
    rerender(<DeletionReminderModal />);
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Your account will not be deleted");
    expect(screen.getByRole("status")).toHaveTextContent(/the deletion has been cancelled/i);
    expect(screen.getByRole("button", { name: "OK" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays open with an error when cancelling fails", async () => {
    vi.mocked(cancelAccountDeletion).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<DeletionReminderModal />);

    await user.click(screen.getByRole("button", { name: "No, keep my account" }));

    expect(await screen.findByText(/could not cancel/i)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it.each([
    [
      "Yes",
      (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole("button", { name: "Yes, delete it" })),
    ],
    ["Escape", (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}")],
  ])("%s closes it and leaves the deletion scheduled", async (_, answer) => {
    const user = userEvent.setup();
    render(<DeletionReminderModal />);

    await answer(user);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(cancelAccountDeletion).not.toHaveBeenCalled();
  });

  it("doesn't ask again after a reload in the same session, but does after a new sign-in", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DeletionReminderModal />);
    await user.click(screen.getByRole("button", { name: "Yes, delete it" }));
    unmount();

    // Reload: same session token.
    const reload = render(<DeletionReminderModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    reload.unmount();

    // Signed in again: a new token.
    vi.mocked(getToken).mockReturnValue("header.payload.signature-of-session-2");
    render(<DeletionReminderModal />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("never asks again about this deletion after 'Do not remind me again'", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DeletionReminderModal />);
    await user.click(screen.getByRole("checkbox", { name: "Do not remind me again" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete it" }));
    unmount();

    // A new sign-in: still not asked.
    vi.mocked(getToken).mockReturnValue("header.payload.signature-of-session-2");
    const later = render(<DeletionReminderModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    later.unmount();

    // A different deletion (cancelled, then scheduled again): asked again.
    signedInAs("2027-02-01T00:00:00.000Z");
    vi.mocked(getToken).mockReturnValue("header.payload.signature-of-session-3");
    render(<DeletionReminderModal />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    localStorage.clear();
  });
});
