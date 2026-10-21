import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/app/providers/AuthProvider";
import { LoginPage } from "./LoginPage";

vi.mock("@/app/providers/AuthProvider", () => ({ useAuth: vi.fn() }));
// The robot needs WebGL; the Google button has its own tests and here just
// signs in on click (and shows whether the information letter was acknowledged).
vi.mock("../components/GreetingBot", () => ({ GreetingBot: () => null }));
vi.mock("../components/GoogleLoginButton", () => ({
  GoogleLoginButton: ({
    onLogin,
    accepted,
  }: {
    onLogin: (learner: object) => void;
    accepted: boolean;
  }) => (
    <button onClick={() => onLogin({ id: "learner-1" })} disabled={!accepted}>
      Sign in with Google
    </button>
  ),
}));

const login = vi.fn();

function renderLogin(status: string) {
  vi.mocked(useAuth).mockReturnValue({ login, status } as never);
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  login.mockReset();
});

describe("LoginPage", () => {
  it("shows the logo, tagline and sign-in button", () => {
    renderLogin("signedOut");
    expect(screen.getByRole("img", { name: /AIOS/ })).toBeInTheDocument();
    expect(screen.getByText(/Assess and grow your AI/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeInTheDocument();
  });

  it("starts the session and goes home after signing in", async () => {
    renderLogin("signedOut");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));
    expect(login).toHaveBeenCalledWith({ id: "learner-1" });
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("keeps sign-in disabled until the information letter is acknowledged", async () => {
    renderLogin("signedOut");
    const signIn = screen.getByRole("button", { name: "Sign in with Google" });
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(signIn).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox"));
    expect(signIn).toBeEnabled();

    await userEvent.click(screen.getByRole("checkbox"));
    expect(signIn).toBeDisabled();
  });

  it("links to the information letter", () => {
    renderLogin("signedOut");
    expect(screen.getByRole("link", { name: "information letter" })).toHaveAttribute(
      "href",
      "/information-letter",
    );
  });

  it("sends someone who's already signed in straight home", () => {
    renderLogin("signedIn");
    expect(screen.getByText("home")).toBeInTheDocument();
  });
});
