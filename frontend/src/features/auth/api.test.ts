import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/shared/api/client";
import { completeInitialAssessment, deleteAccount, getMe, googleLogin } from "./api";
import { setToken } from "./session";

vi.mock("@/shared/api/client", () => ({ apiFetch: vi.fn() }));
vi.mock("./session", () => ({ setToken: vi.fn() }));

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(setToken).mockReset();
});

describe("auth api", () => {
  it("googleLogin exchanges Google's credential for a session and stores the token", async () => {
    const result = { token: "session-jwt", learner: { id: "learner-1" } };
    vi.mocked(apiFetch).mockResolvedValueOnce(result);

    expect(await googleLogin("google-credential")).toEqual(result);
    expect(apiFetch).toHaveBeenCalledWith("/auth/google", {
      method: "POST",
      auth: false,
      body: { credential: "google-credential" },
    });
    expect(setToken).toHaveBeenCalledWith("session-jwt");
  });

  it("googleLogin stores nothing when the backend refuses", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("401"));
    await expect(googleLogin("forged")).rejects.toThrow("401");
    expect(setToken).not.toHaveBeenCalled();
  });

  it("getMe fetches the signed-in learner", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: "learner-1" });
    expect(await getMe()).toEqual({ id: "learner-1" });
    expect(apiFetch).toHaveBeenCalledWith("/auth/me");
  });

  it("completeInitialAssessment marks the first assessment as done", async () => {
    await completeInitialAssessment();
    expect(apiFetch).toHaveBeenCalledWith("/auth/me/initial-assessment", { method: "PUT" });
  });

  it("deleteAccount deletes the signed-in learner", async () => {
    await deleteAccount();
    expect(apiFetch).toHaveBeenCalledWith("/auth/me", { method: "DELETE" });
  });
});
