import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  journeyCandidatesForSections,
  pickLowestImprovable,
  pickWeakestCompetence,
  recommendJourney,
  recommendJourneys,
  suggestJourney,
  weakCompetences,
} from "./learningJourney.service";
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
    competence: { findUnique: vi.fn(), findMany: vi.fn() },
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
    const competenceId = pickWeakestCompetence([{ competenceId: "a", score: 2, maxScore: 5 }]);
    expect(competenceId).toBe("a");
  });

  it("excludes a competence scoring above 60%, even if it's the only one", () => {
    const competenceId = pickWeakestCompetence([{ competenceId: "a", score: 4, maxScore: 5 }]);
    expect(competenceId).toBeNull();
  });

  it("includes a competence scoring exactly 60% (the threshold is inclusive)", () => {
    const competenceId = pickWeakestCompetence([{ competenceId: "a", score: 3, maxScore: 5 }]);
    expect(competenceId).toBe("a");
  });

  it("picks the weakest among several, ignoring ones above 60% even if they'd otherwise be lowest", () => {
    // "strong" (80%) has a lower raw score than "weak" (40%) but is above the threshold.
    const competenceId = pickWeakestCompetence([
      { competenceId: "strong", score: 4, maxScore: 5 },
      { competenceId: "weak", score: 2, maxScore: 5 },
    ]);
    expect(competenceId).toBe("weak");
  });

  it("excludes competences with maxScore 0 (nothing scorable)", () => {
    const competenceId = pickWeakestCompetence([
      { competenceId: "unscored", score: 0, maxScore: 0 },
      { competenceId: "scored", score: 2, maxScore: 5 },
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
    // recommendation logged before, overridden per test as needed.
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

  it("returns null when every competence scores above 60%, instead of recommending the relatively weakest", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "a", score: 9, maxScore: 10 },
      { competenceId: "b", score: 7, maxScore: 10 },
    ] as never);

    expect(await recommendJourney("learner-1")).toBeNull();
    expect(mockPrisma.sectionModule.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.journeyRecommendation.create).not.toHaveBeenCalled();
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
      expect.objectContaining({
        where: { competenceId: "weak", module: { retiredAt: null, section: { retiredAt: null } } },
      }),
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

  it("logs only once when two requests for the same learner arrive at the same time", async () => {
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
    // A tiny stand-in for the table: what create writes, findFirst reads back.
    let logged: { journeyId: string } | null = null;
    mockPrisma.journeyRecommendation.findFirst.mockImplementation((async () => logged) as never);
    mockPrisma.journeyRecommendation.create.mockImplementation((async ({
      data,
    }: {
      data: { journeyId: string };
    }) => {
      logged = { journeyId: data.journeyId };
      return logged;
    }) as never);

    await Promise.all([recommendJourney("learner-1"), recommendJourney("learner-1")]);

    expect(mockPrisma.journeyRecommendation.create).toHaveBeenCalledOnce();
  });
});

describe("weakCompetences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.sectionModule.findMany.mockResolvedValue([{ sectionId: "section-1" }] as never);
    mockPrisma.sectionModuleSecondaryCompetence.findMany.mockResolvedValue([]);
  });

  it("returns an empty array when there's no completed instance", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue(null);
    expect(await weakCompetences("learner-1")).toEqual([]);
  });

  it("returns an empty array when nothing is at or below 60%", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "a", score: 9, maxScore: 10 },
    ] as never);

    expect(await weakCompetences("learner-1")).toEqual([]);
    expect(mockPrisma.competence.findMany).not.toHaveBeenCalled();
  });

  it("returns every competence at or below 60%, weakest first, each paired with its score and journey", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "legal", score: 3, maxScore: 10 }, // 30%
      { competenceId: "open-science", score: 5, maxScore: 10 }, // 50%
      { competenceId: "ai-tools", score: 9, maxScore: 10 }, // 90%, excluded
    ] as never);
    mockPrisma.competence.findMany.mockResolvedValue([
      { id: "legal", name: "Legal" },
      { id: "open-science", name: "Open Science" },
    ] as never);
    mockPrisma.sectionModule.findMany.mockImplementation((({
      where,
    }: {
      where: { mainCompetenceId: string };
    }) =>
      Promise.resolve(
        where.mainCompetenceId === "legal"
          ? [{ sectionId: "section-legal" }]
          : [{ sectionId: "section-os" }],
      )) as never);
    mockPrisma.journeySection.findMany.mockImplementation((({
      where,
    }: {
      where: { sectionId: { in: string[] } };
    }) =>
      Promise.resolve(
        where.sectionId.in[0] === "section-legal"
          ? [{ journeyId: "journey-legal", coverageLevel: "M" }]
          : [{ journeyId: "journey-os", coverageLevel: "M" }],
      )) as never);
    mockPrisma.learningJourney.findMany.mockImplementation((({
      where,
    }: {
      where: { id: { in: string[] } };
    }) =>
      Promise.resolve(
        where.id.in[0] === "journey-legal"
          ? [{ id: "journey-legal", name: "Legal Journey" }]
          : [{ id: "journey-os", name: "Open Science Journey" }],
      )) as never);

    const result = await weakCompetences("learner-1");

    expect(result).toEqual([
      {
        competenceId: "legal",
        competenceName: "Legal",
        score: 3,
        maxScore: 10,
        journey: { id: "journey-legal", name: "Legal Journey" },
      },
      {
        competenceId: "open-science",
        competenceName: "Open Science",
        score: 5,
        maxScore: 10,
        journey: { id: "journey-os", name: "Open Science Journey" },
      },
    ]);
  });

  it("pairs a competence with a null journey when nothing covers its sections", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "weak", score: 1, maxScore: 5 },
    ] as never);
    mockPrisma.competence.findMany.mockResolvedValue([{ id: "weak", name: "Weak" }] as never);
    mockPrisma.journeySection.findMany.mockResolvedValue([]);

    const result = await weakCompetences("learner-1");

    expect(result).toEqual([
      { competenceId: "weak", competenceName: "Weak", score: 1, maxScore: 5, journey: null },
    ]);
  });
});

describe("pickLowestImprovable", () => {
  it("picks the lowest-scoring competence with no threshold", () => {
    expect(
      pickLowestImprovable([
        { competenceId: "a", score: 9, maxScore: 10 },
        { competenceId: "b", score: 7, maxScore: 10 },
      ]),
    ).toBe("b");
  });

  it("skips competences already at 100%", () => {
    expect(
      pickLowestImprovable([
        { competenceId: "perfect", score: 5, maxScore: 5 },
        { competenceId: "b", score: 8, maxScore: 10 },
      ]),
    ).toBe("b");
  });

  it("is null after a perfect score, or with nothing scorable", () => {
    expect(pickLowestImprovable([{ competenceId: "a", score: 5, maxScore: 5 }])).toBeNull();
    expect(pickLowestImprovable([{ competenceId: "a", score: 0, maxScore: 0 }])).toBeNull();
    expect(pickLowestImprovable([])).toBeNull();
  });
});

describe("suggestJourney", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.sectionModule.findMany.mockResolvedValue([{ sectionId: "section-1" }] as never);
    mockPrisma.journeySection.findMany.mockResolvedValue([
      { journeyId: "journey-1", coverageLevel: "M" },
    ] as never);
    mockPrisma.learningJourney.findMany.mockResolvedValue([
      { id: "journey-1", name: "Journey 1", modules: [] },
    ] as never);
  });

  it("suggests the journey for the lowest area when nothing is at or below 60%", async () => {
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "a", score: 9, maxScore: 10 },
      { competenceId: "b", score: 7, maxScore: 10 },
    ] as never);

    expect(await suggestJourney("learner-1")).toMatchObject({ id: "journey-1" });
    expect(mockPrisma.sectionModule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { mainCompetenceId: "b", retiredAt: null, section: { retiredAt: null } },
      }),
    );
    // A suggestion isn't a "you're lacking" recommendation, so it isn't logged as one.
    expect(mockPrisma.journeyRecommendation.create).not.toHaveBeenCalled();
  });

  it("suggests nothing when something is weak (the recommendation applies then)", async () => {
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "a", score: 3, maxScore: 10 },
    ] as never);

    expect(await suggestJourney("learner-1")).toBeNull();
  });

  it("suggests nothing after a perfect score", async () => {
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "a", score: 10, maxScore: 10 },
    ] as never);

    expect(await suggestJourney("learner-1")).toBeNull();
  });
});

describe("journeyCandidatesForSections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const link = (journeyId: string, sectionId: string, level: "M" | "R" | "S") => ({
    coverageLevel: level,
    section: { id: sectionId, name: `Section ${sectionId}` },
    journey: { id: journeyId, name: `Journey ${journeyId}`, description: null },
  });

  it("is empty without sections, without asking the database", async () => {
    expect(await journeyCandidatesForSections([])).toEqual([]);
    expect(mockPrisma.journeySection.findMany).not.toHaveBeenCalled();
  });

  it("groups coverage per journey and orders like the score-based pick", async () => {
    mockPrisma.journeySection.findMany.mockResolvedValue([
      link("s-only", "a", "S"),
      link("two-r", "a", "R"),
      link("two-r", "b", "R"),
      link("one-m", "b", "M"),
    ] as never);

    const candidates = await journeyCandidatesForSections(["a", "b"]);

    // M beats R beats S; at the same level, more sections covered wins.
    expect(candidates.map((c) => c.id)).toEqual(["one-m", "two-r", "s-only"]);
    expect(candidates[1].coverage).toEqual([
      { sectionId: "a", section: "Section a", level: "R" },
      { sectionId: "b", section: "Section b", level: "R" },
    ]);
  });
});

describe("weakCompetences: Moodle links", () => {
  it("includes the journey's Moodle link", async () => {
    vi.clearAllMocks();
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "legal", score: 3, maxScore: 10 },
    ] as never);
    mockPrisma.competence.findMany.mockResolvedValue([{ id: "legal", name: "Legal" }] as never);
    mockPrisma.sectionModule.findMany.mockResolvedValue([{ sectionId: "section-1" }] as never);
    mockPrisma.journeySection.findMany.mockResolvedValue([
      { journeyId: "journey-legal", coverageLevel: "M" },
    ] as never);
    mockPrisma.learningJourney.findMany.mockResolvedValue([
      {
        id: "journey-legal",
        name: "Legal Journey",
        moodleUrl: "https://moodle.example.org/course/view.php?id=2001",
        modules: [],
      },
    ] as never);

    const [weak] = await weakCompetences("learner-1");
    expect(weak.journey).toEqual({
      id: "journey-legal",
      name: "Legal Journey",
      moodleUrl: "https://moodle.example.org/course/view.php?id=2001",
    });
  });
});

describe("recommendJourneys (score-based top two)", () => {
  const journey = (id: string) => ({ id, name: `Journey ${id}`, moodleUrl: null, modules: [] });
  const link = (journeyId: string, sectionId: string, level: "M" | "R" | "S") => ({
    coverageLevel: level,
    section: { id: sectionId, name: `Section ${sectionId}` },
    journey: { id: journeyId, name: `Journey ${journeyId}`, description: null },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.sectionModule.findMany.mockResolvedValue([{ sectionId: "s1" }] as never);
    mockPrisma.sectionModuleSecondaryCompetence.findMany.mockResolvedValue([]);
    mockPrisma.journeyRecommendation.findFirst.mockResolvedValue(null);
    mockPrisma.competence.findUnique.mockResolvedValue({ name: "Weak" } as never);
  });

  it("recommends two when something is weak: the usual pick first, then the next-best coverage", async () => {
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "weak", score: 2, maxScore: 10 },
    ] as never);
    // recommendJourney's own lookup: "b" covers the section with M.
    mockPrisma.journeySection.findMany
      .mockResolvedValueOnce([{ journeyId: "b", coverageLevel: "M" }] as never)
      .mockResolvedValueOnce([
        link("a", "s1", "M"),
        link("b", "s1", "M"),
        link("c", "s1", "S"),
      ] as never);
    mockPrisma.learningJourney.findMany
      .mockResolvedValueOnce([journey("b")] as never)
      .mockResolvedValueOnce([journey("a"), journey("b")] as never);

    const result = await recommendJourneys("learner-1");

    expect(result?.source).toBe("recommended");
    expect(result?.journeys.map((j) => j.id)).toEqual(["b", "a"]);
  });

  it("suggests two to keep improving with when nothing is weak", async () => {
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "fine", score: 7, maxScore: 10 },
    ] as never);
    mockPrisma.journeySection.findMany.mockResolvedValueOnce([
      link("x", "s1", "R"),
      link("y", "s1", "M"),
    ] as never);
    mockPrisma.learningJourney.findMany.mockResolvedValueOnce([
      journey("x"),
      journey("y"),
    ] as never);

    const result = await recommendJourneys("learner-1");

    expect(result?.source).toBe("suggested");
    expect(result?.journeys.map((j) => j.id)).toEqual(["y", "x"]);
    expect(mockPrisma.journeyRecommendation.create).not.toHaveBeenCalled();
  });

  it("recommends nothing after a perfect score", async () => {
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "a", score: 10, maxScore: 10 },
    ] as never);

    expect(await recommendJourneys("learner-1")).toBeNull();
  });
});
