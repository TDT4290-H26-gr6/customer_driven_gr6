import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOrCreateAdvice } from "./advisor.service";
import { prisma } from "../../db/prisma";
import { chatJson } from "../../lib/llm";
import { findLearnerById, getLearnerProfile } from "../identity/identity.service";
import {
  journeyCandidatesForSections,
  recommendJourney,
} from "../learningJourney/learningJourney.service";
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
vi.mock("../learningJourney/learningJourney.service", () => ({
  recommendJourney: vi.fn(),
  journeyCandidatesForSections: vi.fn(),
  WEAK_THRESHOLD: 0.5,
}));
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
  vi.mocked(journeyCandidatesForSections).mockResolvedValue([]);
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

  it("offers the weak competence's Moodle module first, then its sources, and stores the advice", async () => {
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
          mainForModules: [
            {
              id: "mod-a2",
              name: "A2 — Introduction to Open Data Management",
              description: null,
              moodleUrl: "https://moodle.example.org/course/view.php?id=1002",
              level: 2,
              section: { name: "Research data", code: "A" },
            },
          ],
        },
      },
    ] as never);
    vi.mocked(chatJson).mockResolvedValue({
      summary: "Start with data management.",
      steps: [
        { ref: "c1", reason: "Your weakest area." },
        { ref: "c2", reason: "Goes deeper." },
        { ref: "c99", reason: "Made up" },
      ],
    });

    const advice = await getOrCreateAdvice("learner-1", llm);

    // Only "Data management" (20%) is a target; "Open access" (80%) isn't.
    // Its Moodle module is c1, its source c2.
    const [, userMessage] = vi.mocked(chatJson).mock.calls[0][1];
    const sent = JSON.parse(userMessage.content);
    expect(sent.competenceScoresWeakestFirst[0].competence).toBe("Data management");
    expect(sent.candidates.map((c: { title: string; type: string }) => [c.title, c.type])).toEqual([
      ["A2 — Introduction to Open Data Management", "module in Moodle"],
      ["Course weak (NTNU)", "learning resource"],
    ]);

    expect(mockPrisma.advice.create).toHaveBeenCalledWith({
      data: {
        satInstanceId: "sat-1",
        summary: "Start with data management.",
        steps: [
          {
            kind: "moodle_module",
            id: "mod-a2",
            title: "A2 — Introduction to Open Data Management",
            url: "https://moodle.example.org/course/view.php?id=1002",
            reason: "Your weakest area.",
          },
          {
            kind: "source",
            id: "weak",
            title: "Course weak (NTNU)",
            url: "https://moodle.example.org/weak",
            reason: "Goes deeper.",
          },
        ],
        journeyId: null,
        journeyReason: null,
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

  function competenceScore(name: string, score: number, sourceId: string) {
    return {
      competenceId: `comp-${name}`,
      score,
      maxScore: 10,
      competence: {
        name,
        primarySource: source(sourceId),
        secondarySources: [],
        mainForModules: [],
      },
    };
  }

  it("after a perfect score, offers no candidates and asks for no steps", async () => {
    mockPrisma.advice.findUnique.mockResolvedValue(null as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      competenceScore("Data", 10, "s-data"),
      competenceScore("AI", 10, "s-ai"),
    ] as never);
    vi.mocked(chatJson).mockResolvedValue({ summary: "A perfect score!", steps: [] });

    await getOrCreateAdvice("learner-1", llm);

    const [, userMessage] = vi.mocked(chatJson).mock.calls[0][1];
    const sent = JSON.parse(userMessage.content);
    expect(sent.candidates).toEqual([]);
    expect(sent.numberOfSteps).toEqual({ min: 0, max: 3 });
    expect(mockPrisma.advice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ steps: [] }),
    });
  });

  it("with nothing below the threshold, still targets the lowest competence", async () => {
    mockPrisma.advice.findUnique.mockResolvedValue(null as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      competenceScore("Data", 9, "s-data"),
      competenceScore("AI", 7, "s-ai"),
    ] as never);
    vi.mocked(chatJson).mockResolvedValue({ summary: "Strong results.", steps: [] });

    await getOrCreateAdvice("learner-1", llm);

    const [, userMessage] = vi.mocked(chatJson).mock.calls[0][1];
    const sent = JSON.parse(userMessage.content);
    expect(sent.candidates.map((c: { title: string }) => c.title)).toEqual(["Course s-ai (NTNU)"]);
    expect(sent.numberOfSteps).toEqual({ min: 1, max: 3 });
    // The model chose nothing, so the required step is added.
    const stored = mockPrisma.advice.create.mock.calls[0][0] as unknown as {
      data: { steps: { id: string }[] };
    };
    expect(stored.data.steps.map((s) => s.id)).toEqual(["s-ai"]);
  });

  it("offers the sources of every competence below the threshold", async () => {
    mockPrisma.advice.findUnique.mockResolvedValue(null as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      competenceScore("Data", 2, "s-data"),
      competenceScore("AI", 5, "s-ai"),
      competenceScore("Ethics", 4, "s-ethics"),
      competenceScore("Policy", 3, "s-policy"),
      competenceScore("Teaching", 9, "s-teaching"),
    ] as never);
    vi.mocked(chatJson).mockResolvedValue({ summary: "ok", steps: [] });

    await getOrCreateAdvice("learner-1", llm);

    const [, userMessage] = vi.mocked(chatJson).mock.calls[0][1];
    // Four at or below 50%, weakest first; the 90% one is left out.
    expect(
      JSON.parse(userMessage.content).candidates.map(
        (c: { buildsCompetence: string }) => c.buildsCompetence,
      ),
    ).toEqual(["Data", "Policy", "Ethics", "AI"]);
  });

  it("handles a competence with no learning source (the WP2 curriculum has none)", async () => {
    mockPrisma.advice.findUnique.mockResolvedValue(null as never);
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      {
        competenceId: "comp-ai-literacy",
        score: 1,
        maxScore: 10,
        competence: {
          name: "AI Literacy",
          primarySource: null,
          secondarySources: [],
          mainForModules: [
            {
              id: "mod-a4",
              name: "A4 — Introduction to Artificial Intelligence",
              description: null,
              moodleUrl: "https://moodle.example.org/course/view.php?id=1004",
              level: 4,
              section: { name: "Open Science Fundamentals", code: "A" },
            },
          ],
        },
      },
    ] as never);
    vi.mocked(chatJson).mockResolvedValue({
      summary: "ok",
      steps: [{ ref: "c1", reason: "Start here." }],
    });

    await getOrCreateAdvice("learner-1", llm);

    const [, userMessage] = vi.mocked(chatJson).mock.calls[0][1];
    expect(JSON.parse(userMessage.content).candidates).toHaveLength(1);
    const stored = mockPrisma.advice.create.mock.calls[0][0] as unknown as {
      data: { steps: { kind: string; url: string }[] };
    };
    expect(stored.data.steps).toEqual([
      expect.objectContaining({
        kind: "moodle_module",
        url: "https://moodle.example.org/course/view.php?id=1004",
      }),
    ]);
  });

  describe("journey choice", () => {
    const weakDataCompetence = {
      competenceId: "comp-data",
      score: 2,
      maxScore: 10,
      competence: {
        name: "Manage research data",
        primarySource: null,
        secondarySources: [],
        mainForModules: [
          {
            id: "mod-a2",
            name: "A2 — Introduction to Open Data Management",
            description: null,
            moodleUrl: null,
            level: 2,
            section: { id: "sec-a", name: "Open Science Fundamentals", code: "A" },
          },
        ],
      },
    };
    const officer = {
      id: "j-lj1",
      name: "LJ1 — Officer",
      description: null,
      coverage: [{ sectionId: "sec-a", section: "Open Science Fundamentals", level: "M" as const }],
    };
    const dataJourney = { ...officer, id: "j-lj2", name: "LJ2 — Research Data" };

    beforeEach(() => {
      mockPrisma.advice.findUnique.mockResolvedValue(null as never);
      mockPrisma.competenceScore.findMany.mockResolvedValue([weakDataCompetence] as never);
      vi.mocked(journeyCandidatesForSections).mockResolvedValue([officer, dataJourney]);
    });

    it("offers the journeys covering the weak sections, the score-based pick first", async () => {
      vi.mocked(recommendJourney).mockResolvedValue({ id: "j-lj2" } as never);
      vi.mocked(chatJson).mockResolvedValue({ summary: "ok", steps: [] });

      await getOrCreateAdvice("learner-1", llm);

      expect(journeyCandidatesForSections).toHaveBeenCalledWith(["sec-a"]);
      const [, userMessage] = vi.mocked(chatJson).mock.calls[0][1];
      const sent = JSON.parse(userMessage.content).journeyCandidates;
      expect(sent.map((j: { name: string }) => j.name)).toEqual([
        "LJ2 — Research Data",
        "LJ1 — Officer",
      ]);
      expect(sent[0].isDefault).toBe(true);
    });

    it("stores the journey the model chose, with its reason", async () => {
      vi.mocked(chatJson).mockResolvedValue({
        summary: "ok",
        steps: [],
        journey: { ref: "j2", reason: "Fits a data steward." },
      });

      await getOrCreateAdvice("learner-1", llm);

      expect(mockPrisma.advice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          journeyId: "j-lj2",
          journeyReason: "Fits a data steward.",
        }),
      });
    });

    it("stores the default journey, without a reason, when the model's choice is unusable", async () => {
      vi.mocked(chatJson).mockResolvedValue({ summary: "ok", steps: [], journey: { ref: "j7" } });

      await getOrCreateAdvice("learner-1", llm);

      expect(mockPrisma.advice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ journeyId: "j-lj1", journeyReason: null }),
      });
    });
  });
});
