// Pure scoring rules for the question bank — no Prisma access here, so it can
// be unit-tested and reused once response persistence (POST /responses) and
// competence-score aggregation (GET /results) land. See backend-structure.md
// §2 for that rollout.

/**
 * The choice value/label appended to every question so a learner can decline
 * to guess. Picking it always scores 0/1 for the whole question (checked in
 * assessment.service.ts's scoreAnswer, before any type-specific scoring
 * runs) — no points, but the question still counts toward the maximum. It is
 * never counted as one of a question's alternatives when scoring.
 */
export const IDK_VALUE = "__idk__";
export const IDK_LABEL = "I don't know";

export type ScorableChoice = { value: string; correct: boolean };

export type ScoreResult = {
  score: number;
  /** The score a fully-correct answer would earn — used as the radar's per-area denominator. */
  maxScore: number;
};

/**
 * Every question is worth at most 1 point, so a SAT's maximum score equals
 * its number of questions.
 */
export const QUESTION_MAX_SCORE = 1;

/**
 * Scores a multiple-choice response, out of 1.
 *
 * - `choiceMode: "checkbox"` (more than one correct choice): each alternative
 *   (not counting "I don't know") is worth 1/alternatives. An alternative
 *   handled right — a correct choice selected, or an incorrect choice left
 *   unselected — earns +1/alternatives; one handled wrong — an incorrect
 *   choice selected, or a correct choice left unselected — costs
 *   -1/alternatives. Floored at 0.
 * - `choiceMode: "radio"` (exactly one correct choice): 1 if the selected
 *   choice is correct, 0 otherwise.
 */
export function scoreMultipleChoice(
  choices: ScorableChoice[],
  choiceMode: "radio" | "checkbox",
  selectedValues: string[],
): ScoreResult {
  if (choiceMode === "radio") {
    const picked = selectedValues[0];
    const isCorrect = choices.some((c) => c.value === picked && c.correct);
    return { score: isCorrect ? QUESTION_MAX_SCORE : 0, maxScore: QUESTION_MAX_SCORE };
  }

  const alternatives = choices.filter((c) => c.value !== IDK_VALUE);
  if (alternatives.length === 0) return { score: 0, maxScore: QUESTION_MAX_SCORE };
  const rawScore = alternatives.reduce((total, c) => {
    const handledRight = selectedValues.includes(c.value) === c.correct;
    return total + (handledRight ? 1 : -1);
  }, 0);

  return {
    score: (Math.max(0, rawScore) / alternatives.length) * QUESTION_MAX_SCORE,
    maxScore: QUESTION_MAX_SCORE,
  };
}

/**
 * Scores a likert (self-rated) response, out of 1. There is no right answer:
 * the score is the scale value the learner picked divided by the top of the
 * scale. Each choice's `value` is that scale number (see assessment.pie.ts).
 * The session comes from the client, so a value that isn't on the scale
 * (e.g. "1000") scores 0 rather than inflating the competence score.
 */
export function scoreLikert(choiceValues: string[], selectedValues: string[]): ScoreResult {
  const scale = choiceValues.map(Number).filter(Number.isFinite);
  const picked = Number(selectedValues[0]);
  const top = scale.length > 0 ? Math.max(...scale) : 0;
  const onScale = top > 0 && scale.includes(picked);
  return {
    score: onScale ? Math.max(0, picked / top) * QUESTION_MAX_SCORE : 0,
    maxScore: QUESTION_MAX_SCORE,
  };
}

/**
 * Scores a drag-and-drop response (seed.ts's `dragQuestion`), out of 1: each
 * blank is an "option" in the same sense as a multiple-choice choice, worth
 * 1/blanks — + for the correct term dropped in, - for an incorrect term, 0
 * for a blank left empty, floored at 0 overall. `correctResponse` maps blank
 * index (as a string key) to the correct choice id, matching the shape
 * `dragQuestion` builds in seed.ts.
 */
export function scoreDragAndDrop(
  correctResponse: Record<string, string>,
  filledBlanks: Record<string, string | undefined>,
): ScoreResult {
  const blankKeys = Object.keys(correctResponse);
  if (blankKeys.length === 0) return { score: 0, maxScore: QUESTION_MAX_SCORE };
  const rawScore = blankKeys.reduce((total, key) => {
    const filled = filledBlanks[key];
    if (filled === undefined) return total;
    return total + (filled === correctResponse[key] ? 1 : -1);
  }, 0);

  return {
    score: (Math.max(0, rawScore) / blankKeys.length) * QUESTION_MAX_SCORE,
    maxScore: QUESTION_MAX_SCORE,
  };
}

// --- Extracting selections out of the PIE widget's own session payload ---
//
// `PieQuestionPlayer` persists `<pie-fixed-player>.session` as-is (see
// frontend/src/features/assessment/components/PieQuestionPlayer.tsx). That
// top-level shape is `{ id, data: [{ id: <modelId>, ...elementSession }] }`
// — confirmed by reading the actual bundled source in
// node_modules/@pie-framework/pie-fixed-player-static/dist/pie-fixed-player.js
// (its `session` setter defaults to `{ id: "", data: [] }`, and
// `initializePieElement`/`updatePieElement` there look up each element's own
// session as `data.find(d => d.id === model.id)`). Earlier code here read
// `session.value` directly on that wrapper, which is always undefined — one
// level too shallow — so every response silently scored 0 regardless of the
// answer. `findModelSession` below does the same lookup `data.find` does.
//
// Per-element shapes below `data[i]`, from pie-elements-bundle-*.js:
// - multiple-choice: `{ id, value: string[] }` — confirmed directly
//   (`this._session.value||[]`, compared against `choices[i].value` via
//   `.includes`).
// - drag-in-the-blank: `{ id, value: Record<string, unknown> }` keyed by
//   response-area (blank) id — confirmed via its isComplete check
//   (`Object.values(session.value).filter(Boolean).length >= responseAreasToBeFilled`).
//   What each blank's value actually holds (the dropped choice's `id` vs its
//   `value`/term text) could not be pinned down from the minified bundle.
//   seed.ts's `correctResponse` compares by choice `id` (the common PIE
//   convention); if drag-and-drop scores still look wrong after this fix,
//   log a real session from the browser (PieQuestionPlayer's
//   session-changed handler) to check that assumption specifically.
//
// The session is whatever the client POSTed, so every step below checks the
// shape it reads instead of trusting it: a malformed session scores as "no
// answer" rather than throwing (and failing the save with a 500).

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findModelSession(session: unknown, modelId: string): { value?: unknown } | undefined {
  const data = isRecord(session) ? session.data : undefined;
  if (!Array.isArray(data)) return undefined;
  const entries = data.filter(isRecord);
  return entries.find((d) => d.id === modelId) ?? entries[0];
}

export function extractMultipleChoiceValues(session: unknown, modelId: string): string[] {
  const value = findModelSession(session, modelId)?.value;
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") return [value];
  return [];
}

export function extractDragAndDropBlanks(
  session: unknown,
  modelId: string,
): Record<string, string | undefined> {
  const value = findModelSession(session, modelId)?.value;
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([blank, v]) => {
      const filled = Array.isArray(v) ? v[0] : v;
      return [blank, typeof filled === "string" ? filled : undefined];
    }),
  );
}
