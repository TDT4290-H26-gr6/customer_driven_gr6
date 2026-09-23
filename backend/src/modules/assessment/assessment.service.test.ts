import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeActiveInstance, saveResponse } from "./assessment.service";
import { prisma } from "../../db/prisma";

vi.mock("../../db/prisma", () => ({
  prisma: {
    satInstance: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn(), update: vi.fn() },
    question: { findUnique: vi.fn() },
    response: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    competenceScore: { upsert: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

const mockPrisma = vi.mocked(prisma, true);

beforeEach(() => {
  vi.clearAllMocks();
});

const radioQuestion = {
  id: "q1",
  questionType: "behavioral_anchor",
  content: {
    models: [
      {
        id: "1",
        choiceMode: "radio",
        choices: [
          { value: "0", correct: true },
          { value: "1", correct: false },
        ],
      },
    ],
  },
};

describe("saveResponse", () => {
  it("creates a new Response scored against the question when none exists yet", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.question.findUnique.mockResolvedValue(radioQuestion as never);
    mockPrisma.response.findFirst.mockResolvedValue(null);

    const answer = { session: { id: "", data: [{ id: "1", value: ["0"] }] }, complete: true };
    await saveResponse("learner-1", "q1", answer);

    expect(mockPrisma.response.create).toHaveBeenCalledWith({
      data: { satInstanceId: "instance-1", questionId: "q1", answer, score: 1, maxScore: 1 },
    });
    expect(mockPrisma.response.update).not.toHaveBeenCalled();
  });

  it("updates the existing Response in place when the question was already answered", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.question.findUnique.mockResolvedValue(radioQuestion as never);
    mockPrisma.response.findFirst.mockResolvedValue({ id: "response-1" } as never);

    const answer = { session: { id: "", data: [{ id: "1", value: ["1"] }] }, complete: true };
    await saveResponse("learner-1", "q1", answer);

    expect(mockPrisma.response.update).toHaveBeenCalledWith({
      where: { id: "response-1" },
      data: { answer, score: 0, maxScore: 1 },
    });
    expect(mockPrisma.response.create).not.toHaveBeenCalled();
  });

  it("creates a new SatInstance when the learner has no active one", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue(null);
    mockPrisma.satInstance.count.mockResolvedValue(1);
    mockPrisma.satInstance.create.mockResolvedValue({ id: "instance-2" } as never);
    mockPrisma.question.findUnique.mockResolvedValue(radioQuestion as never);
    mockPrisma.response.findFirst.mockResolvedValue(null);

    await saveResponse("learner-1", "q1", { session: {}, complete: true });

    expect(mockPrisma.satInstance.create).toHaveBeenCalledWith({
      data: { learnerId: "learner-1", instanceNum: 2 },
    });
  });

  it("throws when the question doesn't exist", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.question.findUnique.mockResolvedValue(null);

    await expect(
      saveResponse("learner-1", "missing", { session: {}, complete: true }),
    ).rejects.toThrow("Question not found: missing");
  });
});

describe("completeActiveInstance", () => {
  it("sums scored responses per competence area and upserts one CompetenceScore each", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.response.findMany.mockResolvedValue([
      { score: 1, maxScore: 1, question: { competenceAreaId: "area-a" } },
      { score: 0, maxScore: 1, question: { competenceAreaId: "area-a" } },
      { score: 3, maxScore: 4, question: { competenceAreaId: "area-b" } },
    ] as never);

    await completeActiveInstance("learner-1");

    expect(mockPrisma.competenceScore.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.competenceScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          satInstanceId_competenceAreaId: {
            satInstanceId: "instance-1",
            competenceAreaId: "area-a",
          },
        },
        update: { score: 1, maxScore: 2 },
      }),
    );
    expect(mockPrisma.competenceScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          satInstanceId_competenceAreaId: {
            satInstanceId: "instance-1",
            competenceAreaId: "area-b",
          },
        },
        update: { score: 3, maxScore: 4 },
      }),
    );
  });

  it("marks the instance complete even when there's nothing scored", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.response.findMany.mockResolvedValue([]);

    await completeActiveInstance("learner-1");

    expect(mockPrisma.satInstance.update).toHaveBeenCalledWith({
      where: { id: "instance-1" },
      data: { completedAt: expect.any(Date) },
    });
    expect(mockPrisma.competenceScore.upsert).not.toHaveBeenCalled();
  });

  it("no-ops when the learner has no active instance", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue(null);

    const result = await completeActiveInstance("learner-1");

    expect(result).toBeNull();
    expect(mockPrisma.satInstance.update).not.toHaveBeenCalled();
  });
});
