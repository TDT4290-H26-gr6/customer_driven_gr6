import { beforeEach, describe, expect, it, vi } from "vitest";
import { pickWeakestCompetence, recommendJourney } from "./learningJourney.service";
import { prisma } from "../../db/prisma";

vi.mock("../../db/prisma", () => ({
  prisma: {
    satInstance: { findFirst: vi.fn() },
    competenceScore: { findMany: vi.fn() },
    sectionModule: { findMany: vi.fn() },
    sectionModuleSecondaryCompetence: { findMany: vi.fn() },
    journeySection: { findMany: vi.fn() },
    learningJourney: { findMany: vi.fn() },
    journeyRecommendation: { findFirst: vi.fn(), create: vi.fn() },
    competence: { findUnique: vi.fn() },
  },
}));

const mockPrisma = vi.mocked(prisma, true);

describe("pickWeakestCompetence", () => {
  it("picks the competence with the lowest score/maxScore ratio, not the lowest raw score", () => {
    // 6/31 (~19%) is actually worse than 2/7 (~29%) despite the higher raw score.
    const competenceId = pickWeakestCompetence([
      { competenceId: "legal", score: 6, maxScore: 31 },
      { competenceId: "open-science", score: 2, maxScore: 7 },
    ]);
    expect(competenceId).toBe("legal");
  });

  it("picks the only scored competence when there's just one", () => {
    const competenceId = pickWeakestCompetence([{ competenceId: "a", score: 3, maxScore: 5 }]);
    expect(competenceId).toBe("a");
  });

  it("excludes competences with maxScore 0 (nothing scorable)", () => {
    const competenceId = pickWeakestCompetence([
      { competenceId: "unscored", score: 0, maxScore: 0 },
      { competenceId: "scored", score: 4, maxScore: 5 },
    ]);
    expect(competenceId).toBe("scored");
  });

  it("returns null when there are no scores at all", () => {
    expect(pickWeakestCompetence([])).toBeNull();
  });

  it("returns null when every competence has maxScore 0", () => {
    expect(pickWeakestCompetence([{ competenceId: "a", score: 0, maxScore: 0 }])).toBeNull();
  });

  it("a perfect score (ratio 1) still loses to any lower ratio", () => {
    const competenceId = pickWeakestCompetence([
      { competenceId: "perfect", score: 5, maxScore: 5 },
      { competenceId: "weak", score: 1, maxScore: 5 },
    ]);
    expect(competenceId).toBe("weak");
  });
});

describe("recommendJourney", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: the weakest competence's own module has one section, no journey
    // recommendation logged before — overridden per test as needed.
    mockPrisma.sectionModule.findMany.mockResolvedValue([{ sectionId: "section-1" }] as never);
    mockPrisma.sectionModuleSecondaryCompetence.findMany.mockResolvedValue([]);
    mockPrisma.journeyRecommendation.findFirst.mockResolvedValue(null);
    mockPrisma.competence.findUnique.mockResolvedValue({ name: "Weak Competence" } as never);
  });

  it("returns null when the learner has no completed SAT instance", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue(null);
    expect(await recommendJourney("learner-1")).toBeNull();
  });

  it("returns null when nothing is scorable (pickWeakestCompetence finds nothing)", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "a", score: 0, maxScore: 0 },
    ] as never);

    expect(await recommendJourney("learner-1")).toBeNull();
    expect(mockPrisma.sectionModule.findMany).not.toHaveBeenCalled();
  });

  it("falls back to the competence's secondary-module sections when it's no module's main competence", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "weak", score: 1, maxScore: 5 },
    ] as never);
    mockPrisma.sectionModule.findMany.mockResolvedValue([]); // not a main competence anywhere
    mockPrisma.sectionModuleSecondaryCompetence.findMany.mockResolvedValue([
      { module: { sectionId: "section-2" } },
    ] as never);
    mockPrisma.journeySection.findMany.mockResolvedValue([
      { journeyId: "journey-1", coverageLevel: "S" },
    ] as never);
    mockPrisma.learningJourney.findMany.mockResolvedValue([
      { id: "journey-1", name: "Journey via secondary" },
    ] as never);

    const result = await recommendJourney("learner-1");

    expect(result).toEqual({ id: "journey-1", name: "Journey via secondary" });
    expect(mockPrisma.sectionModuleSecondaryCompetence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { competenceId: "weak" } }),
    );
  });

  it("returns null when the weakest competence's sections aren't covered by any journey", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "weak", score: 1, maxScore: 5 },
    ] as never);
    mockPrisma.journeySection.findMany.mockResolvedValue([]);

    expect(await recommendJourney("learner-1")).toBeNull();
    expect(mockPrisma.journeyRecommendation.create).not.toHaveBeenCalled();
  });

  it("prefers a journey with M (main) coverage over R or S, regardless of match count", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "weak", score: 1, maxScore: 5 },
    ] as never);
    mockPrisma.journeySection.findMany.mockResolvedValue([
      { journeyId: "journey-s-twice", coverageLevel: "S" },
      { journeyId: "journey-m-once", coverageLevel: "M" },
    ] as never);
    mockPrisma.learningJourney.findMany.mockResolvedValue([
      { id: "journey-s-twice", name: "Supplementary" },
      { id: "journey-m-once", name: "Main" },
    ] as never);

    const result = await recommendJourney("learner-1");

    expect(result).toEqual({ id: "journey-m-once", name: "Main" });
  });

  it("breaks a coverage-level tie by whichever journey matches more of the sections", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "weak", score: 1, maxScore: 5 },
    ] as never);
    mockPrisma.sectionModule.findMany.mockResolvedValue([
      { sectionId: "section-1" },
      { sectionId: "section-2" },
    ] as never);
    mockPrisma.journeySection.findMany.mockResolvedValue([
      { journeyId: "journey-one-match", coverageLevel: "R" },
      { journeyId: "journey-two-matches", coverageLevel: "R" },
      { journeyId: "journey-two-matches", coverageLevel: "R" },
    ] as never);
    mockPrisma.learningJourney.findMany.mockResolvedValue([
      { id: "journey-one-match", name: "One match" },
      { id: "journey-two-matches", name: "Two matches" },
    ] as never);

    const result = await recommendJourney("learner-1");

    expect(result).toEqual({ id: "journey-two-matches", name: "Two matches" });
  });

  it("breaks a full tie by journey name, alphabetically", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "weak", score: 1, maxScore: 5 },
    ] as never);
    mockPrisma.journeySection.findMany.mockResolvedValue([
      { journeyId: "journey-z", coverageLevel: "R" },
      { journeyId: "journey-a", coverageLevel: "R" },
    ] as never);
    mockPrisma.learningJourney.findMany.mockResolvedValue([
      { id: "journey-z", name: "Zebra Journey" },
      { id: "journey-a", name: "Alpha Journey" },
    ] as never);

    const result = await recommendJourney("learner-1");

    expect(result).toEqual({ id: "journey-a", name: "Alpha Journey" });
  });

  it("logs a new recommendation with the weakest competence's name as the reason", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "weak", score: 1, maxScore: 5 },
    ] as never);
    mockPrisma.journeySection.findMany.mockResolvedValue([
      { journeyId: "journey-1", coverageLevel: "M" },
    ] as never);
    mockPrisma.learningJourney.findMany.mockResolvedValue([
      { id: "journey-1", name: "Journey A" },
    ] as never);

    await recommendJourney("learner-1");

    expect(mockPrisma.journeyRecommendation.create).toHaveBeenCalledWith({
      data: {
        learnerId: "learner-1",
        journeyId: "journey-1",
        reason: "Lowest score in Weak Competence",
      },
    });
  });

  it("does not log a duplicate recommendation when the pick hasn't changed", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "weak", score: 1, maxScore: 5 },
    ] as never);
    mockPrisma.journeySection.findMany.mockResolvedValue([
      { journeyId: "journey-1", coverageLevel: "M" },
    ] as never);
    mockPrisma.learningJourney.findMany.mockResolvedValue([
      { id: "journey-1", name: "Journey A" },
    ] as never);
    mockPrisma.journeyRecommendation.findFirst.mockResolvedValue({
      journeyId: "journey-1",
    } as never);

    await recommendJourney("learner-1");

    expect(mockPrisma.journeyRecommendation.create).not.toHaveBeenCalled();
  });

  it("logs a fresh recommendation when the pick changed from last time", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "weak", score: 1, maxScore: 5 },
    ] as never);
    mockPrisma.journeySection.findMany.mockResolvedValue([
      { journeyId: "journey-new", coverageLevel: "M" },
    ] as never);
    mockPrisma.learningJourney.findMany.mockResolvedValue([
      { id: "journey-new", name: "New Journey" },
    ] as never);
    mockPrisma.journeyRecommendation.findFirst.mockResolvedValue({
      journeyId: "journey-old",
    } as never);

    await recommendJourney("learner-1");

    expect(mockPrisma.journeyRecommendation.create).toHaveBeenCalledOnce();
  });
});
