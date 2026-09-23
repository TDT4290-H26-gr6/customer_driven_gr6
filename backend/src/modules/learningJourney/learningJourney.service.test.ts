import { beforeEach, describe, expect, it, vi } from "vitest";
import { pickWeakestArea, recommendJourney } from "./learningJourney.service";
import { prisma } from "../../db/prisma";

vi.mock("../../db/prisma", () => ({
  prisma: {
    satInstance: { findFirst: vi.fn() },
    competenceScore: { findMany: vi.fn() },
    learningJourney: { findFirst: vi.fn() },
    journeyRecommendation: { findFirst: vi.fn(), create: vi.fn() },
    competenceArea: { findUnique: vi.fn() },
  },
}));

const mockPrisma = vi.mocked(prisma, true);

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

describe("recommendJourney", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the learner has no completed SAT instance", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue(null);

    const result = await recommendJourney("learner-1");

    expect(result).toBeNull();
  });

  it("returns null when no journey targets the learner's weakest area", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceAreaId: "uncovered-area", score: 1, maxScore: 5 },
    ] as never);
    mockPrisma.learningJourney.findFirst.mockResolvedValue(null);

    const result = await recommendJourney("learner-1");

    expect(result).toBeNull();
    expect(mockPrisma.journeyRecommendation.create).not.toHaveBeenCalled();
  });

  it("logs a new recommendation and returns the matching journey", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceAreaId: "area-a", score: 1, maxScore: 5 },
    ] as never);
    mockPrisma.learningJourney.findFirst.mockResolvedValue({
      id: "journey-1",
      name: "Journey A",
    } as never);
    mockPrisma.journeyRecommendation.findFirst.mockResolvedValue(null);
    mockPrisma.competenceArea.findUnique.mockResolvedValue({ name: "Area A" } as never);

    const result = await recommendJourney("learner-1");

    expect(result).toEqual({ id: "journey-1", name: "Journey A" });
    expect(mockPrisma.journeyRecommendation.create).toHaveBeenCalledWith({
      data: { learnerId: "learner-1", journeyId: "journey-1", reason: "Lowest score in Area A" },
    });
  });

  it("does not log a duplicate recommendation when the pick hasn't changed", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceAreaId: "area-a", score: 1, maxScore: 5 },
    ] as never);
    mockPrisma.learningJourney.findFirst.mockResolvedValue({ id: "journey-1" } as never);
    mockPrisma.journeyRecommendation.findFirst.mockResolvedValue({
      journeyId: "journey-1",
    } as never);

    await recommendJourney("learner-1");

    expect(mockPrisma.journeyRecommendation.create).not.toHaveBeenCalled();
  });

  it("logs a fresh recommendation when the pick changed from last time", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceAreaId: "area-a", score: 1, maxScore: 5 },
    ] as never);
    mockPrisma.learningJourney.findFirst.mockResolvedValue({ id: "journey-new" } as never);
    mockPrisma.journeyRecommendation.findFirst.mockResolvedValue({
      journeyId: "journey-old",
    } as never);
    mockPrisma.competenceArea.findUnique.mockResolvedValue({ name: "Area A" } as never);

    await recommendJourney("learner-1");

    expect(mockPrisma.journeyRecommendation.create).toHaveBeenCalledOnce();
  });
});
