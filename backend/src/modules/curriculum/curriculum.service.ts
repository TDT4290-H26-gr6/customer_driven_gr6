import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { buildPieContent } from "../assessment/assessment.pie";
import type { CompetenceInput, QuestionInput } from "./curriculum.validation";

// The curriculum editor (admin): changing the content learners are assessed
// on. Writes the assessment module's tables (questions, competences) on behalf
// of an admin, the one other module allowed to (context/backend-structure.md).
// Content lives in the database: db-init only loads a dataset into an empty
// one, so what's changed here stays changed.

/** Prisma's "unique constraint failed" (e.g. a competence name already taken). */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

const questionSummarySelect = {
  id: true,
  prompt: true,
  questionType: true,
  sectionModuleId: true,
  competenceId: true,
  retiredAt: true,
  authoredContent: true,
  _count: { select: { responses: true } },
} satisfies Prisma.QuestionSelect;

type QuestionRow = Prisma.QuestionGetPayload<{ select: typeof questionSummarySelect }>;

function toQuestionSummary({ _count, authoredContent, ...question }: QuestionRow) {
  return {
    ...question,
    /** How many saved answers it has, in any attempt; retiring instead of deleting starts at 1. */
    answerCount: _count.responses,
    /** Questions loaded before the editor existed have no authored form until db-init fills it in. */
    editable: authoredContent !== null,
  };
}

/**
 * Everything the editor's overview needs in one read: sections with their
 * modules (by code, then level), every competence with how many questions use
 * it, and every question, retired ones included.
 */
export async function getCurriculum() {
  const [sections, competences, questions] = await Promise.all([
    prisma.section.findMany({
      orderBy: [{ code: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        modules: {
          orderBy: [{ level: "asc" }, { name: "asc" }],
          select: { id: true, name: true, level: true, mainCompetenceId: true },
        },
      },
    }),
    prisma.competence.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { questions: true, mainForModules: true } },
      },
    }),
    prisma.question.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: questionSummarySelect,
    }),
  ]);

  return {
    sections,
    competences: competences.map(({ _count, ...competence }) => ({
      ...competence,
      questionCount: _count.questions,
      moduleCount: _count.mainForModules,
    })),
    questions: questions.map(toQuestionSummary),
  };
}

/** One question with its authored form, for the edit page. Null when it doesn't exist. */
export async function getQuestion(id: string) {
  const question = await prisma.question.findUnique({
    where: { id },
    select: questionSummarySelect,
  });
  if (!question) return null;
  return { ...toQuestionSummary(question), authoredContent: question.authoredContent };
}

/** Whether the module and competence a question points at exist. */
async function placementExists(input: QuestionInput) {
  const [module, competence] = await Promise.all([
    prisma.sectionModule.findUnique({ where: { id: input.sectionModuleId }, select: { id: true } }),
    prisma.competence.findUnique({ where: { id: input.competenceId }, select: { id: true } }),
  ]);
  return module !== null && competence !== null;
}

/** The columns a question's input sets: the authored form, and the PIE item built from it. */
function questionData(input: QuestionInput) {
  return {
    questionType: input.questionType,
    prompt: input.prompt,
    authoredContent: input.content as Prisma.InputJsonObject,
    content: buildPieContent(
      input.questionType,
      input.prompt,
      input.content,
    ) as Prisma.InputJsonObject,
    sectionModuleId: input.sectionModuleId,
    competenceId: input.competenceId,
  };
}

export type SaveResult =
  { ok: true; id: string } | { ok: false; status: 400 | 404 | 409; error: string };

export async function createQuestion(input: QuestionInput): Promise<SaveResult> {
  if (!(await placementExists(input))) {
    return { ok: false, status: 400, error: "The module or competence no longer exists" };
  }
  const question = await prisma.question.create({
    data: questionData(input),
    select: { id: true },
  });
  return { ok: true, id: question.id };
}

/**
 * Saves an edit. A question learners have answered keeps its type: their saved
 * answers are in that type's shape, so a different type means retiring it and
 * adding a new question. Answers already saved keep the score they got.
 */
export async function updateQuestion(id: string, input: QuestionInput): Promise<SaveResult> {
  const existing = await prisma.question.findUnique({
    where: { id },
    select: { questionType: true, _count: { select: { responses: true } } },
  });
  if (!existing) return { ok: false, status: 404, error: "Unknown question" };
  if (existing._count.responses > 0 && existing.questionType !== input.questionType) {
    return {
      ok: false,
      status: 409,
      error:
        "Learners have answered this question, so its type can't change. Remove it and add a new question instead.",
    };
  }
  if (!(await placementExists(input))) {
    return { ok: false, status: 400, error: "The module or competence no longer exists" };
  }
  await prisma.question.update({ where: { id }, data: questionData(input) });
  return { ok: true, id };
}

/**
 * Removes a question. One nobody has answered is deleted; one with answers is
 * retired instead, so past answers and results still have it to point at, and
 * it can be restored. Null when the question doesn't exist.
 */
export async function removeQuestion(id: string): Promise<"deleted" | "retired" | null> {
  const question = await prisma.question.findUnique({
    where: { id },
    select: { _count: { select: { responses: true } } },
  });
  if (!question) return null;
  if (question._count.responses === 0) {
    await prisma.question.delete({ where: { id } });
    return "deleted";
  }
  await prisma.question.update({ where: { id }, data: { retiredAt: new Date() } });
  return "retired";
}

/** Brings a retired question back into the assessment. False when it doesn't exist. */
export async function restoreQuestion(id: string): Promise<boolean> {
  const { count } = await prisma.question.updateMany({ where: { id }, data: { retiredAt: null } });
  return count > 0;
}

export async function createCompetence(input: CompetenceInput) {
  return prisma.competence.create({
    data: input,
    select: { id: true, name: true, description: true },
  });
}

/** Renames / re-describes a competence. Null when it doesn't exist. */
export async function updateCompetence(id: string, input: CompetenceInput) {
  const { count } = await prisma.competence.updateMany({ where: { id }, data: input });
  if (count === 0) return null;
  return prisma.competence.findUnique({
    where: { id },
    select: { id: true, name: true, description: true },
  });
}
