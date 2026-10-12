import { describe, expect, it, vi } from "vitest";
import { getCurrentJourney, startJourneyAssessment } from "./api";
import { apiFetch } from "@/shared/api/client";
import type { LearningJourney } from "./types";

vi.mock("@/shared/api/client", () => ({
  apiFetch: vi.fn(),
}));

const RECOMMENDED: LearningJourney = {
  id: "recommended",
  name: "Recommended",
  description: null,
  modules: [],
};
const SUGGESTED: LearningJourney = { ...RECOMMENDED, id: "suggested", name: "Suggested" };

describe("getCurrentJourney", () => {
  it("shows the recommendation when something is weak", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(RECOMMENDED);

    expect(await getCurrentJourney()).toEqual({ journey: RECOMMENDED, source: "recommended" });
    // The suggestion is never even fetched once there's a recommendation.
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to a suggestion to keep improving when nothing is weak", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(undefined) // nothing at or below 60%
      .mockResolvedValueOnce(SUGGESTED);

    expect(await getCurrentJourney()).toEqual({ journey: SUGGESTED, source: "suggested" });
  });

  it("returns null when there's no recommendation or suggestion (e.g. a perfect score)", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

    expect(await getCurrentJourney()).toBeNull();
  });
});

describe("startJourneyAssessment", () => {
  it("asks the backend to start assessing that journey", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(undefined);

    await startJourneyAssessment("journey-2");

    expect(apiFetch).toHaveBeenCalledWith("/assessment/journey", {
      method: "POST",
      body: { journeyId: "journey-2" },
    });
  });
});
