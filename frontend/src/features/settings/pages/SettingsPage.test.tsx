import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAccent } from "@/app/providers/AccentProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { useTheme } from "@/app/providers/ThemeProvider";
import { SettingsPage } from "./SettingsPage";

const flags = vi.hoisted(() => ({ roleSelection: false }));

vi.mock("@/app/providers/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("@/app/providers/ThemeProvider", () => ({ useTheme: vi.fn() }));
vi.mock("@/app/providers/AccentProvider", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useAccent: vi.fn(),
}));
vi.mock("@/shared/lib/features", () => ({
  get ROLE_SELECTION_ENABLED() {
    return flags.roleSelection;
  },
}));
// The sections below have their own tests.
vi.mock("@/features/profile", () => ({ ProfileForm: () => <p>profile form</p> }));
vi.mock("../components/DeleteAccountSection", () => ({
  DeleteAccountSection: () => <p>delete account</p>,
}));
vi.mock("@/features/onboarding", () => ({
  RoleSelect: ({
    initialRoleId,
    onDone,
  }: {
    initialRoleId?: string;
    onDone: (role: { id: string; name: string }) => void;
  }) => (
    <button onClick={() => onDone({ id: "r2", name: "Researcher" })}>
      role select ({initialRoleId})
    </button>
  ),
}));

const setPreference = vi.fn();
const setAccent = vi.fn();
const setRole = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    learner: { role: { id: "r1", name: "Data steward" } },
    setRole,
  } as never);
  vi.mocked(useTheme).mockReturnValue({ preference: "dark", setPreference } as never);
  vi.mocked(useAccent).mockReturnValue({ accent: "blue", setAccent } as never);
});

afterEach(() => {
  flags.roleSelection = false;
});

// The information-letter card links to another route.
function renderPage() {
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe("SettingsPage", () => {
  it("shows the current visuals choice and changes it", async () => {
    renderPage();
    const visuals = screen.getByRole("radiogroup", { name: "Visuals" });
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "false");
    expect(visuals.children).toHaveLength(3);

    await userEvent.click(screen.getByRole("radio", { name: "Light" }));

    expect(setPreference).toHaveBeenCalledWith("light");
  });

  it("shows the current accent color and changes it", async () => {
    renderPage();
    const accents = screen.getByRole("radiogroup", { name: "Accent color" });
    expect(accents.children).toHaveLength(3);
    const checked = screen
      .getAllByRole("radio")
      .filter((radio) => accents.contains(radio) && radio.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);

    const unchecked = Array.from(accents.children).find(
      (radio) => radio.getAttribute("aria-checked") === "false",
    )!;
    await userEvent.click(unchecked);

    expect(setAccent).toHaveBeenCalledTimes(1);
    expect(setAccent).not.toHaveBeenCalledWith("blue");
  });

  it("includes the profile form and account deletion", () => {
    renderPage();
    expect(screen.getByText("profile form")).toBeInTheDocument();
    expect(screen.getByText("delete account")).toBeInTheDocument();
  });

  it("links to the information letter", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Information letter" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read the information letter" })).toHaveAttribute(
      "href",
      "/information-letter",
    );
  });

  it("hides the role card while role selection is off", () => {
    renderPage();
    expect(screen.queryByText(/role select/)).not.toBeInTheDocument();
  });

  it("lets the learner change their role when role selection is on", async () => {
    flags.roleSelection = true;
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "role select (r1)" }));

    expect(setRole).toHaveBeenCalledWith({ id: "r2", name: "Researcher" });
    expect(screen.getByText(/You're now set as Researcher/)).toBeInTheDocument();
  });
});
