import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteAccountSection } from "./DeleteAccountSection";
import { cancelAccountDeletion, scheduleAccountDeletion, type Learner } from "@/features/auth";
import { useAuth } from "@/app/providers/AuthProvider";

vi.mock("@/features/auth", () => ({
  scheduleAccountDeletion: vi.fn(),
  cancelAccountDeletion: vi.fn(),
}));

const updateLearner = vi.fn();
vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

function signedInAs(deletionScheduledFor: string | null) {
  const learner = { id: "learner-1", deletionScheduledFor } as Learner;
  vi.mocked(useAuth).mockReturnValue({ learner, updateLearner } as never);
  return learner;
}

beforeEach(() => {
  vi.clearAllMocks();
  signedInAs(null);
});

describe("DeleteAccountSection", () => {
  it("doesn't call the API until the confirmation step is confirmed", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    await user.click(screen.getByRole("button", { name: /^delete account$/i }));

    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    expect(scheduleAccountDeletion).not.toHaveBeenCalled();
  });

  it("cancel dismisses the confirmation without deleting anything", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    await user.click(screen.getByRole("button", { name: /^delete account$/i }));
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
    expect(scheduleAccountDeletion).not.toHaveBeenCalled();
  });

  it("schedules the deletion on confirm and updates the session", async () => {
    const scheduled = { id: "learner-1", deletionScheduledFor: "2026-12-01T00:00:00.000Z" };
    vi.mocked(scheduleAccountDeletion).mockResolvedValue(scheduled as Learner);
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    await user.click(screen.getByRole("button", { name: /^delete account$/i }));
    await user.click(screen.getByRole("button", { name: /yes, delete my account/i }));

    await vi.waitFor(() => expect(updateLearner).toHaveBeenCalledWith(scheduled));
  });

  it("shows an error when scheduling fails", async () => {
    vi.mocked(scheduleAccountDeletion).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    await user.click(screen.getByRole("button", { name: /^delete account$/i }));
    await user.click(screen.getByRole("button", { name: /yes, delete my account/i }));

    expect(await screen.findByText(/could not delete/i)).toBeInTheDocument();
    expect(updateLearner).not.toHaveBeenCalled();
  });

  it("shows the date of a pending deletion and lets the learner cancel it", async () => {
    signedInAs("2026-12-01T00:00:00.000Z");
    const cancelled = { id: "learner-1", deletionScheduledFor: null };
    vi.mocked(cancelAccountDeletion).mockResolvedValue(cancelled as Learner);
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    expect(screen.getByText("1 Dec 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^delete account$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel deletion/i }));
    expect(cancelAccountDeletion).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /yes, keep my account/i }));

    await vi.waitFor(() => expect(updateLearner).toHaveBeenCalledWith(cancelled));
  });

  it("'Back' leaves the deletion scheduled", async () => {
    signedInAs("2026-12-01T00:00:00.000Z");
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    await user.click(screen.getByRole("button", { name: /cancel deletion/i }));
    expect(screen.getByText(/keep your account\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^back$/i }));

    expect(screen.queryByText(/keep your account\?/i)).not.toBeInTheDocument();
    expect(cancelAccountDeletion).not.toHaveBeenCalled();
  });

  it("shows an error when cancelling fails", async () => {
    signedInAs("2026-12-01T00:00:00.000Z");
    vi.mocked(cancelAccountDeletion).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    await user.click(screen.getByRole("button", { name: /cancel deletion/i }));
    await user.click(screen.getByRole("button", { name: /yes, keep my account/i }));

    expect(await screen.findByText(/could not cancel/i)).toBeInTheDocument();
  });
});
