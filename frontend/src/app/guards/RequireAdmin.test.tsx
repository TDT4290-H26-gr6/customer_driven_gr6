import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RequireAdmin } from "./RequireAdmin";
import { useAuth } from "@/app/providers/AuthProvider";

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

function renderAdminRoute() {
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<p>admin page</p>} />
        </Route>
        <Route path="/dashboard" element={<p>dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAdmin", () => {
  it("shows the admin page to an admin", () => {
    vi.mocked(useAuth).mockReturnValue({ learner: { isAdmin: true } } as never);

    renderAdminRoute();

    expect(screen.getByText("admin page")).toBeInTheDocument();
  });

  it("sends anyone else to the dashboard", () => {
    vi.mocked(useAuth).mockReturnValue({ learner: { isAdmin: false } } as never);

    renderAdminRoute();

    expect(screen.getByText("dashboard")).toBeInTheDocument();
    expect(screen.queryByText("admin page")).not.toBeInTheDocument();
  });
});
