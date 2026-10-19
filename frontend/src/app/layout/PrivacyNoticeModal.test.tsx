import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacyNoticeModal } from "./PrivacyNoticeModal";

const updateLearner = vi.fn();
const acceptPrivacyNotice = vi.fn();

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ updateLearner }),
}));
vi.mock("@/features/auth", () => ({
  acceptPrivacyNotice: () => acceptPrivacyNotice(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PrivacyNoticeModal", () => {
  it("shows the notice as a modal dialog with an I understand button", () => {
    render(<PrivacyNoticeModal />);

    expect(screen.getByRole("dialog", { name: "Privacy notice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I understand" })).toBeInTheDocument();
  });

  it("saves the acknowledgement and updates the learner on click", async () => {
    const updated = { id: "l1", hasAcceptedPrivacyNotice: true };
    acceptPrivacyNotice.mockResolvedValue(updated);
    render(<PrivacyNoticeModal />);

    await userEvent.click(screen.getByRole("button", { name: "I understand" }));

    await waitFor(() => expect(updateLearner).toHaveBeenCalledWith(updated));
  });

  it("shows an error and re-enables the button when saving fails", async () => {
    acceptPrivacyNotice.mockRejectedValue(new Error("network"));
    render(<PrivacyNoticeModal />);

    await userEvent.click(screen.getByRole("button", { name: "I understand" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
    expect(screen.getByRole("button", { name: "I understand" })).toBeEnabled();
    expect(updateLearner).not.toHaveBeenCalled();
  });
});
