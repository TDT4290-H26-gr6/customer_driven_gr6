import {
  buildPieContent,
  isMatrixType,
  QUESTION_TYPES,
  TRUE_FALSE_COLUMNS,
  type AuthoredContent,
  type QuestionType,
} from "../assessment/assessment.pie";

// Checks what an admin submits in the curriculum editor before anything is
// built or saved. Pure (no Prisma), so every rule is unit-testable directly.
// The rules keep each question type answerable and scorable: e.g. a learner
// must always be able to reach full marks, so a choice question needs at
// least one correct option.

export type QuestionInput = {
  questionType: QuestionType;
  prompt: string;
  sectionModuleId: string;
  competenceId: string;
  content: AuthoredContent;
};

export type CompetenceInput = { name: string; description: string | null };

type Result<T> = { data: T } | { error: string };

export const MAX_PROMPT_LENGTH = 2000;
export const MAX_OPTION_LENGTH = 500;
export const MAX_EXHIBIT_LENGTH = 5000;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 12;
/** A matrix question's rows (statements / items to classify or match). */
export const MIN_ROWS = 2;
export const MAX_ROWS = 20;
/** A likert scale's ends, e.g. 1-5 or 0-10. */
export const LIKERT_MIN = 0;
export const LIKERT_MAX = 10;
const MAX_NAME_LENGTH = 191;
const MAX_DESCRIPTION_LENGTH = 2000;
/** Option ids end up as PIE choice values and in learners' saved answers. */
const OPTION_ID = /^[A-Za-z0-9_-]{1,40}$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * A list of options (or a matrix's answer columns or rows): `min`-`max` of
 * them, each with a unique id and non-blank, unique text. `noun` names them
 * in the messages.
 */
function validateOptions(
  value: unknown,
  { noun = "option", min = MIN_OPTIONS, max = MAX_OPTIONS } = {},
): Result<{ id: string; text: string }[]> {
  if (!Array.isArray(value) || value.length < min) {
    return { error: `Add at least ${min} ${noun}s` };
  }
  if (value.length > max) return { error: `Use at most ${max} ${noun}s` };

  const options: { id: string; text: string }[] = [];
  for (const option of value) {
    if (!isObject(option) || typeof option.id !== "string" || !OPTION_ID.test(option.id)) {
      return { error: `Every ${noun} needs a valid id` };
    }
    const optionText = text(option.text);
    if (!optionText) return { error: `Every ${noun} needs some text` };
    if (optionText.length > MAX_OPTION_LENGTH) {
      return { error: `The text of one ${noun} is too long` };
    }
    options.push({ id: option.id, text: optionText });
  }
  if (new Set(options.map((o) => o.id)).size !== options.length) {
    return { error: `Two ${noun}s have the same id` };
  }
  if (new Set(options.map((o) => o.text.toLowerCase())).size !== options.length) {
    return { error: `Two ${noun}s have the same text` };
  }
  return { data: options };
}

/**
 * A matrix question's columns and rows. Every row needs one of the columns
 * as its answer; a column no row uses is a distractor. A true/false matrix's
 * columns are always True and False.
 */
function validateMatrix(
  type: QuestionType,
  content: Record<string, unknown>,
): Result<AuthoredContent> {
  const columns =
    type === "true_false_matrix"
      ? { data: TRUE_FALSE_COLUMNS }
      : validateOptions(content.columns, { noun: "answer" });
  if ("error" in columns) return columns;
  const rows = validateOptions(content.rows, {
    noun: type === "true_false_matrix" ? "statement" : "item",
    min: MIN_ROWS,
    max: MAX_ROWS,
  });
  if ("error" in rows) return rows;

  const given = Array.isArray(content.rows) ? content.rows : [];
  const columnIds = new Set(columns.data.map((c) => c.id));
  const withAnswers = rows.data.map((row, i) => ({
    ...row,
    correctColumnId: isObject(given[i]) ? given[i].correctColumnId : undefined,
  }));
  if (
    withAnswers.some(
      (row) => typeof row.correctColumnId !== "string" || !columnIds.has(row.correctColumnId),
    )
  ) {
    return { error: "Choose the right answer for every row" };
  }
  return {
    data: {
      columns: columns.data,
      rows: withAnswers as { id: string; text: string; correctColumnId: string }[],
    },
  };
}

/** Which options are correct: ids from the list, at least `min` (and exactly `exact`, if given). */
function validateCorrect(
  value: unknown,
  options: { id: string }[],
  { min = 1, exact }: { min?: number; exact?: number },
): Result<string[]> {
  const ids = Array.isArray(value) ? value : [];
  if (!ids.every((id) => typeof id === "string" && options.some((o) => o.id === id))) {
    return { error: "A correct answer refers to an option that doesn't exist" };
  }
  const unique = [...new Set(ids as string[])];
  if (exact !== undefined && unique.length !== exact) {
    return {
      error: exact === 1 ? "Mark exactly one option as correct" : "Mark the correct options",
    };
  }
  if (unique.length < min) return { error: "Mark at least one option as correct" };
  return { data: unique };
}

/** The authored content for one question type, normalised (trimmed, only the fields that type uses). */
function validateContent(type: QuestionType, value: unknown): Result<AuthoredContent> {
  const content = isObject(value) ? value : {};

  if (type === "likert") {
    const scale = isObject(content.scale) ? content.scale : {};
    const { min, max } = scale;
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      return { error: "The scale needs a whole-number start and end" };
    }
    const [from, to] = [min as number, max as number];
    if (from < LIKERT_MIN || to > LIKERT_MAX || from >= to) {
      return { error: `The scale must run upwards, within ${LIKERT_MIN}-${LIKERT_MAX}` };
    }
    if (Array.isArray(scale.labels) && scale.labels.length > 0) {
      const labels = scale.labels.map(text);
      if (labels.length !== to - from + 1 || labels.some((l) => !l)) {
        return { error: "Give every step of the scale a label" };
      }
      if (labels.some((l) => l.length > MAX_OPTION_LENGTH)) return { error: "A label is too long" };
      return { data: { scale: { min: from, max: to, labels } } };
    }
    const minLabel = text(scale.minLabel) || undefined;
    const maxLabel = text(scale.maxLabel) || undefined;
    if (
      (minLabel?.length ?? 0) > MAX_OPTION_LENGTH ||
      (maxLabel?.length ?? 0) > MAX_OPTION_LENGTH
    ) {
      return { error: "A label is too long" };
    }
    return { data: { scale: { min: from, max: to, minLabel, maxLabel } } };
  }

  if (isMatrixType(type)) return validateMatrix(type, content);

  const options = validateOptions(content.options);
  if ("error" in options) return options;

  if (type === "ordering") {
    // The options are listed in the correct order.
    return { data: { options: options.data, correctOrder: options.data.map((o) => o.id) } };
  }

  if (type === "true_false" && options.data.length !== 2) {
    return { error: "A true/false question has exactly two options" };
  }
  const single = type === "single_choice" || type === "true_false";
  const correct = validateCorrect(content.correctOptionIds, options.data, {
    exact: single ? 1 : undefined,
  });
  if ("error" in correct) return correct;

  if (type === "criteria_check") {
    const exhibit = typeof content.exhibit === "string" ? content.exhibit.trim() : "";
    if (!exhibit) return { error: "Add the example the learner judges" };
    if (exhibit.length > MAX_EXHIBIT_LENGTH) return { error: "The example is too long" };
    return { data: { exhibit, options: options.data, correctOptionIds: correct.data } };
  }
  return { data: { options: options.data, correctOptionIds: correct.data } };
}

/**
 * A create/edit-question body, validated and normalised. Also builds the PIE
 * item once, so anything the builder would reject is a 400 here, not a broken
 * question later.
 */
export function validateQuestionInput(body: unknown): Result<QuestionInput> {
  if (!isObject(body)) return { error: "Invalid request body" };

  const questionType = body.questionType;
  if (!(QUESTION_TYPES as readonly unknown[]).includes(questionType)) {
    return { error: `questionType must be one of: ${QUESTION_TYPES.join(", ")}` };
  }
  const type = questionType as QuestionType;

  const prompt = text(body.prompt);
  if (!prompt) return { error: "Write the question" };
  if (prompt.length > MAX_PROMPT_LENGTH) return { error: "The question is too long" };

  for (const field of ["sectionModuleId", "competenceId"] as const) {
    if (typeof body[field] !== "string" || !body[field])
      return { error: `Choose a ${field === "sectionModuleId" ? "module" : "competence"}` };
  }

  const content = validateContent(type, body.content);
  if ("error" in content) return content;

  try {
    buildPieContent(type, prompt, content.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The question couldn't be built" };
  }

  return {
    data: {
      questionType: type,
      prompt,
      sectionModuleId: body.sectionModuleId as string,
      competenceId: body.competenceId as string,
      content: content.data,
    },
  };
}

/** A create/rename-competence body: a name, and an optional description. */
export function validateCompetenceInput(body: unknown): Result<CompetenceInput> {
  if (!isObject(body)) return { error: "Invalid request body" };
  const name = text(body.name);
  if (!name) return { error: "Give the competence a name" };
  if (name.length > MAX_NAME_LENGTH) return { error: "The name is too long" };
  const description = text(body.description) || null;
  if ((description?.length ?? 0) > MAX_DESCRIPTION_LENGTH) {
    return { error: "The description is too long" };
  }
  return { data: { name, description } };
}

export type SectionInput = { code: string | null; name: string; description: string | null };

export type ModuleInput = {
  name: string;
  description: string | null;
  sectionId: string;
  /** The step within its section the adaptive assessment asks it at (1 first); null = after the numbered ones. */
  level: number | null;
  mainCompetenceId: string;
  secondaryCompetenceIds: string[];
  moodleUrl: string | null;
};

const MAX_CODE_LENGTH = 10;
export const MAX_LEVEL = 20;
const MAX_SECONDARY = 20;
const MAX_URL_LENGTH = 512;

/** A link learners are sent to: https, or http only for a local test server. */
function validLink(value: string): boolean {
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return url.protocol === "https:" || (url.protocol === "http:" && local);
  } catch {
    return false;
  }
}

/** A create/edit-section body: a name, and an optional short code ("A") and description. */
export function validateSectionInput(body: unknown): Result<SectionInput> {
  if (!isObject(body)) return { error: "Invalid request body" };
  const name = text(body.name);
  if (!name) return { error: "Give the section a name" };
  if (name.length > MAX_NAME_LENGTH) return { error: "The name is too long" };
  const code = text(body.code) || null;
  if ((code?.length ?? 0) > MAX_CODE_LENGTH) {
    return { error: `The code can be at most ${MAX_CODE_LENGTH} characters` };
  }
  const description = text(body.description) || null;
  if ((description?.length ?? 0) > MAX_DESCRIPTION_LENGTH) {
    return { error: "The description is too long" };
  }
  return { data: { code, name, description } };
}

/** A create/edit-module body. */
export function validateModuleInput(body: unknown): Result<ModuleInput> {
  if (!isObject(body)) return { error: "Invalid request body" };
  const name = text(body.name);
  if (!name) return { error: "Give the module a name" };
  if (name.length > MAX_NAME_LENGTH) return { error: "The name is too long" };
  const description = text(body.description) || null;
  if ((description?.length ?? 0) > MAX_EXHIBIT_LENGTH) {
    return { error: "The description is too long" };
  }
  if (typeof body.sectionId !== "string" || !body.sectionId) return { error: "Choose a section" };
  if (typeof body.mainCompetenceId !== "string" || !body.mainCompetenceId) {
    return { error: "Choose the module's main competence" };
  }

  const level = body.level ?? null;
  if (
    level !== null &&
    (!Number.isInteger(level) || (level as number) < 1 || (level as number) > MAX_LEVEL)
  ) {
    return { error: `The level must be a whole number from 1 to ${MAX_LEVEL}` };
  }

  const secondary = body.secondaryCompetenceIds ?? [];
  if (!Array.isArray(secondary) || !secondary.every((id) => typeof id === "string" && id)) {
    return { error: "Invalid secondary competences" };
  }
  const secondaryCompetenceIds = [...new Set(secondary as string[])].filter(
    (id) => id !== body.mainCompetenceId,
  );
  if (secondaryCompetenceIds.length > MAX_SECONDARY) {
    return { error: `Choose at most ${MAX_SECONDARY} secondary competences` };
  }

  const moodleUrl = text(body.moodleUrl) || null;
  if (moodleUrl && (moodleUrl.length > MAX_URL_LENGTH || !validLink(moodleUrl))) {
    return { error: "The Moodle link must be a full https:// address" };
  }

  return {
    data: {
      name,
      description,
      sectionId: body.sectionId,
      level: level as number | null,
      mainCompetenceId: body.mainCompetenceId,
      secondaryCompetenceIds,
      moodleUrl,
    },
  };
}

export type CoverageLevel = "M" | "R" | "S";

export type JourneyInput = {
  name: string;
  description: string | null;
  moodleUrl: string | null;
  /** Each section it covers, and how strongly: M (centred on it), R (covers it well), S (touches it). */
  sections: { sectionId: string; coverageLevel: CoverageLevel }[];
  /** Its steps in order. A step with an id is an existing one, kept and updated. */
  steps: {
    id: string | null;
    title: string;
    description: string | null;
    sourceId: string | null;
  }[];
};

const COVERAGE_LEVELS: readonly string[] = ["M", "R", "S"];
const MAX_JOURNEY_SECTIONS = 50;
export const MAX_STEPS = 30;

/** A create/edit-journey body: its details, section coverage and steps. */
export function validateJourneyInput(body: unknown): Result<JourneyInput> {
  if (!isObject(body)) return { error: "Invalid request body" };
  const name = text(body.name);
  if (!name) return { error: "Give the journey a name" };
  if (name.length > MAX_NAME_LENGTH) return { error: "The name is too long" };
  const description = text(body.description) || null;
  if ((description?.length ?? 0) > MAX_EXHIBIT_LENGTH) {
    return { error: "The description is too long" };
  }
  const moodleUrl = text(body.moodleUrl) || null;
  if (moodleUrl && (moodleUrl.length > MAX_URL_LENGTH || !validLink(moodleUrl))) {
    return { error: "The Moodle link must be a full https:// address" };
  }

  if (!Array.isArray(body.sections) || body.sections.length > MAX_JOURNEY_SECTIONS) {
    return { error: "Invalid sections" };
  }
  const sections: JourneyInput["sections"] = [];
  for (const entry of body.sections) {
    if (
      !isObject(entry) ||
      typeof entry.sectionId !== "string" ||
      !entry.sectionId ||
      !COVERAGE_LEVELS.includes(entry.coverageLevel as string)
    ) {
      return { error: "Each section needs a coverage of M, R or S" };
    }
    sections.push({
      sectionId: entry.sectionId,
      coverageLevel: entry.coverageLevel as CoverageLevel,
    });
  }
  if (new Set(sections.map((s) => s.sectionId)).size !== sections.length) {
    return { error: "A section is listed twice" };
  }
  // Journey assessments ask about the M sections, and recommendations rank on coverage.
  if (!sections.some((s) => s.coverageLevel === "M")) {
    return {
      error: "Mark at least one section as M (main): it's what assessing the journey asks about",
    };
  }

  const rawSteps = body.steps ?? [];
  if (!Array.isArray(rawSteps)) return { error: "Invalid steps" };
  if (rawSteps.length > MAX_STEPS) return { error: `Use at most ${MAX_STEPS} steps` };
  const steps: JourneyInput["steps"] = [];
  for (const step of rawSteps) {
    if (!isObject(step)) return { error: "Invalid steps" };
    const title = text(step.title);
    if (!title) return { error: "Every step needs a title" };
    if (title.length > MAX_NAME_LENGTH) return { error: "A step's title is too long" };
    const stepDescription = text(step.description) || null;
    if ((stepDescription?.length ?? 0) > MAX_EXHIBIT_LENGTH) {
      return { error: "A step's description is too long" };
    }
    steps.push({
      id: typeof step.id === "string" && step.id ? step.id : null,
      title,
      description: stepDescription,
      sourceId: typeof step.sourceId === "string" && step.sourceId ? step.sourceId : null,
    });
  }

  return { data: { name, description, moodleUrl, sections, steps } };
}
