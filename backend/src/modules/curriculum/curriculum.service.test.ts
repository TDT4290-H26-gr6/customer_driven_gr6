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
  });
  return {
    prisma: {
      section: model(),
      sectionModule: model(),
      competence: model(),
      question: model(),
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
    db.section.findMany.mockResolvedValue([{ id: "sec-a", modules: [] }] as never);
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
