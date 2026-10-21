import { describe, expect, it, vi } from "vitest";
import {
  getRecommendedJourneys,
  getWeakCompetences,
  listJourneys,
  startJourneyAssessment,
} from "./api";
import { apiFetch } from "@/shared/api/client";

vi.mock("@/shared/api/client", () => ({
  apiFetch: vi.fn(),
}));

describe("getRecommendedJourneys", () => {
  it("returns the score-based top two", async () => {
    const result = {
      source: "recommended" as const,
      journeys: [{ id: "a", name: "A", description: null, modules: [] }],
    };
    vi.mocked(apiFetch).mockResolvedValueOnce(result);

    expect(await getRecommendedJourneys()).toEqual(result);
    expect(apiFetch).toHaveBeenCalledWith("/learning-journeys/recommendations");
  });

  it("returns null when there's nothing to recommend (204)", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(undefined);
    expect(await getRecommendedJourneys()).toBeNull();
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

describe("listJourneys", () => {
  it("fetches every learning journey", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([]);
    expect(await listJourneys()).toEqual([]);
    expect(apiFetch).toHaveBeenCalledWith("/learning-journeys");
  });
});

describe("getWeakCompetences", () => {
  it("fetches the competences at or below the weak threshold", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([]);
    expect(await getWeakCompetences()).toEqual([]);
    expect(apiFetch).toHaveBeenCalledWith("/learning-journeys/weak-competences");
  });
});
