import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteAccountSection } from "./DeleteAccountSection";
import { deleteAccount } from "@/features/auth";
import { useAuth } from "@/app/providers/AuthProvider";

vi.mock("@/features/auth", () => ({
  deleteAccount: vi.fn(),
}));

const navigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

const logout = vi.fn();
vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ logout } as never);
});

describe("DeleteAccountSection", () => {
  it("doesn't call the API until the confirmation step is confirmed", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    await user.click(screen.getByRole("button", { name: /^delete account$/i }));

    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("cancel dismisses the confirmation without deleting anything", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    await user.click(screen.getByRole("button", { name: /^delete account$/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes the account, logs out, and redirects to login on confirm", async () => {
    vi.mocked(deleteAccount).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    await user.click(screen.getByRole("button", { name: /^delete account$/i }));
    await user.click(screen.getByRole("button", { name: /yes, delete my account/i }));

    await vi.waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("shows an error and doesn't log out when deletion fails", async () => {
    vi.mocked(deleteAccount).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    await user.click(screen.getByRole("button", { name: /^delete account$/i }));
    await user.click(screen.getByRole("button", { name: /yes, delete my account/i }));

    expect(await screen.findByText(/could not delete/i)).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
