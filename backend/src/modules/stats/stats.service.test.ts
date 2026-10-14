import { beforeEach, describe, expect, it, vi } from "vitest";
import { listQuestionRows, listTestRows } from "./stats.service";
import { prisma } from "../../db/prisma";

vi.mock("../../db/prisma", () => ({
  prisma: {
    satInstance: { findMany: vi.fn() },
  },
}));

const mockPrisma = vi.mocked(prisma, true);

function instance(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "instance-1",
    startedAt: new Date("2026-10-01T10:00:00.000Z"),
    completedAt: new Date("2026-10-01T10:20:00.000Z"),
    reassessedSectionNames: null,
    learner: {
      userRole: { name: "Administrator" },
      profile: { industry: "higher_education", academicDegree: "phd", yearsOfExperience: 7 },
    },
    competenceScores: [
      { score: 3, maxScore: 5 },
      { score: 4, maxScore: 5 },
    ],
    responses: [
      {
        score: 3,
        maxScore: 5,
        timeSpentMs: 20_000,
        question: {
          competence: { name: "Open Science" },
          sectionModule: { section: { name: "Foundations" } },
        },
      },
      {
        score: 4,
        maxScore: 5,
        timeSpentMs: 15_000,
        question: {
          competence: { name: "Legal" },
          sectionModule: { section: { name: "Governance" } },
        },
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listTestRows", () => {
  it("sums scores and active time across the instance's responses", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([instance()] as never);

    const rows = await listTestRows();

    expect(rows).toEqual([
      {
        satInstanceId: "instance-1",
        role: "Administrator",
        industry: "higher_education",
        academicDegree: "phd",
        experienceBucket: "6-10",
        startedAt: "2026-10-01T10:00:00.000Z",
        completedAt: "2026-10-01T10:20:00.000Z",
        durationMs: 20 * 60 * 1000,
        activeTimeMs: 35_000,
        score: 7,
        maxScore: 10,
        scorePercent: 70,
      },
    ]);
  });

  it("excludes a targeted reassessment (reassessedSectionNames set)", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([
      instance({ reassessedSectionNames: ["Foundations"] }),
    ] as never);

    expect(await listTestRows()).toEqual([]);
  });

  it("asks Prisma for completed kind:\"main\" instances only, excluding kind:\"journey\"", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([instance()] as never);

    await listTestRows();

    expect(mockPrisma.satInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { completedAt: { not: null }, kind: "main" },
      }),
    );
  });

  it("treats a missing role, profile or timeSpentMs as blank/zero, not a crash", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([
      instance({
        learner: { userRole: null, profile: null },
        responses: [{ score: 1, maxScore: 1, timeSpentMs: null, question: null }],
      }),
    ] as never);

    const [row] = await listTestRows();

    expect(row.role).toBe("");
    expect(row.industry).toBe("");
    expect(row.experienceBucket).toBe("");
    expect(row.activeTimeMs).toBe(0);
  });

  it("gives a 0% score when nothing was scorable, instead of NaN", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([
      instance({ competenceScores: [], responses: [] }),
    ] as never);

    const [row] = await listTestRows();

    expect(row.score).toBe(0);
    expect(row.maxScore).toBe(0);
    expect(row.scorePercent).toBe(0);
  });
});

describe("listQuestionRows", () => {
  it("returns one row per response, carrying the test's id and role", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([instance()] as never);

    const rows = await listQuestionRows();

    expect(rows).toEqual([
      {
        satInstanceId: "instance-1",
        role: "Administrator",
        section: "Foundations",
        competence: "Open Science",
        score: 3,
        maxScore: 5,
        timeSpentMs: 20_000,
      },
      {
        satInstanceId: "instance-1",
        role: "Administrator",
        section: "Governance",
        competence: "Legal",
        score: 4,
        maxScore: 5,
        timeSpentMs: 15_000,
      },
    ]);
  });

  it("labels section/competence 'Unknown' when the question has been deleted", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([
      instance({
        responses: [{ score: null, maxScore: null, timeSpentMs: null, question: null }],
      }),
    ] as never);

    const [row] = await listQuestionRows();

    expect(row.section).toBe("Unknown");
    expect(row.competence).toBe("Unknown");
  });

  it("excludes a targeted reassessment, same as listTestRows", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([
      instance({ reassessedSectionNames: ["Foundations"] }),
    ] as never);

    expect(await listQuestionRows()).toEqual([]);
  });
});
