import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeActiveInstance,
  discardActiveInstance,
  getLatestCompetenceScores,
  getLatestSectionCompetenceScores,
  getSatHistory,
  listAssessableSections,
  listQuestions,
  saveResponse,
  startReassessment,
} from "./assessment.service";
import { prisma } from "../../db/prisma";
import { findLearnerById, getRoleGrants } from "../identity/identity.service";
import { IDK_VALUE } from "./assessment.scoring";

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
    response: { findMany: vi.fn(), upsert: vi.fn() },
    competenceScore: { findMany: vi.fn(), upsert: vi.fn() },
    sectionModule: { findMany: vi.fn() },
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

describe("completeActiveInstance", () => {
  it("sums scored responses per competence and upserts one CompetenceScore each", async () => {
    mockPrisma.satInstance.findFirst.mockResolvedValueOnce({ id: "instance-1" } as never);
    mockPrisma.response.findMany.mockResolvedValue([
      {
        score: 1,
        maxScore: 1,
        question: { competenceId: "competence-a", competence: { name: "A" } },
      },
      {
        score: 0,
        maxScore: 1,
        question: { competenceId: "competence-a", competence: { name: "A" } },
      },
      {
        score: 3,
        maxScore: 4,
        question: { competenceId: "competence-b", competence: { name: "B" } },
      },
      // The question was deleted since — nothing to score it against.
      { score: 5, maxScore: 5, question: null },
    ] as never);

    await completeActiveInstance("learner-1");

    expect(mockPrisma.competenceScore.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.competenceScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          satInstanceId_competenceId: { satInstanceId: "instance-1", competenceId: "competence-a" },
        },
        update: { score: 1, maxScore: 2, competenceName: "A" },
      }),
    );
    expect(mockPrisma.competenceScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          satInstanceId_competenceId: { satInstanceId: "instance-1", competenceId: "competence-b" },
        },
        update: { score: 3, maxScore: 4, competenceName: "B" },
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

describe("getLatestSectionCompetenceScores", () => {
  it("builds section/competence totals from the instance's own responses, without reading the learner's role", async () => {
    mockPrisma.response.findMany.mockResolvedValue([
      {
        satInstanceId: "instance-1",
        score: 2,
        maxScore: 3,
        question: { competenceId: "comp-a", sectionModule: { sectionId: "section-1" } },
      },
    ] as never);
    mockPrisma.sectionModule.findMany.mockResolvedValue([
      {
        section: { id: "section-1", name: "Section One" },
        mainCompetence: { id: "comp-a", name: "Competence A" },
        secondaryCompetences: [],
        questions: [],
      },
    ] as never);

    const result = await getLatestSectionCompetenceScores("learner-1");

    expect(result).toEqual([
      {
        section: { id: "section-1", name: "Section One" },
        competences: [{ competence: { name: "Competence A" }, score: 2, maxScore: 3 }],
      },
    ]);
    expect(findLearnerById).not.toHaveBeenCalled();
    expect(getRoleGrants).not.toHaveBeenCalled();
  });

  it("uses each section's newest assessment, so a partial reassessment keeps the other sections", async () => {
    // Newest instance first: instance-2 reassessed only section-1.
    mockPrisma.response.findMany.mockResolvedValue([
      {
        satInstanceId: "instance-2",
        score: 3,
        maxScore: 3,
        question: { competenceId: "comp-a", sectionModule: { sectionId: "section-1" } },
      },
      {
        satInstanceId: "instance-1",
        score: 0,
        maxScore: 3,
        question: { competenceId: "comp-a", sectionModule: { sectionId: "section-1" } },
      },
      {
        satInstanceId: "instance-1",
        score: 1,
        maxScore: 3,
        question: { competenceId: "comp-b", sectionModule: { sectionId: "section-2" } },
      },
    ] as never);
    mockPrisma.sectionModule.findMany.mockResolvedValue([
      {
        section: { id: "section-1", name: "Section One" },
        mainCompetence: { id: "comp-a", name: "Competence A" },
        secondaryCompetences: [],
        questions: [],
      },
      {
        section: { id: "section-2", name: "Section Two" },
        mainCompetence: { id: "comp-b", name: "Competence B" },
        secondaryCompetences: [],
        questions: [],
      },
    ] as never);

    const result = await getLatestSectionCompetenceScores("learner-1");

    expect(result).toEqual([
      {
        section: { id: "section-1", name: "Section One" },
        competences: [{ competence: { name: "Competence A" }, score: 3, maxScore: 3 }],
      },
      {
        section: { id: "section-2", name: "Section Two" },
        competences: [{ competence: { name: "Competence B" }, score: 1, maxScore: 3 }],
      },
    ]);
  });

  it("returns an empty list when there's no completed instance yet", async () => {
    mockPrisma.response.findMany.mockResolvedValue([]);
    expect(await getLatestSectionCompetenceScores("learner-1")).toEqual([]);
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
  it("returns each completed instance with a summed score and its own area breakdown", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([
      {
        instanceNum: 1,
        completedAt: new Date("2026-01-01"),
        sections: [],
        competenceScores: [
          { score: 2, maxScore: 5, competence: { name: "Open Science" } },
          { score: 1, maxScore: 3, competence: { name: "Data Management" } },
        ],
      },
      {
        instanceNum: 2,
        completedAt: new Date("2026-02-01"),
        sections: [],
        competenceScores: [{ score: 4, maxScore: 5, competence: { name: "Open Science" } }],
      },
    ] as never);

    const history = await getSatHistory("learner-1");

    expect(history).toEqual([
      {
        instanceNum: 1,
        completedAt: new Date("2026-01-01"),
        sumScore: 3,
        sumMaxScore: 8,
        areas: [
          { name: "Data Management", score: 1, maxScore: 3 },
          { name: "Open Science", score: 2, maxScore: 5 },
        ],
        completedJourney: null,
        reassessedSections: [],
      },
      {
        instanceNum: 2,
        completedAt: new Date("2026-02-01"),
        sumScore: 4,
        sumMaxScore: 5,
        areas: [{ name: "Open Science", score: 4, maxScore: 5 }],
        completedJourney: null,
        reassessedSections: [],
      },
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
          // Deleted after names were copied.
          { score: 2, maxScore: 3, competence: null, competenceName: "Onion Dicing" },
          // Deleted before names were copied (an older score).
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
      areas: [
        { name: "Onion Dicing", score: 2, maxScore: 3 },
        { name: "Removed competence", score: 1, maxScore: 1 },
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
          { score: 1, maxScore: 1, competence: { name: "Renamed" }, competenceName: "Original" },
        ],
      },
    ] as never);

    const [entry] = await getSatHistory("learner-1");

    expect(entry.completedJourney).toBe("Knife Ninja");
    expect(entry.reassessedSections).toEqual(["Knife Skills"]);
    expect(entry.areas[0].name).toBe("Original");
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

  it("only lists the areas that specific instance actually covered, not every area in the bank", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([
      {
        instanceNum: 1,
        completedAt: new Date("2026-01-01"),
        sections: [],
        competenceScores: [{ score: 1, maxScore: 1, competence: { name: "Only This One" } }],
      },
    ] as never);

    const [entry] = await getSatHistory("learner-1");

    expect(entry.areas).toHaveLength(1);
    expect(entry.areas[0].name).toBe("Only This One");
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
        where: { learnerId: "learner-1", completedAt: { not: null } },
        orderBy: { instanceNum: "asc" },
      }),
    );
  });
});
