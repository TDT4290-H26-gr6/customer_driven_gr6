import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthProvider";
import { getMe, getToken } from "@/features/auth";
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
