import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RequireProfile } from "./RequireProfile";
import { useAuth } from "@/app/providers/AuthProvider";

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

function renderAssessmentRoute() {
  render(
    <MemoryRouter initialEntries={["/assessment"]}>
      <Routes>
        <Route element={<RequireProfile />}>
          <Route path="/assessment" element={<p>assessment</p>} />
        </Route>
        <Route path="/profile" element={<p>profile page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireProfile", () => {
  it("lets a learner with a complete profile into the assessment", () => {
    vi.mocked(useAuth).mockReturnValue({ learner: { hasCompletedProfile: true } } as never);

    renderAssessmentRoute();

    expect(screen.getByText("assessment")).toBeInTheDocument();
  });

  it("sends a learner without a complete profile to the profile page", () => {
    vi.mocked(useAuth).mockReturnValue({ learner: { hasCompletedProfile: false } } as never);

    renderAssessmentRoute();

    expect(screen.getByText("profile page")).toBeInTheDocument();
    expect(screen.queryByText("assessment")).not.toBeInTheDocument();
  });
});
