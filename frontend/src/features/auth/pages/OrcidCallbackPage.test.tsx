import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/app/providers/AuthProvider";
import { orcidLogin } from "../api";
import { OrcidCallbackPage } from "./OrcidCallbackPage";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));
vi.mock("@/app/providers/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("../api", () => ({ orcidLogin: vi.fn() }));

const login = vi.fn();

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/auth/orcid/callback${search}`]}>
      <OrcidCallbackPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(useAuth).mockReturnValue({ login } as never);
});

describe("OrcidCallbackPage", () => {
  it("signs in with the code when the state matches, then goes home", async () => {
    sessionStorage.setItem("orcid-oauth-state", "s1");
    const learner = { id: "learner-1" };
    vi.mocked(orcidLogin).mockResolvedValue({ token: "t", learner } as never);

    renderAt("?code=abc&state=s1");

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/", { replace: true }));
    expect(orcidLogin).toHaveBeenCalledWith("abc");
    expect(login).toHaveBeenCalledWith(learner);
  });

  it("refuses a state this tab never sent, without calling the backend", async () => {
    sessionStorage.setItem("orcid-oauth-state", "s1");

    renderAt("?code=abc&state=forged");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(orcidLogin).not.toHaveBeenCalled();
  });

  it("shows an error when the learner denied access (no code)", async () => {
    renderAt("?error=access_denied&state=s1");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(orcidLogin).not.toHaveBeenCalled();
  });

  it("shows an error when the backend refuses the code", async () => {
    sessionStorage.setItem("orcid-oauth-state", "s1");
    vi.mocked(orcidLogin).mockRejectedValue(new Error("401"));

    renderAt("?code=stale&state=s1");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });
});
