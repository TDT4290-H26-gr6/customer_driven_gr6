import { describe, expect, it } from "vitest";
import { pickWeakestArea } from "./learningJourney.service";

describe("pickWeakestArea", () => {
  it("picks the area with the lowest score/maxScore ratio, not the lowest raw score", () => {
    // 6/31 (~19%) is actually worse than 2/7 (~29%) despite the higher raw score.
    const areaId = pickWeakestArea([
      { competenceAreaId: "legal", score: 6, maxScore: 31 },
      { competenceAreaId: "open-science", score: 2, maxScore: 7 },
    ]);
    expect(areaId).toBe("legal");
  });

  it("picks the only scored area when there's just one", () => {
    const areaId = pickWeakestArea([{ competenceAreaId: "a", score: 3, maxScore: 5 }]);
    expect(areaId).toBe("a");
  });

  it("excludes areas with maxScore 0 (nothing scorable, e.g. only self-rating questions)", () => {
    const areaId = pickWeakestArea([
      { competenceAreaId: "unscored", score: 0, maxScore: 0 },
      { competenceAreaId: "scored", score: 4, maxScore: 5 },
    ]);
    expect(areaId).toBe("scored");
  });

  it("returns null when there are no scores at all", () => {
    expect(pickWeakestArea([])).toBeNull();
  });

  it("returns null when every area has maxScore 0", () => {
    expect(pickWeakestArea([{ competenceAreaId: "a", score: 0, maxScore: 0 }])).toBeNull();
  });

  it("a perfect score (ratio 1) still loses to any lower ratio", () => {
    const areaId = pickWeakestArea([
      { competenceAreaId: "perfect", score: 5, maxScore: 5 },
      { competenceAreaId: "weak", score: 1, maxScore: 5 },
    ]);
    expect(areaId).toBe("weak");
  });
});
