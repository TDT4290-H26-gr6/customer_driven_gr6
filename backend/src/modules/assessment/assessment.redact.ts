import type { Prisma } from "@prisma/client";

/**
 * Model fields that give away the answer (or could, once authored): the
 * correct sequence or blanks (`correctResponse`, `alternateResponses`) and
 * PIE's texts for after answering.
 */
const ANSWER_FIELDS = [
  "correctResponse",
  "alternateResponses",
  "rationale",
  "feedback",
  "teacherInstructions",
];

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function without(object: JsonObject, field: string): JsonObject {
  const rest = { ...object };
  delete rest[field];
  return rest;
}

function modelWithoutAnswers(model: JsonObject): JsonObject {
  const rest = ANSWER_FIELDS.reduce(without, model);
  return {
    ...rest,
    // The multiple-choice types: which choices are right.
    ...(Array.isArray(rest.choices) && {
      choices: rest.choices.map((c: unknown) => (isObject(c) ? without(c, "correct") : c)),
    }),
    // The matrix types: each row's right column.
    ...(Array.isArray(rest.rows) && {
      rows: rest.rows.map((r: unknown) => (isObject(r) ? without(r, "values") : r)),
    }),
  };
}

/**
 * A question's content as a learner gets it: everything its element needs
 * to show it and record an answer, without what says which answer is right.
 * Anything sent to the browser can be read there with the developer tools,
 * and the browser has no use for the answer: scoring reads the stored
 * content (see saveResponse), never this. Covers both shapes, a
 * <pie-fixed-player> item's `models[]` and a standalone element's `model`
 * (see assessment.pie.ts).
 */
export function withoutAnswers(content: Prisma.JsonValue): Prisma.JsonValue {
  if (!isObject(content)) return content;
  const result: JsonObject = { ...content };
  if (Array.isArray(content.models)) {
    result.models = content.models.map((m: unknown) => (isObject(m) ? modelWithoutAnswers(m) : m));
  }
  if (isObject(content.model)) result.model = modelWithoutAnswers(content.model);
  return result as Prisma.JsonValue;
}
