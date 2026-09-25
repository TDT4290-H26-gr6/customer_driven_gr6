import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeActiveInstance, saveResponse } from "./assessment.service";
import { prisma } from "../../db/prisma";

vi.mock("../../db/prisma", () => ({
  prisma: {
    satInstance: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    question: { findUnique: vi.fn() },
    response: { findMany: vi.fn(), upsert: vi.fn() },
    competenceScore: { upsert: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

vi.mock("../identity/identity.service", () => ({
  findLearnerById: vi.fn(),
  getRoleGrants: vi.fn(),
}));

const mockPrisma = vi.mocked(prisma, true);

beforeEach(() => {
  vi.clearAllMocks();
});

const radioQuestion = {
  id: "q1",
  questionType: "single_choice",
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
  it("upserts the Response scored against the question, reusing an existing active instance", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValueOnce({ id: "instance-1" } as never);
    mockPrisma.question.findUnique.mockResolvedValue(radioQuestion as never);

    const answer = { session: { id: "", data: [{ id: "1", value: ["0"] }] }, complete: true };
    await saveResponse("learner-1", "q1", answer);

    expect(mockPrisma.satInstance.create).not.toHaveBeenCalled();
    expect(mockPrisma.response.upsert).toHaveBeenCalledWith({
      where: { satInstanceId_questionId: { satInstanceId: "instance-1", questionId: "q1" } },
      update: { answer, score: 1, maxScore: 1 },
      create: { satInstanceId: "instance-1", questionId: "q1", answer, score: 1, maxScore: 1 },
    });
  });

  it("creates a new SatInstance (instanceNum = prior + 1) when the learner has no active one", async () => {
    mockPrisma.satInstance.findFirst
      .mockResolvedValueOnce(null) // no active instance
      .mockResolvedValueOnce({ instanceNum: 2 } as never); // latest instanceNum so far
    mockPrisma.satInstance.create.mockResolvedValue({ id: "instance-3" } as never);
    mockPrisma.question.findUnique.mockResolvedValue(radioQuestion as never);

    await saveResponse("learner-1", "q1", { session: {}, complete: true });

    expect(mockPrisma.satInstance.create).toHaveBeenCalledWith({
      data: { learnerId: "learner-1", instanceNum: 3 },
    });
  });

  it("starts at instanceNum 1 for a learner with no prior instances at all", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockPrisma.satInstance.create.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.question.findUnique.mockResolvedValue(radioQuestion as never);

    await saveResponse("learner-1", "q1", { session: {}, complete: true });

    expect(mockPrisma.satInstance.create).toHaveBeenCalledWith({
      data: { learnerId: "learner-1", instanceNum: 1 },
    });
  });

  it("falls back to the concurrently-created instance when two first answers race", async () => {
    mockPrisma.satInstance.findFirst
      .mockResolvedValueOnce(null) // no active instance yet
      .mockResolvedValueOnce(null) // no prior instances
      .mockResolvedValueOnce({ id: "instance-from-other-request" } as never); // re-check after the race
    const uniqueViolation = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "5.22.0",
    });
    mockPrisma.satInstance.create.mockRejectedValue(uniqueViolation);
    mockPrisma.question.findUnique.mockResolvedValue(radioQuestion as never);

    await saveResponse("learner-1", "q1", { session: {}, complete: true });

    expect(mockPrisma.response.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          satInstanceId_questionId: {
            satInstanceId: "instance-from-other-request",
            questionId: "q1",
          },
        },
      }),
    );
  });

  it("throws when the question doesn't exist", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValueOnce({ id: "instance-1" } as never);
    mockPrisma.question.findUnique.mockResolvedValue(null);

    await expect(
      saveResponse("learner-1", "missing", { session: {}, complete: true }),
    ).rejects.toThrow("Question not found: missing");
  });
});

describe("completeActiveInstance", () => {
  it("sums scored responses per competence and upserts one CompetenceScore each", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValueOnce({ id: "instance-1" } as never);
    mockPrisma.response.findMany.mockResolvedValue([
      { score: 1, maxScore: 1, question: { competenceId: "competence-a" } },
      { score: 0, maxScore: 1, question: { competenceId: "competence-a" } },
      { score: 3, maxScore: 4, question: { competenceId: "competence-b" } },
    ] as never);

    await completeActiveInstance("learner-1");

    expect(mockPrisma.competenceScore.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.competenceScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          satInstanceId_competenceId: { satInstanceId: "instance-1", competenceId: "competence-a" },
        },
        update: { score: 1, maxScore: 2 },
      }),
    );
    expect(mockPrisma.competenceScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          satInstanceId_competenceId: { satInstanceId: "instance-1", competenceId: "competence-b" },
        },
        update: { score: 3, maxScore: 4 },
      }),
    );
  });

  it("marks the instance complete even when there's nothing scored", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValueOnce({ id: "instance-1" } as never);
    mockPrisma.response.findMany.mockResolvedValue([]);

    await completeActiveInstance("learner-1");

    expect(mockPrisma.satInstance.update).toHaveBeenCalledWith({
      where: { id: "instance-1" },
      data: { completedAt: expect.any(Date) },
    });
    expect(mockPrisma.competenceScore.upsert).not.toHaveBeenCalled();
  });

  it("no-ops when the learner has no active instance", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValueOnce(null);

    const result = await completeActiveInstance("learner-1");

    expect(result).toBeNull();
    expect(mockPrisma.satInstance.update).not.toHaveBeenCalled();
  });
});
