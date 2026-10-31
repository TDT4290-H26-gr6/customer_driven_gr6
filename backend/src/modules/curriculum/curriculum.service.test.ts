import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../db/prisma";
import { recordChange, snapshot } from "./curriculum.audit";
import * as curriculum from "./curriculum.service";
import type { QuestionInput } from "./curriculum.validation";

vi.mock("../../db/prisma", () => {
  const model = () => ({
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    count: vi.fn(),
  });
  return {
    prisma: {
      section: model(),
      sectionModule: model(),
      competence: model(),
      question: model(),
      sectionModuleSecondaryCompetence: model(),
      learningJourney: model(),
      journeySection: model(),
      learningModule: model(),
      source: model(),
      auditEvent: model(),
      $transaction: vi.fn(),
    },
  };
});

// What's logged is tested here through these two; how a snapshot and an entry
// are built is curriculum.audit.test.ts.
vi.mock("./curriculum.audit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./curriculum.audit")>()),
  snapshot: vi.fn(),
  recordChange: vi.fn(),
}));

const db = vi.mocked(prisma, true);
const actor = { id: "admin-1", name: "Ada Admin", email: "ada@ntnu.no" };

/** The one log entry written, without the actor and transaction it was written with. */
function logged() {
  expect(recordChange).toHaveBeenCalledTimes(1);
  const [tx, by, change] = vi.mocked(recordChange).mock.calls[0];
  expect(tx).toBe(db);
  expect(by).toBe(actor);
  return change;
}

const input: QuestionInput = {
  questionType: "single_choice",
  prompt: "Which licence is open?",
  sectionModuleId: "mod-1",
  competenceId: "c-1",
  content: {
    options: [
      { id: "a", text: "CC BY" },
      { id: "b", text: "All rights reserved" },
    ],
    correctOptionIds: ["a"],
  },
};

/** The module and competence the input points at exist. */
function placementExists() {
  db.sectionModule.findUnique.mockResolvedValue({ id: "mod-1" } as never);
  db.competence.findUnique.mockResolvedValue({ id: "c-1" } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  // A change runs inside an interactive transaction: here, against the mock.
  db.$transaction.mockImplementation(((run: (tx: typeof db) => unknown) => run(db)) as never);
  vi.mocked(snapshot).mockImplementation(async (_tx, type, id) => ({
    snapshotOf: `${type}:${id}`,
  }));
});

describe("getCurriculum", () => {
  it("returns sections, competences with usage counts, and every question", async () => {
    db.section.findMany.mockResolvedValue([
      {
        id: "sec-a",
        retiredAt: null,
        _count: { journeySections: 2, satInstances: 1 },
        modules: [
          {
            id: "mod-1",
            name: "Licences",
            secondaryCompetences: [{ competenceId: "c-2" }],
            _count: { questions: 3 },
          },
        ],
      },
    ] as never);
    db.competence.findMany.mockResolvedValue([
      {
        id: "c-1",
        name: "Licensing",
        description: null,
        _count: { questions: 4, mainForModules: 1 },
      },
    ] as never);
    db.learningJourney.findMany.mockResolvedValue([
      {
        id: "lj-1",
        name: "Data steward",
        sections: [{ sectionId: "sec-a", coverageLevel: "M" }],
        modules: [{ id: "step-1", title: "Plan" }],
        _count: {
          recommendations: 0,
          chosenInAdvice: 1,
          runnerUpInAdvice: 0,
          satInstances: 0,
          assessedIn: 0,
        },
      },
      {
        id: "lj-2",
        name: "Unused",
        sections: [],
        modules: [],
        _count: {
          recommendations: 0,
          chosenInAdvice: 0,
          runnerUpInAdvice: 0,
          satInstances: 0,
          assessedIn: 0,
        },
      },
    ] as never);
    db.source.findMany.mockResolvedValue([
      { id: "src-1", courseName: "FAIR", institution: "NTNU" },
    ] as never);
    db.question.findMany.mockResolvedValue([
      {
        id: "q-1",
        prompt: "?",
        questionType: "likert",
        sectionModuleId: "mod-1",
        competenceId: "c-1",
        retiredAt: null,
        authoredContent: { scale: { min: 1, max: 5 } },
        _count: { responses: 3 },
      },
      {
        id: "q-2",
        prompt: "?",
        questionType: "likert",
        sectionModuleId: "mod-1",
        competenceId: "c-1",
        retiredAt: null,
        authoredContent: null,
        _count: { responses: 0 },
      },
    ] as never);
    const at = (day: number) => new Date(`2026-10-${day}T12:00:00Z`);
    db.auditEvent.findMany.mockResolvedValue([
      {
        entityType: "question",
        entityId: "q-1",
        action: "created",
        createdAt: at(1),
        actorName: "Ada",
        actorEmail: "ada@ntnu.no",
      },
      {
        entityType: "question",
        entityId: "q-1",
        action: "edited",
        createdAt: at(2),
        actorName: null,
        actorEmail: "bo@ntnu.no",
      },
      {
        entityType: "section",
        entityId: "sec-a",
        action: "edited",
        createdAt: at(3),
        actorName: "Ada",
        actorEmail: "ada@ntnu.no",
      },
    ] as never);

    const result = await curriculum.getCurriculum();

    const none = { created: null, lastChange: null };
    expect(result.sections).toEqual([
      {
        id: "sec-a",
        retiredAt: null,
        history: { created: null, lastChange: { at: at(3), by: "Ada", action: "edited" } },
        journeyCount: 2,
        usedInAssessments: true,
        modules: [
          {
            id: "mod-1",
            name: "Licences",
            history: none,
            secondaryCompetenceIds: ["c-2"],
            questionCount: 3,
          },
        ],
      },
    ]);
    expect(result.journeys).toEqual([
      {
        id: "lj-1",
        name: "Data steward",
        sections: [{ sectionId: "sec-a", coverageLevel: "M" }],
        history: none,
        steps: [{ id: "step-1", title: "Plan" }],
        used: true,
      },
      { id: "lj-2", name: "Unused", history: none, sections: [], steps: [], used: false },
    ]);
    expect(result.sources).toEqual([{ id: "src-1", courseName: "FAIR", institution: "NTNU" }]);
    expect(result.competences).toEqual([
      {
        id: "c-1",
        name: "Licensing",
        description: null,
        history: none,
        questionCount: 4,
        moduleCount: 1,
      },
    ]);
    // Who added it, and the latest change (by email when there's no name).
    expect(result.questions[0]).toMatchObject({
      id: "q-1",
      answerCount: 3,
      editable: true,
      history: {
        created: { at: at(1), by: "Ada" },
        lastChange: { at: at(2), by: "bo@ntnu.no", action: "edited" },
      },
    });
    expect(result.questions[0]).not.toHaveProperty("authoredContent");
    expect(result.questions[1]).toMatchObject({ editable: false });
  });
});

describe("getQuestion", () => {
  it("returns the question with its authored form, or null", async () => {
    db.question.findUnique.mockResolvedValueOnce({
      id: "q-1",
      authoredContent: { scale: { min: 1, max: 5 } },
      _count: { responses: 0 },
    } as never);
    expect(await curriculum.getQuestion("q-1")).toMatchObject({
      id: "q-1",
      answerCount: 0,
      authoredContent: { scale: { min: 1, max: 5 } },
    });

    db.question.findUnique.mockResolvedValueOnce(null);
    expect(await curriculum.getQuestion("nope")).toBeNull();
  });
});

describe("createQuestion", () => {
  it("saves the authored form and the PIE item built from it", async () => {
    placementExists();
    db.question.create.mockResolvedValue({ id: "q-new" } as never);

    expect(await curriculum.createQuestion(actor, input)).toEqual({ ok: true, id: "q-new" });
    expect(logged()).toEqual({
      entityType: "question",
      entityId: "q-new",
      action: "created",
      before: null,
      after: { snapshotOf: "question:q-new" },
    });
    const { data } = db.question.create.mock.calls[0][0];
    expect(data).toMatchObject({
      questionType: "single_choice",
      prompt: "Which licence is open?",
      authoredContent: input.content,
      sectionModuleId: "mod-1",
      competenceId: "c-1",
    });
    // The same PIE item the seed builds, "I don't know" included.
    const choices = (
      data.content as { models: { choices: { value: string; correct: boolean }[] }[] }
    ).models[0].choices;
    expect(choices.map((c) => [c.value, c.correct])).toEqual([
      ["a", true],
      ["b", false],
      ["__idk__", false],
    ]);
  });

  it("is a 400 when the module or competence is gone", async () => {
    db.sectionModule.findUnique.mockResolvedValue(null);
    db.competence.findUnique.mockResolvedValue({ id: "c-1" } as never);
    expect(await curriculum.createQuestion(actor, input)).toMatchObject({ ok: false, status: 400 });
    expect(db.question.create).not.toHaveBeenCalled();
    expect(recordChange).not.toHaveBeenCalled();
  });
});

describe("updateQuestion", () => {
  it("saves an edit", async () => {
    db.question.findUnique.mockResolvedValue({
      questionType: "single_choice",
      _count: { responses: 5 },
    } as never);
    placementExists();

    expect(await curriculum.updateQuestion(actor, "q-1", input)).toEqual({ ok: true, id: "q-1" });
    expect(db.question.update).toHaveBeenCalledWith({
      where: { id: "q-1" },
      data: expect.objectContaining({ prompt: "Which licence is open?" }),
    });
    // The values before are read before the change, the values after once it's made.
    expect(snapshot).toHaveBeenCalledTimes(2);
    expect(vi.mocked(snapshot).mock.invocationCallOrder[0]).toBeLessThan(
      db.question.update.mock.invocationCallOrder[0],
    );
    expect(logged()).toMatchObject({ entityId: "q-1", action: "edited" });
  });

  it("refuses to change the type of a question learners have answered", async () => {
    db.question.findUnique.mockResolvedValue({
      questionType: "likert",
      _count: { responses: 2 },
    } as never);
    expect(await curriculum.updateQuestion(actor, "q-1", input)).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(db.question.update).not.toHaveBeenCalled();
    expect(recordChange).not.toHaveBeenCalled();
  });

  it("lets an unanswered question change type", async () => {
    db.question.findUnique.mockResolvedValue({
      questionType: "likert",
      _count: { responses: 0 },
    } as never);
    placementExists();
    expect(await curriculum.updateQuestion(actor, "q-1", input)).toEqual({ ok: true, id: "q-1" });
  });

  it("is a 404 for an unknown question and a 400 for a missing module", async () => {
    db.question.findUnique.mockResolvedValueOnce(null);
    expect(await curriculum.updateQuestion(actor, "nope", input)).toMatchObject({ status: 404 });

    db.question.findUnique.mockResolvedValueOnce({
      questionType: "single_choice",
      _count: { responses: 0 },
    } as never);
    db.sectionModule.findUnique.mockResolvedValue(null);
    expect(await curriculum.updateQuestion(actor, "q-1", input)).toMatchObject({ status: 400 });
  });
});

describe("removeQuestion", () => {
  it("deletes a question nobody has answered", async () => {
    db.question.findUnique.mockResolvedValue({ _count: { responses: 0 } } as never);
    expect(await curriculum.removeQuestion(actor, "q-1")).toBe("deleted");
    expect(db.question.delete).toHaveBeenCalledWith({ where: { id: "q-1" } });
    // Gone, so nothing after; what it was is kept in the log.
    expect(logged()).toEqual({
      entityType: "question",
      entityId: "q-1",
      action: "deleted",
      before: { snapshotOf: "question:q-1" },
      after: null,
    });
  });

  it("retires a question with answers, so past results keep it", async () => {
    db.question.findUnique.mockResolvedValue({ _count: { responses: 1 } } as never);
    expect(await curriculum.removeQuestion(actor, "q-1")).toBe("retired");
    expect(db.question.delete).not.toHaveBeenCalled();
    expect(db.question.update).toHaveBeenCalledWith({
      where: { id: "q-1" },
      data: { retiredAt: expect.any(Date) },
    });
    expect(logged()).toMatchObject({ action: "retired" });
  });

  it("is null for an unknown question, and logs nothing", async () => {
    db.question.findUnique.mockResolvedValue(null);
    expect(await curriculum.removeQuestion(actor, "nope")).toBeNull();
    expect(recordChange).not.toHaveBeenCalled();
  });
});

describe("restoreQuestion", () => {
  it("brings a retired question back", async () => {
    db.question.updateMany.mockResolvedValue({ count: 1 });
    expect(await curriculum.restoreQuestion(actor, "q-1")).toBe(true);
    expect(db.question.updateMany).toHaveBeenCalledWith({
      where: { id: "q-1" },
      data: { retiredAt: null },
    });
    expect(logged()).toMatchObject({ entityId: "q-1", action: "restored" });

    db.question.updateMany.mockResolvedValue({ count: 0 });
    expect(await curriculum.restoreQuestion(actor, "nope")).toBe(false);
  });
});

describe("competences", () => {
  it("creates one", async () => {
    db.competence.create.mockResolvedValue({ id: "c-9", name: "Licensing" } as never);
    await curriculum.createCompetence(actor, { name: "Licensing", description: null });
    expect(db.competence.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: "Licensing", description: null } }),
    );
    expect(logged()).toMatchObject({
      entityType: "competence",
      entityId: "c-9",
      action: "created",
    });
  });

  it("renames one, or returns null when it doesn't exist", async () => {
    db.competence.updateMany.mockResolvedValueOnce({ count: 1 });
    db.competence.findUnique.mockResolvedValueOnce({ id: "c-1", name: "Open licensing" } as never);
    expect(
      await curriculum.updateCompetence(actor, "c-1", {
        name: "Open licensing",
        description: null,
      }),
    ).toMatchObject({ name: "Open licensing" });

    db.competence.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(
      await curriculum.updateCompetence(actor, "nope", { name: "X", description: null }),
    ).toBeNull();
  });

  it("recognises a name that's already taken", () => {
    expect(curriculum.isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(curriculum.isUniqueViolation(new Error("other"))).toBe(false);
    expect(curriculum.isUniqueViolation(null)).toBe(false);
  });
});

describe("sections", () => {
  const section = { code: "F", name: "Open education", description: null };

  it("creates and edits one", async () => {
    db.section.create.mockResolvedValue({ id: "sec-f" } as never);
    expect(await curriculum.createSection(actor, section)).toEqual({ ok: true, id: "sec-f" });
    expect(logged()).toMatchObject({ entityType: "section", entityId: "sec-f", action: "created" });

    db.section.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await curriculum.updateSection(actor, "sec-f", section)).toEqual({
      ok: true,
      id: "sec-f",
    });
    db.section.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await curriculum.updateSection(actor, "nope", section)).toMatchObject({ status: 404 });
  });

  it("deletes an empty section", async () => {
    db.section.findUnique.mockResolvedValue({
      _count: { modules: 0, journeySections: 0, satInstances: 0 },
    } as never);
    expect(await curriculum.removeSection(actor, "sec-f")).toBe("deleted");
    expect(db.section.delete).toHaveBeenCalledWith({ where: { id: "sec-f" } });
  });

  it.each([
    ["has modules", { modules: 1, journeySections: 0, satInstances: 0 }],
    ["is covered by a journey", { modules: 0, journeySections: 1, satInstances: 0 }],
    ["was a reassessment's scope", { modules: 0, journeySections: 0, satInstances: 1 }],
  ])("retires a section that %s, losing nothing", async (_case, counts) => {
    db.section.findUnique.mockResolvedValue({ _count: counts } as never);
    expect(await curriculum.removeSection(actor, "sec-a")).toBe("retired");
    expect(db.section.delete).not.toHaveBeenCalled();
    expect(db.section.update).toHaveBeenCalledWith({
      where: { id: "sec-a" },
      data: { retiredAt: expect.any(Date) },
    });
  });

  it("is null for an unknown section, and restores a retired one", async () => {
    db.section.findUnique.mockResolvedValue(null);
    expect(await curriculum.removeSection(actor, "nope")).toBeNull();

    db.section.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await curriculum.restoreSection(actor, "sec-a")).toBe(true);
    expect(db.section.updateMany).toHaveBeenCalledWith({
      where: { id: "sec-a" },
      data: { retiredAt: null },
    });
    db.section.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await curriculum.restoreSection(actor, "nope")).toBe(false);
  });
});

describe("modules", () => {
  const module = {
    name: "Open licences",
    description: null,
    sectionId: "sec-a",
    level: 2,
    mainCompetenceId: "c-1",
    secondaryCompetenceIds: ["c-2", "c-3"],
    moodleUrl: "https://moodle.ntnu.no/course/view.php?id=7",
  };

  /** The section and every competence the module points at exist. */
  function refsExist() {
    db.section.findUnique.mockResolvedValue({ id: "sec-a" } as never);
    db.competence.count.mockResolvedValue(3);
  }

  it("creates one with its secondary competences", async () => {
    refsExist();
    db.sectionModule.create.mockResolvedValue({ id: "mod-new" } as never);

    expect(await curriculum.createModule(actor, module)).toEqual({ ok: true, id: "mod-new" });
    expect(db.competence.count).toHaveBeenCalledWith({
      where: { id: { in: ["c-1", "c-2", "c-3"] } },
    });
    expect(db.sectionModule.create).toHaveBeenCalledWith({
      data: {
        name: "Open licences",
        description: null,
        sectionId: "sec-a",
        level: 2,
        mainCompetenceId: "c-1",
        moodleUrl: "https://moodle.ntnu.no/course/view.php?id=7",
        secondaryCompetences: { create: [{ competenceId: "c-2" }, { competenceId: "c-3" }] },
      },
      select: { id: true },
    });
  });

  it("is a 400 when the section or a competence is gone", async () => {
    db.section.findUnique.mockResolvedValue({ id: "sec-a" } as never);
    db.competence.count.mockResolvedValue(2);
    expect(await curriculum.createModule(actor, module)).toMatchObject({ ok: false, status: 400 });
    expect(db.sectionModule.create).not.toHaveBeenCalled();
  });

  it("edits one, replacing its secondary competences in one transaction", async () => {
    db.sectionModule.findUnique.mockResolvedValue({ id: "mod-1" } as never);
    refsExist();

    expect(await curriculum.updateModule(actor, "mod-1", module)).toEqual({
      ok: true,
      id: "mod-1",
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(logged()).toMatchObject({ entityType: "module", entityId: "mod-1", action: "edited" });
    expect(db.sectionModuleSecondaryCompetence.deleteMany).toHaveBeenCalledWith({
      where: { moduleId: "mod-1" },
    });
    expect(db.sectionModuleSecondaryCompetence.createMany).toHaveBeenCalledWith({
      data: [
        { moduleId: "mod-1", competenceId: "c-2" },
        { moduleId: "mod-1", competenceId: "c-3" },
      ],
    });
  });

  it("an edit is a 404 for an unknown module and a 400 for a missing section", async () => {
    db.sectionModule.findUnique.mockResolvedValueOnce(null);
    expect(await curriculum.updateModule(actor, "nope", module)).toMatchObject({ status: 404 });

    db.sectionModule.findUnique.mockResolvedValueOnce({ id: "mod-1" } as never);
    db.section.findUnique.mockResolvedValue(null);
    db.competence.count.mockResolvedValue(3);
    expect(await curriculum.updateModule(actor, "mod-1", module)).toMatchObject({ status: 400 });
  });

  it("deletes a module without questions, and retires one with questions", async () => {
    db.sectionModule.findUnique.mockResolvedValueOnce({ _count: { questions: 0 } } as never);
    expect(await curriculum.removeModule(actor, "mod-1")).toBe("deleted");
    expect(db.sectionModule.delete).toHaveBeenCalledWith({ where: { id: "mod-1" } });

    db.sectionModule.findUnique.mockResolvedValueOnce({ _count: { questions: 3 } } as never);
    expect(await curriculum.removeModule(actor, "mod-2")).toBe("retired");
    expect(db.sectionModule.update).toHaveBeenCalledWith({
      where: { id: "mod-2" },
      data: { retiredAt: expect.any(Date) },
    });

    db.sectionModule.findUnique.mockResolvedValueOnce(null);
    expect(await curriculum.removeModule(actor, "nope")).toBeNull();
  });

  it("restores a retired module", async () => {
    db.sectionModule.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await curriculum.restoreModule(actor, "mod-2")).toBe(true);
    db.sectionModule.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await curriculum.restoreModule(actor, "nope")).toBe(false);
  });
});

describe("learning journeys", () => {
  const journey = {
    name: "Data steward",
    description: null,
    moodleUrl: null,
    sections: [
      { sectionId: "sec-a", coverageLevel: "M" as const },
      { sectionId: "sec-b", coverageLevel: "S" as const },
    ],
    steps: [
      { id: "step-1", title: "Plan your data", description: null, sourceId: "src-1" },
      { id: null, title: "Share it", description: null, sourceId: null },
    ],
  };

  /** Every section and source the journey points at exists. */
  function refsExist() {
    db.section.count.mockResolvedValue(2);
    db.source.count.mockResolvedValue(1);
  }

  it("creates one with its coverage and numbered steps", async () => {
    refsExist();
    db.learningJourney.create.mockResolvedValue({ id: "lj-new" } as never);

    expect(await curriculum.createJourney(actor, journey)).toEqual({ ok: true, id: "lj-new" });
    expect(db.source.count).toHaveBeenCalledWith({ where: { id: { in: ["src-1"] } } });
    expect(db.learningJourney.create).toHaveBeenCalledWith({
      data: {
        name: "Data steward",
        description: null,
        moodleUrl: null,
        sections: { create: journey.sections },
        modules: {
          create: [
            { order: 1, title: "Plan your data", description: null, sourceId: "src-1" },
            { order: 2, title: "Share it", description: null, sourceId: null },
          ],
        },
      },
      select: { id: true },
    });
  });

  it("is a 400 when a section or source is gone", async () => {
    db.section.count.mockResolvedValue(1);
    db.source.count.mockResolvedValue(1);
    expect(await curriculum.createJourney(actor, journey)).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(db.learningJourney.create).not.toHaveBeenCalled();
  });

  it("edits one in one transaction, keeping existing steps' ids", async () => {
    db.learningJourney.findUnique.mockResolvedValue({
      modules: [{ id: "step-1" }, { id: "step-old" }],
    } as never);
    refsExist();

    expect(await curriculum.updateJourney(actor, "lj-1", journey)).toEqual({
      ok: true,
      id: "lj-1",
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(logged()).toMatchObject({ entityType: "journey", entityId: "lj-1", action: "edited" });
    expect(db.journeySection.deleteMany).toHaveBeenCalledWith({ where: { journeyId: "lj-1" } });
    expect(db.journeySection.createMany).toHaveBeenCalledWith({
      data: [
        { journeyId: "lj-1", sectionId: "sec-a", coverageLevel: "M" },
        { journeyId: "lj-1", sectionId: "sec-b", coverageLevel: "S" },
      ],
    });
    // The step left out goes; the kept one is updated in place; the new one is added.
    expect(db.learningModule.deleteMany).toHaveBeenCalledWith({
      where: { journeyId: "lj-1", id: { notIn: ["step-1"] } },
    });
    expect(db.learningModule.update).toHaveBeenCalledWith({
      where: { id: "step-1" },
      data: { order: 1, title: "Plan your data", description: null, sourceId: "src-1" },
    });
    expect(db.learningModule.create).toHaveBeenCalledWith({
      data: { journeyId: "lj-1", order: 2, title: "Share it", description: null, sourceId: null },
    });
  });

  it("treats a step id from another journey as a new step", async () => {
    db.learningJourney.findUnique.mockResolvedValue({ modules: [] } as never);
    refsExist();
    await curriculum.updateJourney(actor, "lj-1", journey);
    expect(db.learningModule.update).not.toHaveBeenCalled();
    expect(db.learningModule.create).toHaveBeenCalledTimes(2);
  });

  it("an edit is a 404 for an unknown journey and a 400 for a missing section", async () => {
    db.learningJourney.findUnique.mockResolvedValueOnce(null);
    expect(await curriculum.updateJourney(actor, "nope", journey)).toMatchObject({ status: 404 });

    db.learningJourney.findUnique.mockResolvedValueOnce({ modules: [] } as never);
    db.section.count.mockResolvedValue(0);
    db.source.count.mockResolvedValue(1);
    expect(await curriculum.updateJourney(actor, "lj-1", journey)).toMatchObject({ status: 400 });
  });

  const counts = (overrides = {}) => ({
    _count: {
      recommendations: 0,
      chosenInAdvice: 0,
      runnerUpInAdvice: 0,
      satInstances: 0,
      assessedIn: 0,
      ...overrides,
    },
  });

  it("deletes a journey nothing refers to", async () => {
    db.learningJourney.findUnique.mockResolvedValue(counts() as never);
    expect(await curriculum.removeJourney(actor, "lj-2")).toBe("deleted");
    expect(db.learningJourney.delete).toHaveBeenCalledWith({ where: { id: "lj-2" } });
    expect(logged()).toMatchObject({ entityType: "journey", action: "deleted", after: null });
  });

  it.each([
    ["recommended", { recommendations: 3 }],
    ["picked by the AI", { chosenInAdvice: 1 }],
    ["the AI's second pick", { runnerUpInAdvice: 1 }],
    ["completed", { satInstances: 1 }],
    ["assessed", { assessedIn: 2 }],
  ])("retires a journey that was %s", async (_case, used) => {
    db.learningJourney.findUnique.mockResolvedValue(counts(used) as never);
    expect(await curriculum.removeJourney(actor, "lj-1")).toBe("retired");
    expect(db.learningJourney.delete).not.toHaveBeenCalled();
    expect(db.learningJourney.update).toHaveBeenCalledWith({
      where: { id: "lj-1" },
      data: { retiredAt: expect.any(Date) },
    });
  });

  it("is null for an unknown journey, and restores a retired one", async () => {
    db.learningJourney.findUnique.mockResolvedValue(null);
    expect(await curriculum.removeJourney(actor, "nope")).toBeNull();

    db.learningJourney.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await curriculum.restoreJourney(actor, "lj-1")).toBe(true);
    db.learningJourney.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await curriculum.restoreJourney(actor, "nope")).toBe(false);
  });
});
