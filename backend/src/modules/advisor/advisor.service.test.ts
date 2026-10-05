import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOrCreateAdvice } from "./advisor.service";
import { prisma } from "../../db/prisma";
import { chatJson } from "../../lib/llm";
import { findLearnerById, getLearnerProfile } from "../identity/identity.service";
import { recommendJourney } from "../learningJourney/learningJourney.service";
import { getDashboardProgress } from "../assessment/assessment.service";

vi.mock("../../db/prisma", () => ({
  prisma: {
    satInstance: { findFirst: vi.fn() },
    advice: { findUnique: vi.fn(), create: vi.fn() },
    competenceScore: { findMany: vi.fn() },
    source: { findMany: vi.fn() },
  },
}));
vi.mock("../../lib/llm", () => ({ chatJson: vi.fn() }));
vi.mock("../identity/identity.service", () => ({
  findLearnerById: vi.fn(),
  getLearnerProfile: vi.fn(),
}));
vi.mock("../learningJourney/learningJourney.service", () => ({ recommendJourney: vi.fn() }));
vi.mock("../assessment/assessment.service", () => ({ getDashboardProgress: vi.fn() }));

const mockPrisma = vi.mocked(prisma, true);
const llm = { baseUrl: "https://llm.test/v1", apiKey: "sk-test", model: "test-model" };

function source(id: string) {
  return {
    id,
    courseName: `Course ${id}`,
    institution: "NTNU",
    description: null,
    sourceUrl: `https://moodle.example.org/${id}`,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "sat-1" } as never);
  vi.mocked(findLearnerById).mockResolvedValue({ userRole: { name: "Student" } } as never);
  vi.mocked(getLearnerProfile).mockResolvedValue(null as never);
  vi.mocked(recommendJourney).mockResolvedValue(null as never);
  vi.mocked(getDashboardProgress).mockResolvedValue(null as never);
  mockPrisma.source.findMany.mockResolvedValue([] as never);
  mockPrisma.advice.create.mockImplementation((({ data }: { data: object }) =>
    Promise.resolve({ id: "advice-1", createdAt: new Date(), ...data })) as never);
});

describe("getOrCreateAdvice", () => {
  it("returns null without touching the database when the LLM isn't configured", async () => {
    await expect(getOrCreateAdvice("learner-1", null)).resolves.toBeNull();
    expect(mockPrisma.satInstance.findFirst).not.toHaveBeenCalled();
  });

  it("returns null when the learner hasn't completed an assessment", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue(null as never);

    await expect(getOrCreateAdvice("learner-1", llm)).resolves.toBeNull();
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("reuses stored advice for the same assessment instead of calling the LLM again", async () => {
    const stored = { id: "advice-1", satInstanceId: "sat-1", summary: "Stored" };
    mockPrisma.advice.findUnique.mockResolvedValue(stored as never);

    await expect(getOrCreateAdvice("learner-1", llm)).resolves.toBe(stored);
    expect(chatJson).not.toHaveBeenCalled();
    expect(mockPrisma.advice.create).not.toHaveBeenCalled();
  });

  it("generates, validates and stores advice from the weakest competences' sources", async () => {
    mockPrisma.advice.findUnique.mockResolvedValue(null as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      {
        competenceId: "comp-open-access",
        score: 8,
        maxScore: 10,
        competence: {
          name: "Open access",
          primarySource: source("strong"),
          secondarySources: [],
          mainForModules: [],
        },
      },
      {
        competenceId: "comp-data-management",
        score: 2,
        maxScore: 10,
        competence: {
          name: "Data management",
          primarySource: source("weak"),
          secondarySources: [],
          mainForModules: [{ section: { name: "Research data" } }],
        },
      },
    ] as never);
    vi.mocked(chatJson).mockResolvedValue({
      summary: "Start with data management.",
      steps: [
        { ref: "c1", reason: "Your weakest area." },
        { ref: "c99", reason: "Made up" },
      ],
    });

    const advice = await getOrCreateAdvice("learner-1", llm);

    // Weakest first: the "weak" source is candidate c1.
    const [, userMessage] = vi.mocked(chatJson).mock.calls[0][1];
    const sent = JSON.parse(userMessage.content);
    expect(sent.competenceScoresWeakestFirst[0].competence).toBe("Data management");
    expect(sent.candidates[0].title).toBe("Course weak (NTNU)");

    expect(mockPrisma.advice.create).toHaveBeenCalledWith({
      data: {
        satInstanceId: "sat-1",
        summary: "Start with data management.",
        steps: [
          {
            kind: "source",
            id: "weak",
            title: "Course weak (NTNU)",
            url: "https://moodle.example.org/weak",
            reason: "Your weakest area.",
          },
        ],
        model: "test-model",
      },
    });
    expect(advice?.summary).toBe("Start with data management.");
  });

  it("stores nothing when the LLM fails, so the next visit tries again", async () => {
    mockPrisma.advice.findUnique.mockResolvedValue(null as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([] as never);
    vi.mocked(chatJson).mockRejectedValue(new Error("timeout"));

    await expect(getOrCreateAdvice("learner-1", llm)).rejects.toThrow("timeout");
    expect(mockPrisma.advice.create).not.toHaveBeenCalled();
  });

  it("tells the LLM how each section changed since the previous assessment", async () => {
    mockPrisma.advice.findUnique.mockResolvedValue(null as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([] as never);
    vi.mocked(getDashboardProgress).mockResolvedValue({
      latest: { instanceNum: 2, completedAt: new Date() },
      previous: { instanceNum: 1, completedAt: new Date() },
      sections: [
        {
          section: { id: "sec-a", code: "A", name: "Data" },
          levelCount: 4,
          latest: { instanceNum: 2, score: 8, maxScore: 10, level: 2 },
          previous: { instanceNum: 1, score: 4, maxScore: 10, level: 1 },
        },
      ],
    } as never);
    vi.mocked(chatJson).mockResolvedValue({ summary: "You improved in Data.", steps: [] });

    await getOrCreateAdvice("learner-1", llm);

    const [, userMessage] = vi.mocked(chatJson).mock.calls[0][1];
    expect(JSON.parse(userMessage.content).progressSincePreviousAssessment).toEqual({
      previousAssessment: 1,
      latestAssessment: 2,
      sections: [
        {
          section: "Data",
          previousPercent: 40,
          latestPercent: 80,
          previousLevel: "A1",
          latestLevel: "A2",
          retakenThisTime: true,
        },
      ],
    });
  });

  it("sends no progress on a first assessment", async () => {
    mockPrisma.advice.findUnique.mockResolvedValue(null as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([] as never);
    vi.mocked(chatJson).mockResolvedValue({ summary: "ok", steps: [] });

    await getOrCreateAdvice("learner-1", llm);

    const [, userMessage] = vi.mocked(chatJson).mock.calls[0][1];
    expect(JSON.parse(userMessage.content)).not.toHaveProperty("progressSincePreviousAssessment");
  });
});
