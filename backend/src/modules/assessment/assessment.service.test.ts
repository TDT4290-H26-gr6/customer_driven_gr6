import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeActiveInstance,
  discardActiveInstance,
  getAssessmentPath,
  getAttemptSectionScores,
  getCompetencies,
  getLatestCompetenceScores,
  getSatHistory,
  hasCompletedMainAssessment,
  listAssessableSections,
  listQuestions,
  saveResponse,
  startJourneyAssessment,
  startReassessment,
} from "./assessment.service";
import { config } from "../../config";
import { prisma } from "../../db/prisma";
import { findLearnerById, getRoleGrants } from "../identity/identity.service";
import { IDK_VALUE } from "./assessment.scoring";
import { buildPieContent } from "./assessment.pie";
import { recommendJourney, suggestJourney } from "../learningJourney/learningJourney.service";

vi.mock("../../db/prisma", () => ({
  prisma: {
    satInstance: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    question: { findFirst: vi.fn(), findMany: vi.fn() },
    satInstanceSection: { findMany: vi.fn() },
    section: { findMany: vi.fn() },
    learningJourney: { findUnique: vi.fn() },
    journeySection: { findMany: vi.fn() },
    response: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    competenceScore: { findMany: vi.fn(), upsert: vi.fn() },
    sectionModule: { findMany: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

vi.mock("../learningJourney/learningJourney.service", () => ({
  recommendJourney: vi.fn(),
  suggestJourney: vi.fn(),
}));

vi.mock("../identity/identity.service", () => ({
  findLearnerById: vi.fn(),
  getRoleGrants: vi.fn(),
}));

const mockPrisma = vi.mocked(prisma, true);

beforeEach(() => {
  vi.clearAllMocks();
  // These tests cover the role-based behaviour, which is switched off for now
  // (config.roleSelectionEnabled) but kept for when it comes back. The
  // "role selection off" tests below switch it off themselves.
  config.roleSelectionEnabled = true;
  // Default: no reassessment in progress, so no section limit.
  mockPrisma.satInstanceSection.findMany.mockResolvedValue([]);
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
  // A learner whose role can see section-1, which holds the question, and who
  // has already completed a prior instance — so this is a retake, not their
  // initial assessment, and the role filter is the one in effect.
  beforeEach(() => {
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: "student" } as never);
    vi.mocked(getRoleGrants).mockResolvedValue({ sectionIds: ["section-1"], competenceIds: [] });
    mockPrisma.satInstance.count.mockResolvedValue(1);
  });

  it("upserts the Response scored against the question, reusing an existing active instance", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValueOnce({ id: "instance-1" } as never);
    mockPrisma.question.findFirst.mockResolvedValue(radioQuestion as never);

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
    mockPrisma.question.findFirst.mockResolvedValue(radioQuestion as never);

    await saveResponse("learner-1", "q1", { session: {}, complete: true });

    expect(mockPrisma.satInstance.create).toHaveBeenCalledWith({
      data: { learnerId: "learner-1", instanceNum: 3 },
    });
  });

  it("starts at instanceNum 1 for a learner with no prior instances at all", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockPrisma.satInstance.create.mockResolvedValue({ id: "instance-1" } as never);
    mockPrisma.question.findFirst.mockResolvedValue(radioQuestion as never);

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
    mockPrisma.question.findFirst.mockResolvedValue(radioQuestion as never);

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

  it("only looks the question up among those the learner's role can see", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValueOnce({ id: "instance-1" } as never);
    mockPrisma.question.findFirst.mockResolvedValue(radioQuestion as never);

    await saveResponse("learner-1", "q1", { session: {}, complete: true });

    expect(mockPrisma.question.findFirst).toHaveBeenCalledWith({
      where: {
        AND: [
          { id: "q1" },
          {
            OR: [
              { competenceId: { in: [] } },
              { sectionModule: { sectionId: { in: ["section-1"] } } },
            ],
          },
        ],
      },
    });
  });

  it("returns null and saves nothing when the question is unknown or not visible to the role", async () => {
    mockPrisma.question.findFirst.mockResolvedValue(null);

    const result = await saveResponse("learner-1", "missing", { session: {}, complete: true });

    expect(result).toBeNull();
    // Checked before the instance is touched, so a bad id leaves no empty instance behind.
    expect(mockPrisma.satInstance.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.satInstance.create).not.toHaveBeenCalled();
    expect(mockPrisma.response.upsert).not.toHaveBeenCalled();
  });

  it("returns null and saves nothing for a learner without a role", async () => {
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: null } as never);

    const result = await saveResponse("learner-1", "q1", { session: {}, complete: true });

    expect(result).toBeNull();
    expect(mockPrisma.question.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.response.upsert).not.toHaveBeenCalled();
  });

  it("during the initial assessment, sees every question regardless of role grants — no completed instance yet", async () => {
    mockPrisma.satInstance.count.mockResolvedValue(0); // never completed a run
    vi.mocked(getRoleGrants).mockResolvedValue({ sectionIds: [], competenceIds: [] }); // a role with no grants at all
    mockPrisma.satInstance.findFirst.mockResolvedValueOnce({ id: "instance-1" } as never);
    mockPrisma.question.findFirst.mockResolvedValue(radioQuestion as never);

    await saveResponse("learner-1", "q1", { session: {}, complete: true });

    expect(getRoleGrants).not.toHaveBeenCalled();
    expect(mockPrisma.question.findFirst).toHaveBeenCalledWith({
      where: { AND: [{ id: "q1" }, {}] },
    });
  });

  it("scores an 'I don't know' answer as 0/1 instead of a wrong guess", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValueOnce({ id: "instance-1" } as never);
    mockPrisma.question.findFirst.mockResolvedValue(radioQuestion as never);

    const answer = { session: { id: "", data: [{ id: "1", value: [IDK_VALUE] }] }, complete: true };
    await saveResponse("learner-1", "q1", answer);

    expect(mockPrisma.response.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { answer, score: 0, maxScore: 1 } }),
    );
  });

  it("'I don't know' overrides any other picks on a multi_choice, instead of partial-scoring", async () => {
    const checkboxQuestion = {
      id: "q2",
      questionType: "multi_choice",
      content: {
        models: [
          {
            id: "1",
            choiceMode: "checkbox",
            choices: [
              { value: "0", correct: true },
              { value: "1", correct: true },
              { value: IDK_VALUE, correct: false },
            ],
          },
        ],
      },
    };
    mockPrisma.satInstance.findFirst.mockResolvedValueOnce({ id: "instance-1" } as never);
    mockPrisma.question.findFirst.mockResolvedValue(checkboxQuestion as never);

    const answer = {
      session: { id: "", data: [{ id: "1", value: ["0", IDK_VALUE] }] }, // ticked a correct box too
      complete: true,
    };
    await saveResponse("learner-1", "q2", answer);

    expect(mockPrisma.response.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { answer, score: 0, maxScore: 1 } }),
    );
  });

  it("scores a criteria_check like its criteria: full for exactly the ones met, less for wrong ticks", async () => {
    const criteriaQuestion = {
      id: "q3",
      questionType: "criteria_check",
      content: buildPieContent("criteria_check", "Which criteria does the README meet?", {
        exhibit: "README.md\nLicence: CC BY 4.0",
        options: [
          { id: "a", text: "States a licence" },
          { id: "b", text: "Names the file" },
          { id: "c", text: "Gives a DOI" },
          { id: "d", text: "Explains every variable" },
        ],
        correctOptionIds: ["a", "b"],
      }),
    };
    mockPrisma.question.findFirst.mockResolvedValue(criteriaQuestion as never);
    const tick = (...values: string[]) => ({
      session: { id: "", data: [{ id: "1", value: values }] },
      complete: true,
    });
    const scoreFor = async (...values: string[]) => {
      mockPrisma.satInstance.findFirst.mockResolvedValueOnce({ id: "instance-1" } as never);
      mockPrisma.response.upsert.mockClear();
      await saveResponse("learner-1", "q3", tick(...values));
      return (mockPrisma.response.upsert.mock.calls[0][0] as { update: { score: number } }).update
        .score;
    };

    expect(await scoreFor("a", "b")).toBe(1);
    // Both met criteria found, but one of the two unmet ones ticked too.
    expect(await scoreFor("a", "b", "c")).toBe(0.5);
    // Ticking everything isn't a strategy.
    expect(await scoreFor("a", "b", "c", "d")).toBe(0);
  });
});

describe("with role selection turned off", () => {
  beforeEach(() => {
    config.roleSelectionEnabled = false;
  });

  it("gives every learner the whole bank, even after a completed SAT, without reading the role", async () => {
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: "student" } as never);
    mockPrisma.satInstance.count.mockResolvedValue(3);
    mockPrisma.question.findMany.mockResolvedValue([]);

    await listQuestions("learner-1");

    expect(getRoleGrants).not.toHaveBeenCalled();
    expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it("lets a learner without a role take the SAT too", async () => {
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: null } as never);
    mockPrisma.question.findMany.mockResolvedValue([]);

    await listQuestions("learner-1");

    expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it("still returns nothing for an account that no longer exists", async () => {
    vi.mocked(findLearnerById).mockResolvedValue(null);

    expect(await listQuestions("learner-1")).toEqual([]);
    expect(mockPrisma.question.findMany).not.toHaveBeenCalled();
  });
});

describe("listQuestions", () => {
  it("returns every question during the initial assessment, without even reading the role's grants", async () => {
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: "student" } as never);
    mockPrisma.satInstance.count.mockResolvedValue(0);
    mockPrisma.question.findMany.mockResolvedValue([]);

    await listQuestions("learner-1");

    expect(getRoleGrants).not.toHaveBeenCalled();
    expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it("goes back to the role filter once the learner has completed an instance", async () => {
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: "student" } as never);
    mockPrisma.satInstance.count.mockResolvedValue(1);
    vi.mocked(getRoleGrants).mockResolvedValue({ sectionIds: ["section-1"], competenceIds: [] });
    mockPrisma.question.findMany.mockResolvedValue([]);

    await listQuestions("learner-1");

    expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { competenceId: { in: [] } },
            { sectionModule: { sectionId: { in: ["section-1"] } } },
          ],
        },
      }),
    );
  });

  it("limits the questions to an in-progress reassessment's sections", async () => {
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: "student" } as never);
    mockPrisma.satInstance.count.mockResolvedValue(1);
    vi.mocked(getRoleGrants).mockResolvedValue({ sectionIds: ["section-1"], competenceIds: [] });
    mockPrisma.satInstanceSection.findMany.mockResolvedValue([{ sectionId: "section-2" }] as never);
    mockPrisma.question.findMany.mockResolvedValue([]);

    await listQuestions("learner-1");

    expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [
                { competenceId: { in: [] } },
                { sectionModule: { sectionId: { in: ["section-1"] } } },
              ],
            },
            { sectionModule: { sectionId: { in: ["section-2"] } } },
          ],
        },
      }),
    );
  });

  it("returns nothing for a learner without a role", async () => {
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: null } as never);

    expect(await listQuestions("learner-1")).toEqual([]);
    expect(mockPrisma.question.findMany).not.toHaveBeenCalled();
  });

  it("keeps 'I don't know' pinned last, shuffling only the real choices around it", async () => {
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: "student" } as never);
    mockPrisma.satInstance.count.mockResolvedValue(0);
    mockPrisma.question.findMany.mockResolvedValue([
      {
        id: "q1",
        prompt: "Pick one",
        questionType: "single_choice",
        competence: { id: "c1", name: "Comp" },
        content: {
          models: [
            {
              id: "1",
              choiceMode: "radio",
              choices: [
                { value: "a", correct: false },
                { value: "b", correct: true },
                { value: "c", correct: false },
                { value: IDK_VALUE, correct: false },
              ],
            },
          ],
        },
      },
    ] as never);

    const [question] = await listQuestions("learner-1");
    const choices = (question.content as { models: { choices: { value: string }[] }[] }).models[0]
      .choices;

    expect(choices.map((c) => c.value)).toContain("a");
    expect(choices.map((c) => c.value)).toContain("b");
    expect(choices.map((c) => c.value)).toContain("c");
    expect(choices.at(-1)?.value).toBe(IDK_VALUE);
  });
});

/** Mocks for loadPathInputs: a role, the first assessment (no role filter), no section limit. */
function mockPathInputs({
  questions,
  active,
  responses,
}: {
  questions: { id: string; competenceId: string; level?: number }[];
  active: { id: string; instanceNum: number } | null;
  responses: {
    id: string;
    questionId: string | null;
    score: number | null;
    maxScore: number | null;
  }[];
}) {
  vi.mocked(findLearnerById).mockResolvedValue({ roleId: "student" } as never);
  mockPrisma.satInstance.count.mockResolvedValue(0);
  mockPrisma.satInstance.findFirst.mockReset();
  mockPrisma.satInstance.findFirst.mockResolvedValue(active as never);
  mockPrisma.question.findMany.mockResolvedValue(
    questions.map((q) => ({
      id: q.id,
      prompt: `Prompt ${q.id}`,
      questionType: "single_choice",
      content: {},
      competenceId: q.competenceId,
      competence: { id: q.competenceId, name: q.competenceId },
      sectionModule: {
        id: `module-${q.level ?? 1}`,
        level: q.level ?? 1,
        section: { id: "section-a", code: "A", name: "Section A" },
      },
    })) as never,
  );
  mockPrisma.response.findMany.mockReset();
  // Only read when there's an active instance — don't leave an unused value queued.
  if (active) {
    mockPrisma.response.findMany.mockResolvedValueOnce(
      responses.map((r, i) => ({
        ...r,
        answeredAt: new Date(1000 * i), // answered in the order listed
        answer: { session: {}, complete: true },
      })) as never,
    );
  }
}

describe("getAssessmentPath", () => {
  it("returns the answered questions on the path, with answers, then the next one", async () => {
    mockPathInputs({
      questions: [
        { id: "q1", competenceId: "comp-a" },
        { id: "q2", competenceId: "comp-a" },
        { id: "q3", competenceId: "comp-a" },
      ],
      active: { id: "instance-1", instanceNum: 1 },
      responses: [{ id: "r1", questionId: "q1", score: 1, maxScore: 1 }],
    });

    const path = await getAssessmentPath("learner-1");

    expect(path?.done).toBe(false);
    expect(path?.sectionCount).toBe(1);
    expect(path?.items.map((i) => i.question.id)).toEqual(["q1", "q2"]);
    expect(path?.items[0]).toMatchObject({
      answer: { session: {}, complete: true },
      section: { code: "A", name: "Section A" },
      sectionNumber: 1,
      level: 1,
    });
    expect(path?.items[1].answer).toBeNull();
  });

  it("starts at the first question before any answer (no instance yet)", async () => {
    mockPathInputs({
      questions: [{ id: "q1", competenceId: "comp-a" }],
      active: null,
      responses: [],
    });

    const path = await getAssessmentPath("learner-1");

    expect(path?.items.map((i) => i.question.id)).toEqual(["q1"]);
    expect(path?.done).toBe(false);
  });

  it("returns null for a learner without a role", async () => {
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: null } as never);
    expect(await getAssessmentPath("learner-1")).toBeNull();
  });
});

describe("completeActiveInstance", () => {
  it("scores every answered question and deletes answers to questions no longer in the bank", async () => {
    mockPathInputs({
      questions: [
        { id: "q1", competenceId: "comp-a" },
        { id: "q2", competenceId: "comp-a" },
      ],
      active: { id: "instance-1", instanceNum: 1 },
      responses: [
        { id: "r1", questionId: "q1", score: 1, maxScore: 1 },
        { id: "r2", questionId: "q2", score: 0, maxScore: 1 },
        // Not in the learner's bank any more (hidden, or deleted): must not count.
        { id: "r3", questionId: "q-elsewhere", score: 1, maxScore: 1 },
        { id: "r4", questionId: null, score: 1, maxScore: 1 },
      ],
    });

    expect(await completeActiveInstance("learner-1")).toBe("completed");

    expect(mockPrisma.response.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["r3", "r4"] } },
    });
    expect(mockPrisma.competenceScore.upsert).toHaveBeenCalledOnce();
    expect(mockPrisma.competenceScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          satInstanceId_competenceId: { satInstanceId: "instance-1", competenceId: "comp-a" },
        },
        update: {
          score: 1,
          maxScore: 2,
          competenceName: "comp-a",
          sectionCode: "A",
          sectionName: "Section A",
          level: 1,
        },
      }),
    );
    expect(mockPrisma.satInstance.update).toHaveBeenCalledWith({
      where: { id: "instance-1" },
      data: { completedAt: expect.any(Date) },
    });
  });

  it("counts questions never asked as 0 — the rest of a failed level and the levels above it", async () => {
    mockPathInputs({
      questions: [
        { id: "q1", competenceId: "comp-a" },
        { id: "q2", competenceId: "comp-a" },
        { id: "q3", competenceId: "comp-a" },
        { id: "q4", competenceId: "comp-b", level: 2 },
      ],
      active: { id: "instance-1", instanceNum: 1 },
      // Level 1 failed after two wrong answers: q3 and q4 are never asked.
      responses: [
        { id: "r1", questionId: "q1", score: 0.5, maxScore: 1 },
        { id: "r2", questionId: "q2", score: 0, maxScore: 1 },
      ],
    });

    expect(await completeActiveInstance("learner-1")).toBe("completed");

    const scores = mockPrisma.competenceScore.upsert.mock.calls.map(([args]) => args.update);
    expect(scores).toEqual([
      expect.objectContaining({ competenceName: "comp-a", score: 0.5, maxScore: 3, level: 1 }),
      expect.objectContaining({ competenceName: "comp-b", score: 0, maxScore: 1, level: 2 }),
    ]);
  });

  it("refuses while the path still has a next question", async () => {
    mockPathInputs({
      questions: [
        { id: "q1", competenceId: "comp-a" },
        { id: "q2", competenceId: "comp-a" },
      ],
      active: { id: "instance-1", instanceNum: 1 },
      responses: [{ id: "r1", questionId: "q1", score: 1, maxScore: 1 }],
    });

    expect(await completeActiveInstance("learner-1")).toBe("unfinished");
    expect(mockPrisma.satInstance.update).not.toHaveBeenCalled();
  });

  it("completes with no scores when there's nothing to ask", async () => {
    mockPathInputs({ questions: [], active: { id: "instance-1", instanceNum: 1 }, responses: [] });

    expect(await completeActiveInstance("learner-1")).toBe("completed");
    expect(mockPrisma.competenceScore.upsert).not.toHaveBeenCalled();
  });

  it("no-ops when the learner has no active instance", async () => {
    mockPathInputs({ questions: [], active: null, responses: [] });

    expect(await completeActiveInstance("learner-1")).toBe("none");
    expect(mockPrisma.satInstance.update).not.toHaveBeenCalled();
  });
});

describe("discardActiveInstance", () => {
  it("deletes only the learner's unfinished instances, never a completed one", async () => {
    mockPrisma.satInstance.deleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await discardActiveInstance("learner-1");

    expect(result).toBe(1);
    expect(mockPrisma.satInstance.deleteMany).toHaveBeenCalledWith({
      where: { learnerId: "learner-1", completedAt: null },
    });
  });
});

describe("getLatestCompetenceScores", () => {
  it("returns the newest score per competence, sorted by name, without ever reading the learner's role", async () => {
    mockPrisma.competenceScore.findMany.mockResolvedValue([
      { competenceId: "b", score: 1, maxScore: 2, competence: { name: "Zebra" } },
      { competenceId: "a", score: 3, maxScore: 3, competence: { name: "Apple" } },
      // An older instance's score for "a" — rows come newest instance first.
      { competenceId: "a", score: 0, maxScore: 3, competence: { name: "Apple" } },
    ] as never);

    const result = await getLatestCompetenceScores("learner-1");

    expect(result).toEqual([
      { competence: { name: "Apple" }, score: 3, maxScore: 3 },
      { competence: { name: "Zebra" }, score: 1, maxScore: 2 },
    ]);
    expect(findLearnerById).not.toHaveBeenCalled();
    expect(getRoleGrants).not.toHaveBeenCalled();
  });

  it("returns an empty list when there's no completed instance yet", async () => {
    mockPrisma.competenceScore.findMany.mockResolvedValue([]);
    expect(await getLatestCompetenceScores("learner-1")).toEqual([]);
  });
});

describe("getAttemptSectionScores", () => {
  /** A module at `level` in section `code`, with three questions `${code}${level}-1..3`. */
  function module(code: string, level: number, competence: string) {
    return {
      id: `${code}${level}`,
      level,
      section: { id: `sec-${code}`, code, name: `Section ${code}` },
      mainCompetence: { id: `comp-${competence}`, name: competence },
      secondaryCompetences: [],
      questions: [1, 2, 3].map((n) => ({
        id: `${code}${level}-${n}`,
        competence: { id: `comp-${competence}`, name: competence },
      })),
    };
  }

  function answer(questionId: string, score: number, competence: string, code: string) {
    return {
      questionId,
      score,
      maxScore: 1,
      question: { competenceId: `comp-${competence}`, sectionModule: { sectionId: `sec-${code}` } },
    };
  }

  beforeEach(() => {
    mockPrisma.satInstance.findFirst.mockReset();
    mockPrisma.satInstance.findFirst.mockResolvedValue({
      id: "instance-2",
      instanceNum: 2,
      completedAt: new Date("2026-02-01"),
    } as never);
    // Default: no role, so no extra untouched sections — overridden where needed.
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: null } as never);
  });

  it("gives one SAT's sections, with scores in level order and the skill level reached", async () => {
    // A1 passed, A2 failed after two wrong — so level 1; A2-3 and A3 never
    // asked, but they count as 0.
    mockPrisma.response.findMany.mockResolvedValue([
      answer("A1-1", 1, "Onion", "A"),
      answer("A1-2", 1, "Onion", "A"),
      answer("A1-3", 1, "Onion", "A"),
      answer("A2-1", 0, "Fingers", "A"),
      answer("A2-2", 0, "Fingers", "A"),
    ] as never);
    // Given out of order, and alphabetical order would differ from level order.
    mockPrisma.sectionModule.findMany.mockResolvedValue([
      module("A", 3, "Herbs"),
      module("A", 1, "Onion"),
      module("A", 2, "Fingers"),
    ] as never);

    const result = await getAttemptSectionScores("learner-1");

    expect(result).toEqual({
      instanceNum: 2,
      completedAt: new Date("2026-02-01"),
      sections: [
        {
          section: { id: "sec-A", code: "A", name: "Section A" },
          assessed: true,
          level: 1,
          levelCount: 3,
          competences: [
            { competence: { name: "Onion" }, level: 1, score: 3, maxScore: 3 },
            { competence: { name: "Fingers" }, level: 2, score: 0, maxScore: 3 },
            { competence: { name: "Herbs" }, level: 3, score: 0, maxScore: 3 },
          ],
        },
      ],
    });
  });

  it("reads only that SAT's answers — the latest by default, or the given one", async () => {
    mockPrisma.response.findMany.mockResolvedValue([]);
    mockPrisma.sectionModule.findMany.mockResolvedValue([]);

    await getAttemptSectionScores("learner-1");
    expect(mockPrisma.satInstance.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { learnerId: "learner-1", kind: "main", completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
      }),
    );
    expect(mockPrisma.response.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { satInstanceId: "instance-2" } }),
    );

    await getAttemptSectionScores("learner-1", 1);
    expect(mockPrisma.satInstance.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { learnerId: "learner-1", kind: "main", completedAt: { not: null }, instanceNum: 1 },
      }),
    );
  });

  it("includes sections the SAT didn't touch, unassessed at 0 with no level, in A–E order", async () => {
    mockPrisma.response.findMany.mockResolvedValue([answer("B1-1", 1, "Proofing", "B")] as never);
    // The role sees both sections; this SAT (a journey retake) only did B.
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: "student" } as never);
    mockPrisma.satInstance.count.mockResolvedValue(1);
    vi.mocked(getRoleGrants).mockResolvedValue({
      sectionIds: ["sec-A", "sec-B"],
      competenceIds: [],
    });
    mockPrisma.section.findMany.mockResolvedValue([
      { id: "sec-A", name: "Section A" },
      { id: "sec-B", name: "Section B" },
    ] as never);
    mockPrisma.sectionModule.findMany.mockResolvedValue([
      module("B", 1, "Proofing"),
      module("A", 1, "Onion"),
    ] as never);

    const result = await getAttemptSectionScores("learner-1");

    expect(result?.sections.map((s) => [s.section.code, s.assessed, s.level])).toEqual([
      ["A", false, null],
      ["B", true, 0],
    ]);
    expect(result?.sections[0].competences).toEqual([
      { competence: { name: "Onion" }, level: 1, score: 0, maxScore: 0 },
    ]);
  });

  it("ignores answers whose question was deleted", async () => {
    mockPrisma.response.findMany.mockResolvedValue([
      { questionId: null, score: 1, maxScore: 1, question: null },
    ] as never);
    mockPrisma.sectionModule.findMany.mockResolvedValue([]);

    expect((await getAttemptSectionScores("learner-1"))?.sections).toEqual([]);
  });

  it("returns null when there's no such completed SAT", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValue(null);
    expect(await getAttemptSectionScores("learner-1")).toBeNull();
    expect(await getAttemptSectionScores("learner-1", 7)).toBeNull();
  });
});

describe("listAssessableSections", () => {
  it("lists the sections with a question the learner's role can see", async () => {
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: "student" } as never);
    mockPrisma.satInstance.count.mockResolvedValue(1);
    vi.mocked(getRoleGrants).mockResolvedValue({ sectionIds: ["section-1"], competenceIds: [] });
    mockPrisma.section.findMany.mockResolvedValue([{ id: "section-1" }] as never);

    expect(await listAssessableSections("learner-1")).toEqual([{ id: "section-1" }]);
    expect(mockPrisma.section.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          modules: {
            some: {
              questions: {
                some: {
                  OR: [
                    { competenceId: { in: [] } },
                    { sectionModule: { sectionId: { in: ["section-1"] } } },
                  ],
                },
              },
            },
          },
        },
      }),
    );
  });

  it("returns nothing for a learner without a role", async () => {
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: null } as never);
    expect(await listAssessableSections("learner-1")).toEqual([]);
  });
});

describe("startReassessment", () => {
  const input = { completedJourneyId: "journey-1", sectionIds: ["section-1", "section-1"] };

  beforeEach(() => {
    // mockReset, not just the global clear: drops "Once" values other tests left queued.
    mockPrisma.satInstance.findFirst.mockReset();
    mockPrisma.satInstance.create.mockReset();
    mockPrisma.satInstance.findFirst.mockResolvedValue(null); // no active instance, no prior num
    mockPrisma.satInstance.count.mockResolvedValue(1); // first assessment done
    mockPrisma.learningJourney.findUnique.mockResolvedValue({ name: "Knife Ninja" } as never);
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: "student" } as never);
    vi.mocked(getRoleGrants).mockResolvedValue({ sectionIds: ["section-1"], competenceIds: [] });
    mockPrisma.section.findMany.mockResolvedValue([
      { id: "section-1", name: "Knife Skills" },
    ] as never);
  });

  it("creates an instance recording the journey and its (deduplicated) sections", async () => {
    mockPrisma.satInstance.findFirst
      .mockResolvedValueOnce(null) // no active instance
      .mockResolvedValueOnce({ instanceNum: 2 } as never); // highest so far

    expect(await startReassessment("learner-1", input)).toEqual({ ok: true });
    expect(mockPrisma.satInstance.create).toHaveBeenCalledWith({
      data: {
        learnerId: "learner-1",
        instanceNum: 3,
        completedJourneyId: "journey-1",
        completedJourneyName: "Knife Ninja",
        reassessedSectionNames: ["Knife Skills"],
        sections: { create: [{ sectionId: "section-1" }] },
      },
    });
  });

  it("refuses while another assessment is in progress", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValueOnce({ id: "active" } as never);

    expect(await startReassessment("learner-1", input)).toMatchObject({ ok: false, status: 409 });
    expect(mockPrisma.satInstance.create).not.toHaveBeenCalled();
  });

  it("refuses before the first assessment is done", async () => {
    mockPrisma.satInstance.count.mockResolvedValue(0);

    expect(await startReassessment("learner-1", input)).toMatchObject({ ok: false, status: 409 });
  });

  it("refuses an unknown journey", async () => {
    mockPrisma.learningJourney.findUnique.mockResolvedValue(null);

    expect(await startReassessment("learner-1", input)).toMatchObject({ ok: false, status: 400 });
    expect(mockPrisma.satInstance.create).not.toHaveBeenCalled();
  });

  it("refuses sections the learner can't be assessed in", async () => {
    const result = await startReassessment("learner-1", {
      completedJourneyId: "journey-1",
      sectionIds: ["section-1", "hidden-section"],
    });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(mockPrisma.satInstance.create).not.toHaveBeenCalled();
  });
});

describe("getSatHistory", () => {
  /** A score with its section and level copied, as completeActiveInstance stores it. */
  function copied(
    competenceName: string,
    score: number,
    maxScore: number,
    sectionCode: string,
    sectionName: string,
    level: number,
  ) {
    return { score, maxScore, competence: null, competenceName, sectionCode, sectionName, level };
  }

  it("groups each instance's module scores by section (A–E), modules in level order", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([
      {
        instanceNum: 1,
        completedAt: new Date("2026-01-01"),
        sections: [],
        competenceScores: [
          copied("Proofing", 1, 3, "B", "Baking", 1),
          copied("Fingers", 0, 3, "A", "Knife Skills", 2),
          copied("Onion", 2, 3, "A", "Knife Skills", 1),
        ],
      },
    ] as never);

    const [entry] = await getSatHistory("learner-1");

    expect(entry).toEqual({
      instanceNum: 1,
      completedAt: new Date("2026-01-01"),
      sumScore: 3,
      sumMaxScore: 9,
      sections: [
        {
          code: "A",
          name: "Knife Skills",
          areas: [
            { name: "Onion", score: 2, maxScore: 3 },
            { name: "Fingers", score: 0, maxScore: 3 },
          ],
        },
        { code: "B", name: "Baking", areas: [{ name: "Proofing", score: 1, maxScore: 3 }] },
      ],
      completedJourney: null,
      reassessedSections: [],
    });
  });

  it("falls back to the live module for older scores without copied sections", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([
      {
        instanceNum: 1,
        completedAt: new Date("2026-01-01"),
        sections: [],
        competenceScores: [
          {
            score: 1,
            maxScore: 3,
            competenceName: null,
            competence: {
              name: "Onion",
              mainForModules: [{ level: 1, section: { code: "A", name: "Knife Skills" } }],
            },
          },
        ],
      },
    ] as never);

    const [entry] = await getSatHistory("learner-1");

    expect(entry.sections).toEqual([
      { code: "A", name: "Knife Skills", areas: [{ name: "Onion", score: 1, maxScore: 3 }] },
    ]);
  });

  it("still shows a reassessment after its journey, sections and competences were deleted", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([
      {
        instanceNum: 3,
        completedAt: new Date("2026-04-01"),
        // Journey deleted: the link is gone, the copied name isn't.
        completedJourney: null,
        completedJourneyName: "Knife Ninja",
        // Sections deleted: no live rows, the copied names remain.
        sections: [],
        reassessedSectionNames: ["Knife Skills"],
        competenceScores: [
          // Deleted after names and sections were copied.
          copied("Onion Dicing", 2, 3, "A", "Knife Skills", 1),
          // Deleted before anything was copied (an older score).
          { score: 1, maxScore: 1, competence: null, competenceName: null },
        ],
      },
    ] as never);

    const [entry] = await getSatHistory("learner-1");

    expect(entry).toEqual({
      instanceNum: 3,
      completedAt: new Date("2026-04-01"),
      sumScore: 3,
      sumMaxScore: 4,
      sections: [
        {
          code: "A",
          name: "Knife Skills",
          areas: [{ name: "Onion Dicing", score: 2, maxScore: 3 }],
        },
        {
          code: null,
          name: "Other",
          areas: [{ name: "Removed competence", score: 1, maxScore: 1 }],
        },
      ],
      completedJourney: "Knife Ninja",
      reassessedSections: ["Knife Skills"],
    });
  });

  it("prefers the copied names over the live ones, so renames don't rewrite history", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([
      {
        instanceNum: 2,
        completedAt: new Date("2026-03-01"),
        completedJourney: { name: "Renamed Journey" },
        completedJourneyName: "Knife Ninja",
        sections: [{ section: { name: "Renamed Section" } }],
        reassessedSectionNames: ["Knife Skills"],
        competenceScores: [
          {
            ...copied("Original", 1, 1, "A", "Knife Skills", 1),
            competence: {
              name: "Renamed",
              mainForModules: [{ level: 1, section: { code: "A", name: "Renamed Section" } }],
            },
          },
        ],
      },
    ] as never);

    const [entry] = await getSatHistory("learner-1");

    expect(entry.completedJourney).toBe("Knife Ninja");
    expect(entry.reassessedSections).toEqual(["Knife Skills"]);
    expect(entry.sections[0].name).toBe("Knife Skills");
    expect(entry.sections[0].areas[0].name).toBe("Original");
  });

  it("names the completed journey and only the sections the learner ticked", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([
      {
        instanceNum: 2,
        completedAt: new Date("2026-03-01"),
        competenceScores: [],
        completedJourney: { name: "Knife Ninja" },
        sections: [{ section: { name: "Knife Skills" } }],
      },
    ] as never);

    const [entry] = await getSatHistory("learner-1");

    expect(entry.completedJourney).toBe("Knife Ninja");
    expect(entry.reassessedSections).toEqual(["Knife Skills"]);
  });

  it("only lists the modules that specific instance actually covered, not every one in the bank", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([
      {
        instanceNum: 1,
        completedAt: new Date("2026-01-01"),
        sections: [],
        competenceScores: [copied("Only This One", 1, 1, "A", "Knife Skills", 1)],
      },
    ] as never);

    const [entry] = await getSatHistory("learner-1");

    expect(entry.sections.flatMap((s) => s.areas).map((a) => a.name)).toEqual(["Only This One"]);
  });

  it("returns an empty list when the learner has no completed instances", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([]);
    expect(await getSatHistory("learner-1")).toEqual([]);
  });

  it("queries only completed instances, ordered oldest first", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([]);

    await getSatHistory("learner-1");

    expect(mockPrisma.satInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { learnerId: "learner-1", kind: "main", completedAt: { not: null } },
        orderBy: { instanceNum: "asc" },
      }),
    );
  });
});

describe("journey assessments", () => {
  beforeEach(() => {
    config.roleSelectionEnabled = false;
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: null } as never);
  });

  describe("startJourneyAssessment", () => {
    const journey = {
      name: "LJ2 — Research Data",
      sections: [{ sectionId: "sec-a" }, { sectionId: "sec-b" }, { sectionId: "sec-x" }],
    };

    it("refuses while another assessment is in progress", async () => {
      mockPrisma.satInstance.findFirst.mockResolvedValueOnce({ id: "active" } as never);

      const result = await startJourneyAssessment("learner-1", "journey-2");
      expect(result).toMatchObject({ ok: false, status: 409 });
      expect(mockPrisma.satInstance.create).not.toHaveBeenCalled();
    });

    it("refuses an unknown journey", async () => {
      mockPrisma.satInstance.findFirst.mockResolvedValueOnce(null);
      mockPrisma.learningJourney.findUnique.mockResolvedValue(null);

      expect(await startJourneyAssessment("learner-1", "nope")).toMatchObject({
        ok: false,
        status: 404,
      });
    });

    it("asks only for the journey's M sections, and only ones that have questions", async () => {
      mockPrisma.satInstance.findFirst.mockResolvedValueOnce(null); // nothing in progress
      mockPrisma.learningJourney.findUnique.mockResolvedValue(journey as never);
      mockPrisma.section.findMany.mockResolvedValue([
        { id: "sec-a", name: "A" },
        { id: "sec-b", name: "B" },
      ] as never); // sec-x has no questions
      mockPrisma.satInstance.findFirst.mockResolvedValueOnce({ instanceNum: 2 } as never);

      const result = await startJourneyAssessment("learner-1", "journey-2");

      expect(result).toEqual({ ok: true, sectionIds: ["sec-a", "sec-b"] });
      expect(mockPrisma.learningJourney.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            sections: { where: { coverageLevel: "M" }, select: { sectionId: true } },
          }),
        }),
      );
      // Numbered among journey assessments only, so main ones keep 1, 2, 3 …
      expect(mockPrisma.satInstance.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { learnerId: "learner-1", kind: "journey" } }),
      );
      expect(mockPrisma.satInstance.create).toHaveBeenCalledWith({
        data: {
          learnerId: "learner-1",
          instanceNum: 3,
          kind: "journey",
          assessedJourneyId: "journey-2",
          assessedJourneyName: "LJ2 — Research Data",
          sections: { create: [{ sectionId: "sec-a" }, { sectionId: "sec-b" }] },
        },
      });
    });

    it("refuses a journey with nothing to assess yet", async () => {
      mockPrisma.satInstance.findFirst.mockResolvedValueOnce(null);
      mockPrisma.learningJourney.findUnique.mockResolvedValue(journey as never);
      mockPrisma.section.findMany.mockResolvedValue([] as never);

      expect(await startJourneyAssessment("learner-1", "journey-2")).toMatchObject({
        ok: false,
        status: 400,
      });
    });
  });

  it("counts only main assessments as having done the self-assessment", async () => {
    mockPrisma.satInstance.count.mockResolvedValue(0 as never);

    expect(await hasCompletedMainAssessment("learner-1")).toBe(false);
    expect(mockPrisma.satInstance.count).toHaveBeenCalledWith({
      where: { learnerId: "learner-1", kind: "main", completedAt: { not: null } },
    });
  });

  describe("getCompetencies", () => {
    const sectionA = {
      id: "sec-a",
      code: "A",
      name: "Fundamentals",
      modules: [
        { id: "mod-a1", name: "A1 — Intro", level: 1, moodleUrl: "https://moodle.test/a1" },
        { id: "mod-a2", name: "A2 — Data", level: 2, moodleUrl: null },
      ],
    };
    const sectionB = {
      id: "sec-b",
      code: "B",
      name: "Repositories",
      modules: [{ id: "mod-b1", name: "B1 — Repos", level: 1, moodleUrl: null }],
    };
    const answerIn = (moduleId: string, score: number, instance: object) => ({
      score,
      maxScore: 1,
      question: { sectionModuleId: moduleId },
      satInstance: instance,
    });

    beforeEach(() => {
      mockPrisma.section.findMany
        .mockResolvedValueOnce([{ id: "sec-a" }, { id: "sec-b" }] as never) // assessable
        .mockResolvedValueOnce([sectionA, sectionB] as never);
    });

    it("shows each module's best over main and journey assessments, and a section percentage", async () => {
      mockPrisma.satInstance.findFirst.mockResolvedValue(null); // no main assessment yet
      const main = {
        id: "main-1",
        kind: "main",
        completedAt: new Date("2026-10-01"),
        assessedJourneyName: null,
      };
      const journey = {
        id: "j-1",
        kind: "journey",
        completedAt: new Date("2026-10-05"),
        assessedJourneyName: "LJ2 — Research Data",
      };
      mockPrisma.response.findMany.mockResolvedValue([
        answerIn("mod-a1", 0, main),
        answerIn("mod-a1", 1, journey),
        answerIn("mod-a2", 0.5, main),
      ] as never);

      const { sections, recommendedJourney } = await getCompetencies("learner-1");

      expect(recommendedJourney).toBeNull();
      const [a, b] = sections;
      expect(a.modules.map((m) => [m.code, m.best?.percent ?? null, m.best?.kind ?? null])).toEqual(
        [
          ["A1", 100, "journey"],
          ["A2", 50, "main"],
        ],
      );
      expect(a).toMatchObject({ percent: 75, assessedModules: 2, moduleCount: 2 });
      expect(b).toMatchObject({ percent: null, assessedModules: 0 });
    });

    it("puts the recommended journey's M sections first, marked relevant", async () => {
      mockPrisma.satInstance.findFirst.mockResolvedValue({ advice: null } as never);
      vi.mocked(recommendJourney).mockResolvedValue({
        id: "journey-2",
        name: "LJ2",
        moodleUrl: "https://moodle.test/lj2",
      } as never);
      mockPrisma.journeySection.findMany.mockResolvedValue([{ sectionId: "sec-b" }] as never);
      mockPrisma.response.findMany.mockResolvedValue([] as never);

      const { sections, recommendedJourney } = await getCompetencies("learner-1");

      expect(recommendedJourney).toEqual({
        id: "journey-2",
        name: "LJ2",
        moodleUrl: "https://moodle.test/lj2",
      });
      expect(sections.map((s) => [s.code, s.relevant])).toEqual([
        ["B", true],
        ["A", false],
      ]);
      expect(sections[0].modules.every((m) => m.relevant)).toBe(true);
    });

    it("prefers the AI advisor's journey over the score-based one", async () => {
      mockPrisma.satInstance.findFirst.mockResolvedValue({
        advice: { journeyId: "journey-6" },
      } as never);
      mockPrisma.learningJourney.findUnique.mockResolvedValue({
        id: "journey-6",
        name: "LJ6",
        moodleUrl: null,
      } as never);
      mockPrisma.journeySection.findMany.mockResolvedValue([{ sectionId: "sec-a" }] as never);
      mockPrisma.response.findMany.mockResolvedValue([] as never);

      const { recommendedJourney } = await getCompetencies("learner-1");

      expect(recommendedJourney?.id).toBe("journey-6");
      expect(recommendJourney).not.toHaveBeenCalled();
      expect(suggestJourney).not.toHaveBeenCalled();
    });
  });
});
