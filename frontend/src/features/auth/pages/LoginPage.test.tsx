import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ login: vi.fn(), status: "signedOut" }),
}));
vi.mock("../components/GreetingBot", () => ({ GreetingBot: () => null }));
vi.mock("../components/GoogleLoginButton", () => ({
  GoogleLoginButton: ({ accepted }: { accepted: boolean }) => (
    <div data-testid="google" data-accepted={String(accepted)} />
  ),
}));

function renderPage() {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  it("keeps sign-in disabled until the information letter is acknowledged", async () => {
    renderPage();
    expect(screen.getByTestId("google")).toHaveAttribute("data-accepted", "false");

    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByTestId("google")).toHaveAttribute("data-accepted", "true");

    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByTestId("google")).toHaveAttribute("data-accepted", "false");
  });

  it("links to the information letter", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "information letter" })).toHaveAttribute(
      "href",
      "/information-letter",
    );
  });
});
