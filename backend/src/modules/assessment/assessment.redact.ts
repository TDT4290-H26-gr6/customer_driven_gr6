import type { Prisma } from "@prisma/client";

type JsonObject = Record<string, unknown>;

/** The fields of a model, and of each of its choices or rows, that its element needs. */
type Allowed = { model: string[]; choices?: string[]; rows?: string[] };

/**
 * What each element is sent, by the model's `element`. Only what it needs to
 * show the question and record an answer: anything else, an answer key
 * (`correct`, `correctResponse`, a row's `values`), feedback, a rationale,
 * scoring settings, or a field added later, stays on the server. A new
 * element, or a new field one needs, has to be added here, until then it's
 * left out (an element missing here gets nothing but its id).
 */
const ALLOWED: Record<string, Allowed> = {
  // <pie-fixed-player>'s multiple choice: single/multi choice, true/false,
  // self-rating and judge-an-example.
  "multiple-choice": {
    model: ["id", "element", "prompt", "choiceMode", "choices"],
    choices: ["label", "value"],
  },
  "aios-placement-ordering": {
    model: ["id", "element", "prompt", "choices", "orientation"],
    choices: ["id", "label"],
  },
  "aios-match": {
    model: [
      "id",
      "element",
      "prompt",
      "choiceMode",
      "headers",
      "layout",
      "rows",
      "lockChoiceOrder",
    ],
    rows: ["id", "title"],
  },
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(object: JsonObject, fields: string[]): JsonObject {
  return Object.fromEntries(fields.filter((f) => f in object).map((f) => [f, object[f]]));
}

function pickEach(list: unknown, fields: string[] | undefined): unknown[] | undefined {
  if (!Array.isArray(list) || !fields) return undefined;
  return list.map((item) => (isObject(item) ? pick(item, fields) : {}));
}

function modelForLearner(model: JsonObject, element: unknown): JsonObject {
  const allowed = ALLOWED[String(element)] ?? { model: ["id", "element"] };
  const result = pick(model, allowed.model);
  const choices = pickEach(result.choices, allowed.choices);
  const rows = pickEach(result.rows, allowed.rows);
  return { ...result, ...(choices && { choices }), ...(rows && { rows }) };
}

/**
 * A question's content as a learner gets it: what its element needs to show
 * it and record an answer (see ALLOWED), without what says which answer is
 * right. Anything sent to the browser can be read there with the developer
 * tools, and the browser has no use for the answer: scoring reads the stored
 * content (see saveResponse), never this. Covers both shapes, a
 * <pie-fixed-player> item (`elements`, `models[]`, `markup`) and a
 * standalone element's (`element`, `model`), see assessment.pie.ts.
 */
export function withoutAnswers(content: Prisma.JsonValue): Prisma.JsonValue {
  if (!isObject(content)) return content;
  if (Array.isArray(content.models)) {
    return {
      ...pick(content, ["elements", "markup"]),
      models: content.models.map((m: unknown) =>
        isObject(m) ? modelForLearner(m, m.element) : {},
      ),
    } as Prisma.JsonValue;
  }
  if (isObject(content.model)) {
    return {
      ...pick(content, ["element"]),
      // The element the frontend mounts is the content's own.
      model: modelForLearner(content.model, content.element),
    } as Prisma.JsonValue;
  }
  return {};
}
