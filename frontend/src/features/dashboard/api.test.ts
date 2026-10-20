import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/shared/api/client";
import { getDashboardProgress, getSectionCompetenceScores } from "./api";

vi.mock("@/shared/api/client", () => ({ apiFetch: vi.fn() }));

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("getSectionCompetenceScores", () => {
  it("fetches the latest assessment by default", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ sections: [] });
    expect(await getSectionCompetenceScores()).toEqual({ sections: [] });
    expect(apiFetch).toHaveBeenCalledWith("/competence-scores/by-section");
  });

  it("fetches an earlier assessment by number", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ sections: [] });
    await getSectionCompetenceScores(2);
    expect(apiFetch).toHaveBeenCalledWith("/competence-scores/by-section?instance=2");
  });

  it("is null before any completed assessment (204)", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(undefined);
    expect(await getSectionCompetenceScores()).toBeNull();
  });
});

describe("getDashboardProgress", () => {
  it("fetches the before/after progress, or null before any assessment", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ latest: {} });
    expect(await getDashboardProgress()).toEqual({ latest: {} });
    vi.mocked(apiFetch).mockResolvedValueOnce(undefined);
    expect(await getDashboardProgress()).toBeNull();
    expect(apiFetch).toHaveBeenCalledWith("/competence-scores/progress");
  });
});
