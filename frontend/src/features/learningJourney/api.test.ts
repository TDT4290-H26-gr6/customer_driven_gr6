import { describe, expect, it, vi } from "vitest";
import { getCurrentJourney } from "./api";
import { apiFetch } from "@/shared/api/client";
import type { LearningJourney } from "./types";

vi.mock("@/shared/api/client", () => ({
  apiFetch: vi.fn(),
}));

const SELECTED: LearningJourney = {
  id: "selected",
  name: "Selected",
  description: null,
  modules: [],
};
const RECOMMENDED: LearningJourney = {
  id: "recommended",
  name: "Recommended",
  description: null,
  modules: [],
};

describe("getCurrentJourney", () => {
  it("prefers the learner's explicit selection over the recommendation", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(SELECTED);

    const result = await getCurrentJourney();

    expect(result).toEqual({ journey: SELECTED, source: "selected" });
    // The recommendation is never even fetched once a selection exists.
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to the recommendation when nothing is selected", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(undefined).mockResolvedValueOnce(RECOMMENDED);

    const result = await getCurrentJourney();

    expect(result).toEqual({ journey: RECOMMENDED, source: "recommended" });
  });

  it("returns null when there's neither a selection nor a recommendation", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

    expect(await getCurrentJourney()).toBeNull();
  });
});
