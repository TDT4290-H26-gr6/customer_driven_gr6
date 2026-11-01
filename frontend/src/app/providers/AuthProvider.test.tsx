import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthProvider";
import { clearToken, getMe, getToken } from "@/features/auth";
import { onUnauthorized } from "@/shared/api/client";

vi.mock("@/features/auth", () => ({
  getMe: vi.fn(),
  getToken: vi.fn(),
  clearToken: vi.fn(),
}));

vi.mock("@/shared/api/client", () => ({
  onUnauthorized: vi.fn(() => () => {}),
}));

function Status() {
  const { status, learner } = useAuth();
  return (
    <p>
      {status}
      {learner ? ` as ${learner.email}` : ""}
    </p>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthProvider", () => {
  it("signs the app out when a request reports the session is gone (401)", async () => {
    vi.mocked(getToken).mockReturnValue("token");
    vi.mocked(getMe).mockResolvedValue({ email: "learner@example.com" } as never);

    render(
      <AuthProvider>
        <Status />
      </AuthProvider>,
    );
    expect(await screen.findByText("signedIn as learner@example.com")).toBeInTheDocument();

    const listener = vi.mocked(onUnauthorized).mock.calls[0][0];
    act(() => listener());

    expect(screen.getByText("signedOut")).toBeInTheDocument();
  });
});

/** Shows the session and offers every action the context provides. */
function SessionControls() {
  const { status, learner, login, logout, setRole, markInitialAssessmentComplete, updateLearner } =
    useAuth();
  return (
    <>
      <p data-testid="session">{status + (learner ? ` ${JSON.stringify(learner)}` : "")}</p>
      <button onClick={() => login({ id: "l1", email: "a@example.com" } as never)}>login</button>
      <button onClick={() => setRole({ id: "r1", name: "Steward" } as never)}>setRole</button>
      <button onClick={markInitialAssessmentComplete}>complete</button>
      <button onClick={() => updateLearner({ id: "l1", email: "new@example.com" } as never)}>
        update
      </button>
      <button onClick={logout}>logout</button>
    </>
  );
}

const session = () => screen.getByTestId("session").textContent ?? "";

describe("AuthProvider session", () => {
  it("is signed out straight away when there's no saved token", () => {
    vi.mocked(getToken).mockReturnValue(null);
    render(
      <AuthProvider>
        <SessionControls />
      </AuthProvider>,
    );
    expect(session()).toBe("signedOut");
    expect(getMe).not.toHaveBeenCalled();
  });

  it("drops a saved token the backend no longer accepts", async () => {
    vi.mocked(getToken).mockReturnValue("expired");
    vi.mocked(getMe).mockRejectedValue(new Error("401"));
    render(
      <AuthProvider>
        <SessionControls />
      </AuthProvider>,
    );
    expect(session()).toBe("loading");
    await vi.waitFor(() => expect(session()).toBe("signedOut"));
    expect(clearToken).toHaveBeenCalled();
  });

  it("logs in, updates the learner, and logs out", async () => {
    vi.mocked(getToken).mockReturnValue(null);
    render(
      <AuthProvider>
        <SessionControls />
      </AuthProvider>,
    );
    const click = (name: string) => userEvent.click(screen.getByRole("button", { name }));

    // Before anyone signs in, these are no-ops rather than errors.
    await click("setRole");
    await click("complete");
    expect(session()).toBe("signedOut");

    await click("login");
    expect(session()).toMatch(/^signedIn .*"a@example.com"/);

    await click("setRole");
    expect(session()).toContain('"role":{"id":"r1","name":"Steward"}');

    await click("complete");
    expect(session()).toContain('"hasCompletedInitialAssessment":true');

    await click("update");
    expect(session()).toContain("new@example.com");

    await click("logout");
    expect(session()).toBe("signedOut");
    expect(clearToken).toHaveBeenCalled();
  });

  it("useAuth fails loudly outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow("within an AuthProvider");
  });
});
