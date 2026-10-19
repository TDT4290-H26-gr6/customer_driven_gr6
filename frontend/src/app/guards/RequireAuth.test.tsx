import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useAuth } from "@/app/providers/AuthProvider";
import { RequireAuth } from "./RequireAuth";

vi.mock("@/app/providers/AuthProvider", () => ({ useAuth: vi.fn() }));

function renderProtectedRoute(status: string) {
  vi.mocked(useAuth).mockReturnValue({ status } as never);
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<p>dashboard</p>} />
        </Route>
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  it("shows the page to a signed-in learner", () => {
    renderProtectedRoute("signedIn");
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });

  it("sends a signed-out visitor to the login page", () => {
    renderProtectedRoute("signedOut");
    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument();
  });

  it("waits while the session is being checked", () => {
    renderProtectedRoute("loading");
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("login page")).not.toBeInTheDocument();
  });
});
