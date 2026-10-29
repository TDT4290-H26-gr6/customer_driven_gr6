import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/app/providers/AuthProvider";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { AppShell } from "./AppShell";

const flags = vi.hoisted(() => ({ roleSelection: false }));

vi.mock("@/app/providers/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("@/shared/hooks/useMediaQuery", () => ({ useMediaQuery: vi.fn() }));
vi.mock("@/shared/lib/features", () => ({
  get ROLE_SELECTION_ENABLED() {
    return flags.roleSelection;
  },
}));
vi.mock("@/features/feedback", () => ({ FeedbackWidget: () => <button>Feedback</button> }));
vi.mock("@/features/settings", () => ({ DeletionReminderModal: () => null }));
vi.mock("./RoleGateModal", () => ({ RoleGateModal: () => <div role="dialog">role gate</div> }));

const learner = { name: "Ada", email: "ada@example.com", role: null, isAdmin: false };

function renderShell() {
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<p>dashboard page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ learner, logout: vi.fn() } as never);
  vi.mocked(useMediaQuery).mockReturnValue(false);
});

afterEach(() => {
  flags.roleSelection = false;
  localStorage.clear();
});

describe("AppShell", () => {
  it("frames the page with the header, the side rail and the feedback button", () => {
    renderShell();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("dashboard page");
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Feedback" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
  });

  it("puts the nav after the page on mobile, as a bottom bar", () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    renderShell();
    const main = screen.getByRole("main");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(main.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("button", { name: /labels/ })).not.toBeInTheDocument();
  });

  it("remembers whether the rail's labels are hidden", async () => {
    renderShell();
    await userEvent.click(screen.getByRole("button", { name: "Hide labels" }));
    expect(screen.getByRole("button", { name: "Show labels" })).toBeInTheDocument();
    expect(localStorage.getItem("aios.sidebarCollapsed")).toBe("true");
  });

  it("doesn't gate on a role while role selection is off", () => {
    renderShell();
    expect(screen.queryByText("role gate")).not.toBeInTheDocument();
    expect(screen.getByText("dashboard page")).toBeInTheDocument();
    const wrapper = screen.getByRole("banner").parentElement as HTMLElement & { inert: boolean };
    expect(wrapper.inert).toBe(false);
  });

  it("blocks the app behind the role gate when role selection is on and no role is set", () => {
    flags.roleSelection = true;
    renderShell();
    expect(screen.getByText("role gate")).toBeInTheDocument();
    expect(screen.queryByText("dashboard page")).not.toBeInTheDocument();
    // Everything behind the gate is unreachable, by mouse or keyboard.
    const wrapper = screen.getByRole("banner").parentElement as HTMLElement & { inert: boolean };
    expect(wrapper.inert).toBe(true);
  });
});
