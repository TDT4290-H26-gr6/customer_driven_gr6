import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "@/shared/api/client";
import { getProfile, saveProfile } from "./api";

vi.mock("@/shared/api/client", () => ({ apiFetch: vi.fn() }));

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

it("getProfile fetches the learner's profile", async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(null);
  expect(await getProfile()).toBeNull();
  expect(apiFetch).toHaveBeenCalledWith("/auth/me/profile");
});

it("saveProfile saves the form and returns the updated learner", async () => {
  const input = {
    name: "Ada",
    industry: "higher_education" as const,
    academicDegree: "phd" as const,
    background: "Research software",
    yearsOfExperience: 4,
    goals: null,
  };
  vi.mocked(apiFetch).mockResolvedValueOnce({ id: "learner-1", name: "Ada" });

  expect(await saveProfile(input)).toEqual({ id: "learner-1", name: "Ada" });
  expect(apiFetch).toHaveBeenCalledWith("/auth/me/profile", { method: "PUT", body: input });
});
