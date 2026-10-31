import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../db/prisma";
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
      $transaction: vi.fn(),
    },
  };
});

const db = vi.mocked(prisma, true);

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

    const result = await curriculum.getCurriculum();

    expect(result.sections).toEqual([
      {
        id: "sec-a",
        retiredAt: null,
        journeyCount: 2,
        usedInAssessments: true,
        modules: [
          { id: "mod-1", name: "Licences", secondaryCompetenceIds: ["c-2"], questionCount: 3 },
        ],
      },
    ]);
    expect(result.competences).toEqual([
      { id: "c-1", name: "Licensing", description: null, questionCount: 4, moduleCount: 1 },
    ]);
    expect(result.questions[0]).toMatchObject({ id: "q-1", answerCount: 3, editable: true });
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

    expect(await curriculum.createQuestion(input)).toEqual({ ok: true, id: "q-new" });
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
    expect(await curriculum.createQuestion(input)).toMatchObject({ ok: false, status: 400 });
    expect(db.question.create).not.toHaveBeenCalled();
  });
});

describe("updateQuestion", () => {
  it("saves an edit", async () => {
    db.question.findUnique.mockResolvedValue({
      questionType: "single_choice",
      _count: { responses: 5 },
    } as never);
    placementExists();

    expect(await curriculum.updateQuestion("q-1", input)).toEqual({ ok: true, id: "q-1" });
    expect(db.question.update).toHaveBeenCalledWith({
      where: { id: "q-1" },
      data: expect.objectContaining({ prompt: "Which licence is open?" }),
    });
  });

  it("refuses to change the type of a question learners have answered", async () => {
    db.question.findUnique.mockResolvedValue({
      questionType: "likert",
      _count: { responses: 2 },
    } as never);
    expect(await curriculum.updateQuestion("q-1", input)).toMatchObject({ ok: false, status: 409 });
    expect(db.question.update).not.toHaveBeenCalled();
  });

  it("lets an unanswered question change type", async () => {
    db.question.findUnique.mockResolvedValue({
      questionType: "likert",
      _count: { responses: 0 },
    } as never);
    placementExists();
    expect(await curriculum.updateQuestion("q-1", input)).toEqual({ ok: true, id: "q-1" });
  });

  it("is a 404 for an unknown question and a 400 for a missing module", async () => {
    db.question.findUnique.mockResolvedValueOnce(null);
    expect(await curriculum.updateQuestion("nope", input)).toMatchObject({ status: 404 });

    db.question.findUnique.mockResolvedValueOnce({
      questionType: "single_choice",
      _count: { responses: 0 },
    } as never);
    db.sectionModule.findUnique.mockResolvedValue(null);
    expect(await curriculum.updateQuestion("q-1", input)).toMatchObject({ status: 400 });
  });
});

describe("removeQuestion", () => {
  it("deletes a question nobody has answered", async () => {
    db.question.findUnique.mockResolvedValue({ _count: { responses: 0 } } as never);
    expect(await curriculum.removeQuestion("q-1")).toBe("deleted");
    expect(db.question.delete).toHaveBeenCalledWith({ where: { id: "q-1" } });
  });

  it("retires a question with answers, so past results keep it", async () => {
    db.question.findUnique.mockResolvedValue({ _count: { responses: 1 } } as never);
    expect(await curriculum.removeQuestion("q-1")).toBe("retired");
    expect(db.question.delete).not.toHaveBeenCalled();
    expect(db.question.update).toHaveBeenCalledWith({
      where: { id: "q-1" },
      data: { retiredAt: expect.any(Date) },
    });
  });

  it("is null for an unknown question", async () => {
    db.question.findUnique.mockResolvedValue(null);
    expect(await curriculum.removeQuestion("nope")).toBeNull();
  });
});

describe("restoreQuestion", () => {
  it("brings a retired question back", async () => {
    db.question.updateMany.mockResolvedValue({ count: 1 });
    expect(await curriculum.restoreQuestion("q-1")).toBe(true);
    expect(db.question.updateMany).toHaveBeenCalledWith({
      where: { id: "q-1" },
      data: { retiredAt: null },
    });

    db.question.updateMany.mockResolvedValue({ count: 0 });
    expect(await curriculum.restoreQuestion("nope")).toBe(false);
  });
});

describe("competences", () => {
  it("creates one", async () => {
    db.competence.create.mockResolvedValue({ id: "c-9", name: "Licensing" } as never);
    await curriculum.createCompetence({ name: "Licensing", description: null });
    expect(db.competence.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: "Licensing", description: null } }),
    );
  });

  it("renames one, or returns null when it doesn't exist", async () => {
    db.competence.updateMany.mockResolvedValueOnce({ count: 1 });
    db.competence.findUnique.mockResolvedValueOnce({ id: "c-1", name: "Open licensing" } as never);
    expect(
      await curriculum.updateCompetence("c-1", { name: "Open licensing", description: null }),
    ).toMatchObject({ name: "Open licensing" });

    db.competence.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await curriculum.updateCompetence("nope", { name: "X", description: null })).toBeNull();
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
    expect(await curriculum.createSection(section)).toEqual({ ok: true, id: "sec-f" });

    db.section.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await curriculum.updateSection("sec-f", section)).toEqual({ ok: true, id: "sec-f" });
    db.section.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await curriculum.updateSection("nope", section)).toMatchObject({ status: 404 });
  });

  it("deletes an empty section", async () => {
    db.section.findUnique.mockResolvedValue({
      _count: { modules: 0, journeySections: 0, satInstances: 0 },
    } as never);
    expect(await curriculum.removeSection("sec-f")).toBe("deleted");
    expect(db.section.delete).toHaveBeenCalledWith({ where: { id: "sec-f" } });
  });

  it.each([
    ["has modules", { modules: 1, journeySections: 0, satInstances: 0 }],
    ["is covered by a journey", { modules: 0, journeySections: 1, satInstances: 0 }],
    ["was a reassessment's scope", { modules: 0, journeySections: 0, satInstances: 1 }],
  ])("retires a section that %s, losing nothing", async (_case, counts) => {
    db.section.findUnique.mockResolvedValue({ _count: counts } as never);
    expect(await curriculum.removeSection("sec-a")).toBe("retired");
    expect(db.section.delete).not.toHaveBeenCalled();
    expect(db.section.update).toHaveBeenCalledWith({
      where: { id: "sec-a" },
      data: { retiredAt: expect.any(Date) },
    });
  });

  it("is null for an unknown section, and restores a retired one", async () => {
    db.section.findUnique.mockResolvedValue(null);
    expect(await curriculum.removeSection("nope")).toBeNull();

    db.section.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await curriculum.restoreSection("sec-a")).toBe(true);
    expect(db.section.updateMany).toHaveBeenCalledWith({
      where: { id: "sec-a" },
      data: { retiredAt: null },
    });
    db.section.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await curriculum.restoreSection("nope")).toBe(false);
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

    expect(await curriculum.createModule(module)).toEqual({ ok: true, id: "mod-new" });
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
    expect(await curriculum.createModule(module)).toMatchObject({ ok: false, status: 400 });
    expect(db.sectionModule.create).not.toHaveBeenCalled();
  });

  it("edits one, replacing its secondary competences in one transaction", async () => {
    db.sectionModule.findUnique.mockResolvedValue({ id: "mod-1" } as never);
    refsExist();

    expect(await curriculum.updateModule("mod-1", module)).toEqual({ ok: true, id: "mod-1" });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
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
    expect(await curriculum.updateModule("nope", module)).toMatchObject({ status: 404 });

    db.sectionModule.findUnique.mockResolvedValueOnce({ id: "mod-1" } as never);
    db.section.findUnique.mockResolvedValue(null);
    db.competence.count.mockResolvedValue(3);
    expect(await curriculum.updateModule("mod-1", module)).toMatchObject({ status: 400 });
  });

  it("deletes a module without questions, and retires one with questions", async () => {
    db.sectionModule.findUnique.mockResolvedValueOnce({ _count: { questions: 0 } } as never);
    expect(await curriculum.removeModule("mod-1")).toBe("deleted");
    expect(db.sectionModule.delete).toHaveBeenCalledWith({ where: { id: "mod-1" } });

    db.sectionModule.findUnique.mockResolvedValueOnce({ _count: { questions: 3 } } as never);
    expect(await curriculum.removeModule("mod-2")).toBe("retired");
    expect(db.sectionModule.update).toHaveBeenCalledWith({
      where: { id: "mod-2" },
      data: { retiredAt: expect.any(Date) },
    });

    db.sectionModule.findUnique.mockResolvedValueOnce(null);
    expect(await curriculum.removeModule("nope")).toBeNull();
  });

  it("restores a retired module", async () => {
    db.sectionModule.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await curriculum.restoreModule("mod-2")).toBe(true);
    db.sectionModule.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await curriculum.restoreModule("nope")).toBe(false);
  });
});
