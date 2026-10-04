import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";

const navigate = vi.fn();
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));

// The form has its own tests; this checks the page wires "Done" to the dashboard.
vi.mock("../components/ProfileForm", () => ({
  ProfileForm: ({ submitLabel, onSaved }: { submitLabel: string; onSaved: () => void }) => (
    <button onClick={onSaved}>{submitLabel}</button>
  ),
}));

describe("ProfilePage", () => {
  it("has a Done button that goes to the dashboard once the profile is saved", () => {
    render(<ProfilePage />);

    screen.getByRole("button", { name: "Done" }).click();

    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
  });
});
