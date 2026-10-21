import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { useAuth } from "@/app/providers/AuthProvider";
import { RoleGateModal } from "./RoleGateModal";

vi.mock("@/app/providers/AuthProvider", () => ({ useAuth: vi.fn() }));
// RoleSelect has its own tests; here it just reports a chosen role.
vi.mock("@/features/onboarding", () => ({
  RoleSelect: ({ heading, onDone }: { heading: string; onDone: (role: object) => void }) => (
    <button onClick={() => onDone({ id: "role-1", name: "Data steward" })}>{heading}</button>
  ),
}));

it("is a modal dialog that saves the chosen role to the session", async () => {
  const setRole = vi.fn();
  vi.mocked(useAuth).mockReturnValue({ setRole } as never);

  render(<RoleGateModal />);

  const dialog = screen.getByRole("dialog", { name: "Choose your role" });
  expect(dialog).toHaveAttribute("aria-modal", "true");

  await userEvent.click(screen.getByRole("button", { name: "Welcome, choose your role" }));

  expect(setRole).toHaveBeenCalledWith({ id: "role-1", name: "Data steward" });
});
