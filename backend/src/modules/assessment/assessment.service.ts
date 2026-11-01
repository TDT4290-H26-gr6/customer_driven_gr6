import { Prisma, type Question } from "@prisma/client";
import { config } from "../../config";
import { prisma } from "../../db/prisma";
import { findLearnerById, getRoleGrants } from "../identity/identity.service";
import { buildSectionProgress } from "./assessment.progress";
import { JOURNEY_KIND, MAIN_KIND, type AssessmentKind } from "./assessment.kinds";
import { bestPerModule, sectionPercent } from "./assessment.competencies";
import { recommendJourney, suggestJourney } from "../learningJourney/learningJourney.service";
import { completedCompetenceScoresQuery, newestPerCompetence } from "./assessment.newestScores";
import { isMatrixType } from "./assessment.pie";
import { withoutAnswers } from "./assessment.redact";
import {
  buildPath,
  seededRandom,
  shuffle,
  skillLevel,
  type PathAnswer,
  type PathModule,
  type PathSection,
} from "./assessment.path";
import {
  extractDragAndDropBlanks,
  extractMultipleChoiceValues,
  extractMatrixAnswers,
  extractOrderingValues,
  IDK_VALUE,
  QUESTION_MAX_SCORE,
  scoreDragAndDrop,
  scoreLikert,
  scoreMultipleChoice,
  scoreMatrix,
  scoreOrdering,
  type ScoreResult,
} from "./assessment.scoring";

// All Prisma access for assessment_* tables lives here.

/**
 * Question types whose on-screen choice order is meaningful and must never
 * be shuffled. ("ordering" is shuffled its own way, see
 * withShuffledOrderingItems.)
 */
const ORDERED_QUESTION_TYPES: readonly string[] = ["likert", "true_false"];

/**
 * Randomizes the on-screen order of a question's answer choices (Fisher–
 * Yates) so "it's always the 2nd option" never becomes a shortcut. Each
 * choice keeps its own value/id and correct flag, so this has no effect on
 * scoring (assessment.scoring.ts looks choices up by value/id, never by
 * position), but ordered scales (likert) and true/false are left alone,
 * since their order is the point, not noise to shuffle. The "I don't know"
 * choice every question carries (IDK_VALUE) is never shuffled in among the
 * others either, it's held back and always placed last. `random` lets the
 * assessment path keep a question's order stable across fetches.
 */
function withShuffledChoices<T extends Pick<Question, "questionType" | "content">>(
  question: T,
  random: () => number = Math.random,
): T {
  if (ORDERED_QUESTION_TYPES.includes(question.questionType)) return question;
  if (question.questionType === "ordering") return withShuffledOrderingItems(question, random);

  const content = question.content as { models?: { choices?: { value?: unknown }[] }[] } | null;
  const models = content?.models;
  const firstModel = models?.[0];
  if (!content || !models || !firstModel?.choices) return question;

  const idk = firstModel.choices.filter((c) => c.value === IDK_VALUE);
  const rest = firstModel.choices.filter((c) => c.value !== IDK_VALUE);
  const shuffledModels = [
    { ...firstModel, choices: [...shuffle(rest, random), ...idk] },
    ...models.slice(1),
  ];
  return { ...question, content: { ...content, models: shuffledModels } as Prisma.JsonValue };
}

/**
 * An ordering question's items, in a random starting order that is never
 * the correct one. The element takes the order on screen as the learner's
 * answer from the start, and items are authored in their correct sequence,
 * so unshuffled they would score full marks without being touched.
 */
function withShuffledOrderingItems<T extends Pick<Question, "content">>(
  question: T,
  random: () => number,
): T {
  const content = question.content as {
    model?: { choices?: { id?: unknown }[]; correctResponse?: unknown };
  } | null;
  const model = content?.model;
  if (!content || !model || !Array.isArray(model.choices) || model.choices.length < 2) {
    return question;
  }
  let choices = shuffle(model.choices, random);
  // Moving the first item to the end can't land on the correct order again.
  if (JSON.stringify(choices.map((c) => c.id)) === JSON.stringify(model.correctResponse)) {
    choices = [...choices.slice(1), choices[0]];
  }
  return { ...question, content: { ...content, model: { ...model, choices } } as Prisma.JsonValue };
}

/**
 * A question as a learner gets it: choices shuffled (withShuffledChoices),
 * and without its answers (withoutAnswers), which are scored from the
 * stored copy.
 */
function forLearner<T extends Pick<Question, "questionType" | "content">>(
  question: T,
  random?: () => number,
): T {
  const shuffled = withShuffledChoices(question, random);
  return { ...shuffled, content: withoutAnswers(shuffled.content) };
}

/**
 * Whether this learner has never finished a main SAT instance, their
 * initial assessment is still ahead of them. Journey assessments don't count.
 */
async function isInitialAssessment(learnerId: string): Promise<boolean> {
  return !(await hasCompletedMainAssessment(learnerId));
}

/** Whether the learner has finished at least one main self-assessment. */
export async function hasCompletedMainAssessment(learnerId: string): Promise<boolean> {
  const completedCount = await prisma.satInstance.count({
    where: { learnerId, kind: MAIN_KIND, completedAt: { not: null } },
  });
  return completedCount > 0;
}

/**
 * Which questions this learner may currently see. Everyone gets the whole
 * bank for their initial assessment (every section, every competence) ,
 * that's the point of it, regardless of role. Once they've completed at
 * least one instance, later runs go back to the normal role allow-lists:
 * those whose competence has been granted to the role, OR whose module sits
 * in a section granted to the role (identity_role_competence /
 * identity_role_section). A role with no grants then sees nothing. Returns
 * null for a learner with no role at all, they can't take anything yet.
 *
 * While role selection is turned off (config.roleSelectionEnabled), roles
 * are ignored: every learner gets the whole bank in every SAT. Retired
 * questions are left out either way.
 */
async function roleQuestionFilter(learnerId: string): Promise<Prisma.QuestionWhereInput | null> {
  const learner = await findLearnerById(learnerId);
  if (!learner) return null;
  // Retired content (removed in the curriculum editor after being used) is
  // never asked again, whatever the role: the question itself, or the module
  // or section it's in.
  const inUse = {
    retiredAt: null,
    sectionModule: { retiredAt: null, section: { retiredAt: null } },
  } satisfies Prisma.QuestionWhereInput;
  if (!config.roleSelectionEnabled) return inUse;
  if (!learner.roleId) return null;

  if (await isInitialAssessment(learnerId)) return inUse;

  const { sectionIds, competenceIds } = await getRoleGrants(learner.roleId);
  return {
    ...inUse,
    OR: [
      { competenceId: { in: competenceIds } },
      { sectionModule: { sectionId: { in: sectionIds } } },
    ],
  };
}

/**
 * roleQuestionFilter, narrowed to the sections the learner's in-progress
 * reassessment is limited to (see startReassessment), when it's limited at
 * all. Used both to list questions and to check a saved answer belongs.
 */
async function visibleQuestionFilter(learnerId: string): Promise<Prisma.QuestionWhereInput | null> {
  const roleFilter = await roleQuestionFilter(learnerId);
  if (!roleFilter) return null;

  const scope = await prisma.satInstanceSection.findMany({
    where: { satInstance: { learnerId, completedAt: null } },
    select: { sectionId: true },
  });
  if (scope.length === 0) return roleFilter;

  return {
    AND: [roleFilter, { sectionModule: { sectionId: { in: scope.map((s) => s.sectionId) } } }],
  };
}

/**
 * The sections a reassessment can be limited to: every section with at
 * least one question the learner's role can see, ignoring any current
 * limit. Sorted by name.
 */
export async function listAssessableSections(learnerId: string) {
  const roleFilter = await roleQuestionFilter(learnerId);
  if (!roleFilter) return [];

  return prisma.section.findMany({
    where: { retiredAt: null, modules: { some: { questions: { some: roleFilter } } } },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });
}

/** The questions the learner's role can see, in a stable section → module → question order. */
export async function listQuestions(learnerId: string) {
  const where = await visibleQuestionFilter(learnerId);
  if (!where) return [];

  const questions = await prisma.question.findMany({
    where,
    include: { competence: { select: { id: true, name: true } } },
    orderBy: [
      { sectionModule: { section: { name: "asc" } } },
      { sectionModule: { name: "asc" } },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  return questions.map((q) =>
    forLearner({
      id: q.id,
      prompt: q.prompt,
      questionType: q.questionType,
      content: q.content,
      competence: q.competence,
    }),
  );
}

/**
 * Shape of the PIE `content` this module stores, narrowed just enough to
 * score it. See assessment.scoring.ts for the caveat on the actual session
 * (`answer`) shapes assumed here.
 */
type PieModel = {
  id?: string;
  choiceMode?: "radio" | "checkbox";
  choices?: { value?: string; correct?: boolean }[];
  correctResponse?: Record<string, string>;
};

/**
 * Scores one answer against its question. `answer` is the frontend's
 * PieAnswer wrapper (`{ session, complete }`, see PieQuestionPlayer), not
 * the raw PIE session itself; the session lives at `answer.session`.
 */
function scoreAnswer(
  question: Pick<Question, "questionType" | "content">,
  answer: unknown,
): ScoreResult | null {
  const session = (answer as { session?: unknown } | null)?.session;

  // Standalone custom element, not <pie-fixed-player>, its content is
  // { element, model } (see database/src/seed/pie.ts's NativeElementContent),
  // not the { elements, models, markup } PIE item config the rest of this
  // function assumes below.
  if (question.questionType === "ordering") {
    const native = question.content as { model?: { correctResponse?: unknown } } | null;
    const correctResponse = native?.model?.correctResponse;
    if (!Array.isArray(correctResponse)) return null;
    const correctOrder = correctResponse.filter((v): v is string => typeof v === "string");
    return scoreOrdering(correctOrder, extractOrderingValues(session));
  }

  if (isMatrixType(question.questionType)) {
    const native = question.content as { model?: { rows?: unknown } } | null;
    const rows = native?.model?.rows;
    if (!Array.isArray(rows)) return null;
    // Each row's `values` marks its correct column (see assessment.pie.ts).
    const scorable = rows.flatMap((row: { id?: unknown; values?: unknown }) =>
      typeof row?.id === "string" && Array.isArray(row.values)
        ? [{ id: row.id, correctColumn: row.values.indexOf(true) }]
        : [],
    );
    return scoreMatrix(scorable, extractMatrixAnswers(session));
  }

  const model = (question.content as { models?: PieModel[] } | null)?.models?.[0];
  if (!model) return null;
  const modelId = model.id ?? "1"; // every question this module stores has exactly one model, id "1"

  if (question.questionType === "drag_and_drop" && model.correctResponse) {
    return scoreDragAndDrop(model.correctResponse, extractDragAndDropBlanks(session, modelId));
  }

  if (!model.choices) return null;

  const selected = extractMultipleChoiceValues(session, modelId);

  // "I don't know" always scores 0 out of the full question, even on a
  // multi_choice where other boxes were also ticked, rather than scoring it
  // as a wrong guess (which could cost points on other alternatives).
  if (selected.includes(IDK_VALUE)) return { score: 0, maxScore: QUESTION_MAX_SCORE };

  if (question.questionType === "likert") {
    const values = model.choices.map((c) => String(c.value));
    return scoreLikert(values, selected);
  }

  if (model.choiceMode) {
    const choices = model.choices.map((c) => ({
      value: String(c.value),
      correct: Boolean(c.correct),
    }));
    return scoreMultipleChoice(choices, model.choiceMode, selected);
  }

  return null;
}

/** The learner's current unfinished SAT instance, if any, not created here. */
function findActiveInstance(learnerId: string) {
  return prisma.satInstance.findFirst({
    where: { learnerId, completedAt: null },
    orderBy: { startedAt: "desc" },
  });
}

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Creates the learner's next instance of its kind (instanceNum = their
 * highest of that kind + 1, so main assessments stay numbered 1, 2, 3 …
 * whatever journey assessments happen in between). `extra` carries a
 * reassessment's journey and section limit, or a journey assessment's kind,
 * journey and sections.
 */
async function createInstance(
  learnerId: string,
  extra: Omit<Prisma.SatInstanceUncheckedCreateInput, "learnerId" | "instanceNum"> = {},
) {
  const kind = (extra.kind as AssessmentKind | undefined) ?? MAIN_KIND;
  const latest = await prisma.satInstance.findFirst({
    where: { learnerId, kind },
    orderBy: { instanceNum: "desc" },
    select: { instanceNum: true },
  });
  return prisma.satInstance.create({
    data: { learnerId, instanceNum: (latest?.instanceNum ?? 0) + 1, ...extra },
  });
}

async function getOrCreateActiveInstance(learnerId: string) {
  const active = await findActiveInstance(learnerId);
  if (active) return active;

  try {
    return await createInstance(learnerId);
  } catch (err) {
    // Two first answers arrived at once and the other request created the
    // instance first (unique on learnerId + instanceNum), use theirs.
    if (isUniqueViolation(err)) {
      const created = await findActiveInstance(learnerId);
      if (created) return created;
    }
    throw err;
  }
}

export type StartReassessmentResult =
  { ok: true } | { ok: false; status: 400 | 409; error: string };

/**
 * Starts a reassessment of only some sections: a new instance limited to
 * the chosen sections, so listQuestions only returns those. (A reassessment
 * of everything needs no start, the first saved answer creates a normal
 * instance.) Refused while another instance is in progress, before the first
 * assessment is done (that one covers everything), and for sections with no
 * question the learner's role can see.
 */
export async function startReassessment(
  learnerId: string,
  sectionIds: string[],
): Promise<StartReassessmentResult> {
  if (await findActiveInstance(learnerId)) {
    return { ok: false, status: 409, error: "An assessment is already in progress" };
  }
  if (await isInitialAssessment(learnerId)) {
    return { ok: false, status: 409, error: "Finish your first assessment before reassessing" };
  }

  const assessable = new Map(
    (await listAssessableSections(learnerId)).map((s) => [s.id, s.name] as const),
  );
  const unique = [...new Set(sectionIds)];
  if (unique.length === 0 || unique.some((id) => !assessable.has(id))) {
    return { ok: false, status: 400, error: "Choose one or more sections you can be assessed in" };
  }

  try {
    await createInstance(learnerId, {
      // A copy for History, which must outlive the sections.
      reassessedSectionNames: unique
        .map((id) => assessable.get(id)!)
        .sort((a, b) => a.localeCompare(b)),
      sections: { create: unique.map((sectionId) => ({ sectionId })) },
    });
  } catch (err) {
    // Another request started an instance at the same moment.
    if (isUniqueViolation(err)) {
      return { ok: false, status: 409, error: "An assessment is already in progress" };
    }
    throw err;
  }
  return { ok: true };
}

/** The number the learner's next main instance will get (their highest + 1). */
async function nextMainInstanceNum(learnerId: string) {
  const latest = await prisma.satInstance.findFirst({
    where: { learnerId, kind: MAIN_KIND },
    orderBy: { instanceNum: "desc" },
    select: { instanceNum: true },
  });
  return (latest?.instanceNum ?? 0) + 1;
}

/** Everything buildPath needs for the learner's current (or upcoming) attempt. */
async function loadPathInputs(learnerId: string) {
  const where = await visibleQuestionFilter(learnerId);
  if (!where) return null;

  const [questions, active] = await Promise.all([
    prisma.question.findMany({
      where,
      include: {
        competence: { select: { id: true, name: true } },
        sectionModule: {
          select: {
            id: true,
            level: true,
            section: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    findActiveInstance(learnerId),
  ]);

  // Before the first answer there's no instance yet; its number will be the
  // next one, so the order chosen now is the order it keeps once created.
  const instanceNum = active?.instanceNum ?? (await nextMainInstanceNum(learnerId));

  const sectionsById = new Map<string, PathSection>();
  for (const q of questions) {
    const { id: moduleId, level, section } = q.sectionModule;
    const entry = sectionsById.get(section.id) ?? { id: section.id, modules: [] };
    let module = entry.modules.find((m) => m.id === moduleId);
    if (!module) {
      module = { id: moduleId, level, questionIds: [] };
      entry.modules.push(module);
    }
    module.questionIds.push(q.id);
    sectionsById.set(section.id, entry);
  }
  // A random section order per attempt, stable for that attempt.
  const sections = shuffle(
    [...sectionsById.values()].sort((a, b) => a.id.localeCompare(b.id)),
    seededRandom(`${learnerId}:${instanceNum}`),
  );

  const responses = active
    ? await prisma.response.findMany({
        where: { satInstanceId: active.id },
        select: {
          id: true,
          questionId: true,
          score: true,
          maxScore: true,
          answer: true,
          answeredAt: true,
        },
      })
    : [];
  const answers = new Map<string, PathAnswer & { answer: Prisma.JsonValue }>();
  for (const r of responses) if (r.questionId) answers.set(r.questionId, r);

  return {
    questions: new Map(questions.map((q) => [q.id, q])),
    sections,
    active,
    instanceNum,
    responses,
    answers,
  };
}

/**
 * The learner's route through their current (or upcoming) attempt, from
 * their answers so far (see assessment.path.ts): every question they've
 * answered, in the order first answered, with their answer, then the next
 * one to ask, or
 * `done` when nothing is left. Each item says which section (and section
 * number, in this attempt's random order) and level it belongs to. Choice
 * order is shuffled per attempt but stable, so Back and resuming show the
 * same order. Returns null for a learner without a role.
 */
export async function getAssessmentPath(learnerId: string) {
  const inputs = await loadPathInputs(learnerId);
  if (!inputs) return null;
  const { questions, sections, instanceNum, answers, active } = inputs;

  const { answered, next } = buildPath(sections, answers, isPartialReassessment(active));
  const sectionNumberOf = new Map(sections.map((s, i) => [s.id, i + 1]));

  const items = [...answered, ...(next ? [next] : [])].map((id) => {
    const q = questions.get(id)!;
    const { section, level } = q.sectionModule;
    return {
      question: forLearner(
        {
          id: q.id,
          prompt: q.prompt,
          questionType: q.questionType,
          content: q.content,
          competence: q.competence,
        },
        seededRandom(`${learnerId}:${instanceNum}:${q.id}`),
      ),
      answer: answers.get(id)?.answer ?? null,
      section: { code: section.code, name: section.name },
      sectionNumber: sectionNumberOf.get(section.id)!,
      level,
    };
  });

  return {
    items,
    sectionCount: sections.length,
    done: next === null,
    // Set while the learner is assessing one learning journey on its own.
    journey: journeyBeingAssessed(active),
    // A reassessment of chosen sections only (not the full self-assessment,
    // and not a journey assessment either), see isPartialReassessment.
    partial: isPartialReassessment(active),
  };
}

/** The journey a journey assessment covers, or null for the main self-assessment. */
function journeyBeingAssessed(
  instance: {
    kind: string;
    assessedJourneyId: string | null;
    assessedJourneyName: string | null;
  } | null,
) {
  if (instance?.kind !== JOURNEY_KIND) return null;
  return { id: instance.assessedJourneyId, name: instance.assessedJourneyName };
}

/**
 * Whether the instance is a reassessment limited to chosen sections
 * (startReassessment), rather than the full self-assessment or a journey
 * assessment. Drives buildPath's `exhaustive` mode (every question of the
 * chosen sections is asked, see assessment.path.ts) and the frontend's
 * Back button (kept for a partial reassessment, hidden for a full one).
 */
function isPartialReassessment(instance: { reassessedSectionNames: unknown } | null): boolean {
  return isStringArray(instance?.reassessedSectionNames);
}

/**
 * Save/resume (CD-7 / SAT2): the learner's in-progress instance plus every
 * answer saved so far, so the frontend can restore exactly where they left
 * off. Returns null if they haven't started (or have only completed
 * instances), a fresh start, not an error.
 */
export async function getProgress(learnerId: string) {
  const active = await findActiveInstance(learnerId);
  if (!active) return null;

  const responses = await prisma.response.findMany({
    where: { satInstanceId: active.id },
  });

  return {
    satInstanceId: active.id,
    journey: journeyBeingAssessed(active),
    // An answer whose question was deleted has nothing to restore into.
    responses: responses.flatMap((r) =>
      r.questionId ? [{ questionId: r.questionId, answer: r.answer }] : [],
    ),
  };
}

/**
 * Upserts one answer against the learner's active instance, creating the
 * instance on the first call, and scores it against the question. An atomic
 * upsert on (satInstanceId, questionId), so two saves arriving together
 * can't collide on the unique constraint.
 *
 * Returns null, and saves nothing, when the question doesn't exist or
 * isn't one the learner's role may see: a learner can only answer the
 * questions listQuestions would have given them. Checked before the
 * instance is created, so a bad id never leaves an empty instance behind.
 */
export async function saveResponse(
  learnerId: string,
  questionId: string,
  answer: Prisma.InputJsonValue,
  timeSpentMs?: number,
) {
  const visible = await visibleQuestionFilter(learnerId);
  if (!visible) return null;

  const question = await prisma.question.findFirst({
    where: { AND: [{ id: questionId }, visible] },
  });
  if (!question) return null;

  const instance = await getOrCreateActiveInstance(learnerId);
  const result = scoreAnswer(question, answer);
  const data = {
    answer,
    score: result?.score ?? null,
    maxScore: result?.maxScore ?? null,
    timeSpentMs: timeSpentMs ?? null,
  };

  return prisma.response.upsert({
    where: { satInstanceId_questionId: { satInstanceId: instance.id, questionId } },
    update: data,
    create: { satInstanceId: instance.id, questionId, ...data },
  });
}

/**
 * Records that the question was shown to the learner in their current attempt
 * (CD-125), for the admin drop-off page. Only the first view per question and
 * attempt is stored. The attempt is the active instance, or, before the first
 * answer creates one, the upcoming main instance, so a learner who opens the
 * first question and leaves is still seen. Nothing is created besides the view.
 *
 * Returns false, and records nothing, when the question doesn't exist or the
 * learner's role may not see it (same rule as saveResponse).
 */
export async function recordQuestionView(learnerId: string, questionId: string) {
  const visible = await visibleQuestionFilter(learnerId);
  if (!visible) return false;

  const question = await prisma.question.findFirst({
    where: { AND: [{ id: questionId }, visible] },
    select: { id: true },
  });
  if (!question) return false;

  const active = await findActiveInstance(learnerId);
  const kind = active?.kind ?? MAIN_KIND;
  const instanceNum = active?.instanceNum ?? (await nextMainInstanceNum(learnerId));

  await prisma.questionView.createMany({
    data: [{ learnerId, kind, instanceNum, questionId }],
    skipDuplicates: true,
  });
  return true;
}

export type CompleteResult = "completed" | "none" | "unfinished";

export type StartJourneyAssessmentResult =
  { ok: true; sectionIds: string[] } | { ok: false; status: 400 | 404 | 409; error: string };

/**
 * Starts a journey assessment: the learner assesses one learning journey on
 * its own, with only the questions in the sections the journey is centred
 * on (coverage M). A separate kind of instance (JOURNEY_KIND), numbered on
 * its own, that never counts towards the main results, only the
 * Competencies overview reads it. Allowed any time, even before the first
 * main assessment, but like every assessment only one at a time.
 */
export async function startJourneyAssessment(
  learnerId: string,
  journeyId: string,
): Promise<StartJourneyAssessmentResult> {
  if (await findActiveInstance(learnerId)) {
    return {
      ok: false,
      status: 409,
      error: "Finish or abort the assessment you've started before assessing a journey",
    };
  }

  // A retired journey can't be started (it isn't listed any more either).
  const journey = await prisma.learningJourney.findFirst({
    where: { id: journeyId, retiredAt: null },
    select: {
      name: true,
      sections: { where: { coverageLevel: "M" }, select: { sectionId: true } },
    },
  });
  if (!journey) return { ok: false, status: 404, error: "Unknown learning journey" };

  const assessable = new Set((await listAssessableSections(learnerId)).map((s) => s.id));
  const sectionIds = journey.sections.map((s) => s.sectionId).filter((id) => assessable.has(id));
  if (sectionIds.length === 0) {
    return { ok: false, status: 400, error: "This journey has no questions to assess yet" };
  }

  try {
    await createInstance(learnerId, {
      kind: JOURNEY_KIND,
      assessedJourneyId: journeyId,
      assessedJourneyName: journey.name,
      sections: { create: sectionIds.map((sectionId) => ({ sectionId })) },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, status: 409, error: "An assessment is already in progress" };
    }
    throw err;
  }
  return { ok: true, sectionIds };
}

/**
 * Marks the learner's active instance complete, only once its path is
 * finished (assessment.path.ts), and rolls its questions up into one
 * CompetenceScore row per competence in the learner's bank, grouped by each
 * question's own competenceId. Every question counts, so SATs compare like
 * for like: one never asked (its level, or one below it, wasn't passed)
 * scores 0 of QUESTION_MAX_SCORE. The only
 * answers deleted are ones to questions no longer in the learner's bank
 * (deleted, or hidden from their role since), so every later read of the
 * responses agrees with the scores. Each score also stores copies of its
 * competence's name and its section and level, so History can still show
 * and group it if the content is deleted later. "none" if there's no
 * active instance.
 */
export async function completeActiveInstance(learnerId: string): Promise<CompleteResult> {
  const inputs = await loadPathInputs(learnerId);
  const active = inputs?.active;
  if (!inputs || !active) return "none";

  const { answered, next } = buildPath(
    inputs.sections,
    inputs.answers,
    isPartialReassessment(active),
  );
  if (next) return "unfinished";

  // Answers to questions no longer in the learner's bank (deleted, or
  // hidden from their role since), buildPath already left them out.
  const inBank = new Set(answered);
  const outsideBankIds = inputs.responses
    .filter((r) => !r.questionId || !inBank.has(r.questionId))
    .map((r) => r.id);

  const byCompetence = new Map<
    string,
    {
      score: number;
      maxScore: number;
      competenceName: string;
      sectionCode: string | null;
      sectionName: string;
      level: number | null;
    }
  >();
  for (const q of inputs.questions.values()) {
    const answer = inputs.answers.get(q.id);
    if (answer && answer.score === null) continue; // answered, but nothing scorable
    const { section, level } = q.sectionModule;
    const totals = byCompetence.get(q.competenceId) ?? {
      score: 0,
      maxScore: 0,
      competenceName: q.competence.name,
      sectionCode: section.code,
      sectionName: section.name,
      level,
    };
    totals.score += answer?.score ?? 0;
    totals.maxScore += answer ? (answer.maxScore ?? 0) : QUESTION_MAX_SCORE;
    byCompetence.set(q.competenceId, totals);
  }

  await prisma.$transaction([
    prisma.response.deleteMany({ where: { id: { in: outsideBankIds } } }),
    prisma.satInstance.update({ where: { id: active.id }, data: { completedAt: new Date() } }),
    ...Array.from(byCompetence.entries()).map(([competenceId, totals]) =>
      prisma.competenceScore.upsert({
        where: { satInstanceId_competenceId: { satInstanceId: active.id, competenceId } },
        update: totals,
        create: { satInstanceId: active.id, competenceId, ...totals },
      }),
    ),
  ]);

  return "completed";
}

/**
 * Aborts the learner's in-progress SAT: deletes the unfinished instance, and
 * with it (onDelete: Cascade) every answer saved to it, as if it was never
 * started. Only ever touches unfinished instances, so completed ones and
 * their scores can't be deleted through here. No-ops if there isn't one.
 * Returns how many instances were deleted. The attempt's recorded question
 * views go too, its number is reused by the next attempt, which must start
 * with none.
 */
export async function discardActiveInstance(learnerId: string) {
  const unfinished = await prisma.satInstance.findMany({
    where: { learnerId, completedAt: null },
    select: { kind: true, instanceNum: true },
  });
  if (unfinished.length === 0) return 0;

  const [, { count }] = await prisma.$transaction([
    prisma.questionView.deleteMany({
      where: {
        learnerId,
        OR: unfinished.map(({ kind, instanceNum }) => ({ kind, instanceNum })),
      },
    }),
    prisma.satInstance.deleteMany({ where: { learnerId, completedAt: null } }),
  ]);
  return count;
}

/**
 * The learner's most recently completed SAT instance's competence scores ,
 * one entry per competence actually scored in that instance, sorted by name
 * for a stable axis order. Deliberately not filtered by the learner's
 * *current* role: an initial assessment covers every competence regardless
 * of role, and a later retake's own CompetenceScore rows already reflect
 * whatever was visible when it was taken, re-applying today's role filter
 * here could hide a competence the learner was genuinely just scored on
 * (e.g. after a role change since that run).
 */
export async function getLatestCompetenceScores(learnerId: string) {
  const scores = newestPerCompetence(
    await prisma.competenceScore.findMany({
      ...completedCompetenceScoresQuery(learnerId),
      include: { competence: true },
    }),
  );
  return scores
    .map((s) => ({ competence: { name: s.competence.name }, score: s.score, maxScore: s.maxScore }))
    .sort((a, b) => a.competence.name.localeCompare(b.competence.name));
}

/** History's label for a score whose competence was deleted before names were copied. */
const REMOVED_COMPETENCE = "Removed competence";
/** History's section heading for such scores, when their section can't be found either. */
const UNKNOWN_SECTION = "Other";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Every completed SAT instance for a learner, oldest first, with a summed
 * score and the per-module breakdown grouped by section (A–E, modules in
 * level order), so a History page can show how they've progressed over
 * retakes (CD-21). A reassessment after a learning journey
 * also carries that journey's name and the sections the learner ticked
 * (exactly those, not every section the journey covers); a normal run
 * has null and an empty list. Built from the copies taken when the
 * instance started/finished, so it survives later removal of journeys,
 * sections, competences or questions; rows recorded before those copies
 * existed fall back to the live content while it's still there. Unlike getLatestCompetenceScores, this
 * only lists the areas actually covered by that specific instance (no
 * padding to every area in the bank), if a role change ever narrows which
 * questions a learner sees, this naturally shows exactly what that
 * instance tested, without needing to know why.
 */
export async function getSatHistory(learnerId: string) {
  const instances = await prisma.satInstance.findMany({
    where: { learnerId, kind: MAIN_KIND, completedAt: { not: null } },
    orderBy: { instanceNum: "asc" },
    include: {
      competenceScores: {
        include: {
          competence: {
            select: {
              name: true,
              // Fallback for scores recorded before sections were copied.
              mainForModules: {
                select: { level: true, section: { select: { code: true, name: true } } },
                take: 1,
              },
            },
          },
        },
      },
      completedJourney: { select: { name: true } },
      sections: {
        select: { section: { select: { name: true } } },
        orderBy: { section: { name: "asc" } },
      },
    },
  });

  return instances.map((instance) => {
    // Group each score under its section (A–E), modules in level order.
    const sections = new Map<
      string,
      {
        code: string | null;
        name: string;
        areas: { name: string; score: number; maxScore: number; level: number | null }[];
      }
    >();
    for (const s of instance.competenceScores) {
      const module = s.competence?.mainForModules[0];
      const code = s.sectionCode ?? module?.section.code ?? null;
      const name = s.sectionName ?? module?.section.name ?? UNKNOWN_SECTION;
      const key = `${code ?? ""}|${name}`;
      const entry = sections.get(key) ?? { code, name, areas: [] };
      entry.areas.push({
        name: s.competenceName ?? s.competence?.name ?? REMOVED_COMPETENCE,
        score: s.score,
        maxScore: s.maxScore,
        level: s.level ?? module?.level ?? null,
      });
      sections.set(key, entry);
    }
    const grouped = [...sections.values()].sort(bySectionCode).map(({ code, name, areas }) => ({
      code,
      name,
      areas: areas
        .sort(
          (a, b) => (a.level ?? Infinity) - (b.level ?? Infinity) || a.name.localeCompare(b.name),
        )
        .map(({ name: areaName, score, maxScore }) => ({ name: areaName, score, maxScore })),
    }));
    const all = grouped.flatMap((g) => g.areas);

    return {
      instanceNum: instance.instanceNum,
      completedAt: instance.completedAt,
      sumScore: all.reduce((sum, a) => sum + a.score, 0),
      sumMaxScore: all.reduce((sum, a) => sum + a.maxScore, 0),
      sections: grouped,
      completedJourney: instance.completedJourneyName ?? instance.completedJourney?.name ?? null,
      reassessedSections: isStringArray(instance.reassessedSectionNames)
        ? instance.reassessedSectionNames
        : instance.sections.map((s) => s.section.name),
    };
  });
}

/** Sections in A–E order; any without a code go last, by name. */
function bySectionCode(
  a: { code: string | null; name: string },
  b: { code: string | null; name: string },
): number {
  if (a.code !== b.code) {
    if (a.code === null) return 1;
    if (b.code === null) return -1;
    return a.code.localeCompare(b.code);
  }
  return a.name.localeCompare(b.name);
}

/**
 * One completed SAT's results, section by section, the latest one, or the
 * one with the given instanceNum. Null when there's no such completed SAT.
 *
 * Every section the SAT assessed, plus every section the learner could be
 * assessed in but this SAT didn't touch (`assessed: false`, all 0/0, no
 * level), e.g. sections a journey retake left out. Each section lists one
 * entry per competence its modules cover (main or secondary) or its
 * questions name, scored over every question of an assessed section, the
 * ones never asked as 0, in level order (A1 … A4) so its radar always starts at
 * level 1, and the learner's skill level in it: how many levels they passed
 * from the bottom up (skillLevel in assessment.path.ts). Sections already
 * assessed are shown even if the learner's current role no longer sees
 * them, it's this SAT's record. Sections come in A–E order (their code).
 */
export async function getAttemptSectionScores(learnerId: string, instanceNum?: number) {
  const instance = await prisma.satInstance.findFirst({
    where: {
      learnerId,
      kind: MAIN_KIND,
      completedAt: { not: null },
      ...(instanceNum ? { instanceNum } : {}),
    },
    orderBy: { completedAt: "desc" },
    select: { id: true, instanceNum: true, completedAt: true },
  });
  if (!instance) return null;

  const responses = await prisma.response.findMany({
    where: { satInstanceId: instance.id },
    select: {
      questionId: true,
      score: true,
      maxScore: true,
      question: { select: { competenceId: true, sectionModule: { select: { sectionId: true } } } },
    },
  });

  const totals = new Map<string, { score: number; maxScore: number }>(); // "sectionId:competenceId"
  // Competences with at least one real answer in this instance, as opposed
  // to the "never asked, counts as 0" fill-in below. getDashboardProgress
  // uses this to tell "this attempt actually found out about X" apart from
  // "this attempt never got that far", so a section it barely touched
  // doesn't shadow better, real data an earlier attempt already has for the
  // rest of it (see assessment.progress.ts's snapshotAsOf).
  const reached = new Set<string>(); // "sectionId:competenceId"
  const answersBySection = new Map<string, Map<string, Pick<PathAnswer, "score" | "maxScore">>>();
  for (const r of responses) {
    if (!r.question || !r.questionId) continue; // the question was deleted
    const sectionId = r.question.sectionModule.sectionId;
    const answers = answersBySection.get(sectionId) ?? new Map();
    answers.set(r.questionId, { score: r.score, maxScore: r.maxScore });
    answersBySection.set(sectionId, answers);
    if (!r.maxScore) continue; // nothing scorable, no radar points
    const key = `${sectionId}:${r.question.competenceId}`;
    reached.add(key);
    const entry = totals.get(key) ?? { score: 0, maxScore: 0 };
    entry.score += r.score ?? 0;
    entry.maxScore += r.maxScore;
    totals.set(key, entry);
  }

  // Plus every section the learner could be assessed in that this SAT didn't touch.
  const assessable = await listAssessableSections(learnerId);
  const shownSectionIds = new Set([...answersBySection.keys(), ...assessable.map((s) => s.id)]);

  // A retired module counts only where this attempt answered it, like a
  // retired question below.
  const modules = await prisma.sectionModule.findMany({
    where: {
      sectionId: { in: [...shownSectionIds] },
      OR: [
        { retiredAt: null },
        { questions: { some: { responses: { some: { satInstanceId: instance.id } } } } },
      ],
    },
    select: {
      id: true,
      level: true,
      section: { select: { id: true, code: true, name: true } },
      mainCompetence: { select: { id: true, name: true } },
      secondaryCompetences: { select: { competence: { select: { id: true, name: true } } } },
      // A retired question counts only where this attempt answered it, as if
      // it had never been in the bank otherwise.
      questions: {
        where: {
          OR: [{ retiredAt: null }, { responses: { some: { satInstanceId: instance.id } } }],
        },
        select: { id: true, competence: { select: { id: true, name: true } } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });

  const sections = new Map<
    string,
    {
      section: { id: string; code: string | null; name: string };
      competences: Map<string, string>;
      levels: PathModule[];
    }
  >();
  // competenceId -> the level of the module it's the main competence of.
  const levelOf = new Map<string, number>();
  for (const m of modules) {
    const entry = sections.get(m.section.id) ?? {
      section: m.section,
      competences: new Map<string, string>(),
      levels: [] as PathModule[],
    };
    const covered = [
      m.mainCompetence,
      ...m.secondaryCompetences.map((c) => c.competence),
      ...m.questions.map((q) => q.competence),
    ];
    for (const c of covered) entry.competences.set(c.id, c.name);
    if (m.level !== null) levelOf.set(m.mainCompetence.id, m.level);
    entry.levels.push({ id: m.id, level: m.level, questionIds: m.questions.map((q) => q.id) });
    // In a section this SAT assessed, a question never asked still counts, as 0.
    const answers = answersBySection.get(m.section.id);
    for (const q of answers ? m.questions : []) {
      if (answers?.has(q.id)) continue;
      const key = `${m.section.id}:${q.competence.id}`;
      const total = totals.get(key) ?? { score: 0, maxScore: 0 };
      total.maxScore += QUESTION_MAX_SCORE;
      totals.set(key, total);
    }
    sections.set(m.section.id, entry);
  }
  // Level 1 → 4; a competence that's no module's main one has no level and
  // goes last. Ties (and unleveled ones) by name.
  const byLevel = ([idA, nameA]: [string, string], [idB, nameB]: [string, string]) =>
    (levelOf.get(idA) ?? Infinity) - (levelOf.get(idB) ?? Infinity) || nameA.localeCompare(nameB);

  return {
    instanceNum: instance.instanceNum,
    completedAt: instance.completedAt,
    sections: Array.from(sections.values())
      .sort((a, b) => bySectionCode(a.section, b.section))
      .map(({ section, competences, levels }) => {
        const answers = answersBySection.get(section.id);
        return {
          section,
          assessed: answers !== undefined,
          level: answers ? skillLevel(levels, answers) : null,
          levelCount: levels.length,
          competences: Array.from(competences.entries())
            .sort(byLevel)
            .map(([competenceId, name]) => ({
              competence: { id: competenceId, name },
              // The level of the module it's the main competence of (A1 → 1),
              // or null for one that's no module's main competence.
              level: levelOf.get(competenceId) ?? null,
              score: totals.get(`${section.id}:${competenceId}`)?.score ?? 0,
              maxScore: totals.get(`${section.id}:${competenceId}`)?.maxScore ?? 0,
              reached: reached.has(`${section.id}:${competenceId}`),
            })),
        };
      }),
  };
}

/**
 * The dashboard's before/after view: every section as of the learner's latest
 * full self-assessment and as of the one before it, a partial reassessment
 * (one limited to some sections) is never "latest" or "previous" here, same
 * rule as getCompetencies, so this and the Competencies page never disagree
 * over whether a result counts. A section a SAT didn't cover keeps its last
 * known result, marked with the SAT it comes from, and within a section, a
 * competence a SAT never reached (e.g. it failed an earlier level first)
 * keeps its last known result too, rather than that SAT's own zero-fill
 * shadowing it (see assessment.progress.ts's snapshotAsOf). That means every
 * full SAT can matter to "latest", not just the newest one to touch each
 * section, so all of them are loaded, in practice a handful at most. Null
 * before any completed full SAT; `previous` is null after only one.
 */
export async function getDashboardProgress(learnerId: string) {
  const completed = await prisma.satInstance.findMany({
    where: {
      learnerId,
      kind: MAIN_KIND,
      completedAt: { not: null },
      reassessedSectionNames: { equals: Prisma.DbNull },
    },
    orderBy: { instanceNum: "desc" },
    select: { instanceNum: true, completedAt: true },
  });
  if (completed.length === 0) return null;

  const [latest, previous = null] = completed;
  const attempts: NonNullable<Awaited<ReturnType<typeof getAttemptSectionScores>>>[] = [];
  for (const { instanceNum } of completed) {
    const attempt = await getAttemptSectionScores(learnerId, instanceNum);
    if (attempt) attempts.push(attempt);
  }
  const sections = buildSectionProgress(
    attempts,
    latest.instanceNum,
    previous?.instanceNum ?? null,
  );

  return {
    latest: { instanceNum: latest.instanceNum, completedAt: latest.completedAt },
    previous: previous && { instanceNum: previous.instanceNum, completedAt: previous.completedAt },
    sections,
  };
}

/**
 * The journey recommended after the learner's latest main self-assessment,
 * as the dashboard shows it: the AI advisor's role-aware pick when there is
 * one, else the score-based recommendation, else the suggestion to keep
 * improving with. Null before any main assessment (or after a perfect one).
 */
async function journeyRecommendedAfterMainAssessment(learnerId: string) {
  const latestMain = await prisma.satInstance.findFirst({
    where: { learnerId, kind: MAIN_KIND, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    select: { advice: { select: { journeyId: true } } },
  });
  if (!latestMain) return null;

  const aiPickId = latestMain.advice?.journeyId;
  // The AI's pick, unless it has been retired since; else the score-based one.
  const aiPick = aiPickId
    ? await prisma.learningJourney.findFirst({ where: { id: aiPickId, retiredAt: null } })
    : null;
  const journey =
    aiPick ?? (await recommendJourney(learnerId)) ?? (await suggestJourney(learnerId));
  if (!journey) return null;

  const core = await prisma.journeySection.findMany({
    where: { journeyId: journey.id, coverageLevel: "M" },
    select: { sectionId: true },
  });
  return {
    id: journey.id,
    name: journey.name,
    moodleUrl: journey.moodleUrl,
    sectionIds: core.map((s) => s.sectionId),
  };
}

/**
 * The Competencies overview: every section the learner can be assessed in,
 * with two results per module, the best ever (over their full
 * self-assessments and journey assessments alike) and the one from their
 * single latest full self-assessment specifically, plus a percentage per
 * section for each, always in A–E order. A partial reassessment (limited
 * to some sections) never counts for either (see getDashboardProgress,
 * which applies the same rule to "latest"). The sections of the journey
 * recommended after the main self-assessment (its M sections) are marked
 * relevant, for the "Most relevant for you" card above it.
 */
export async function getCompetencies(learnerId: string) {
  const assessableIds = (await listAssessableSections(learnerId)).map((s) => s.id);

  const [sections, answers, recommended, latestFull] = await Promise.all([
    prisma.section.findMany({
      where: { id: { in: assessableIds } },
      select: {
        id: true,
        code: true,
        name: true,
        modules: {
          where: { retiredAt: null },
          select: { id: true, name: true, level: true, moodleUrl: true },
          orderBy: [{ level: "asc" }, { name: "asc" }],
        },
      },
    }),
    prisma.response.findMany({
      where: {
        // Full assessments and journey assessments both count, a partial
        // reassessment (one limited to some sections) doesn't, so it can't
        // show a "best" result the main radar/progress view wouldn't also
        // credit (see getDashboardProgress).
        satInstance: {
          learnerId,
          completedAt: { not: null },
          OR: [
            { kind: JOURNEY_KIND },
            { kind: MAIN_KIND, reassessedSectionNames: { equals: Prisma.DbNull } },
          ],
        },
        questionId: { not: null },
        score: { not: null },
        maxScore: { not: null },
      },
      select: {
        score: true,
        maxScore: true,
        question: { select: { sectionModuleId: true } },
        satInstance: {
          select: { id: true, kind: true, completedAt: true, assessedJourneyName: true },
        },
      },
    }),
    journeyRecommendedAfterMainAssessment(learnerId),
    // The single most recent full self-assessment, if any, for the
    // "Latest full assessment" tab, as opposed to "best ever" below.
    prisma.satInstance.findFirst({
      where: {
        learnerId,
        kind: MAIN_KIND,
        completedAt: { not: null },
        reassessedSectionNames: { equals: Prisma.DbNull },
      },
      orderBy: { completedAt: "desc" },
      select: { instanceNum: true, completedAt: true, id: true },
    }),
  ]);

  const answerRows = answers.flatMap((a) =>
    a.question && a.satInstance.completedAt
      ? [
          {
            moduleId: a.question.sectionModuleId,
            satInstanceId: a.satInstance.id,
            kind: a.satInstance.kind,
            completedAt: a.satInstance.completedAt,
            journeyName: a.satInstance.assessedJourneyName,
            score: a.score ?? 0,
            maxScore: a.maxScore ?? 0,
          },
        ]
      : [],
  );

  const best = bestPerModule(answerRows);
  // Scoped to one instance, so "best" here is just that instance's own
  // result per module, i.e. the latest full assessment's, not the best ever.
  const latest = latestFull
    ? bestPerModule(answerRows.filter((a) => a.satInstanceId === latestFull.id))
    : new Map();

  const relevantSections = new Set(recommended?.sectionIds ?? []);
  const shown = sections
    .map((section) => {
      const relevant = relevantSections.has(section.id);
      const modules = section.modules.map((m) => ({
        id: m.id,
        code: section.code && m.level ? `${section.code}${m.level}` : null,
        name: m.name,
        moodleUrl: m.moodleUrl,
        relevant,
        best: best.get(m.id) ?? null,
        latest: latest.get(m.id) ?? null,
      }));
      return {
        id: section.id,
        code: section.code,
        name: section.name,
        relevant,
        percent: sectionPercent(modules.map((m) => m.best)),
        assessedModules: modules.filter((m) => m.best).length,
        latestPercent: sectionPercent(modules.map((m) => m.latest)),
        latestAssessedModules: modules.filter((m) => m.latest).length,
        moduleCount: modules.length,
        modules,
      };
    })
    // Always A–E; `relevant` just flags which to highlight, not their order.
    .sort(bySectionCode);

  return {
    recommendedJourney: recommended && {
      id: recommended.id,
      name: recommended.name,
      moodleUrl: recommended.moodleUrl,
    },
    latestInstance: latestFull && {
      instanceNum: latestFull.instanceNum,
      completedAt: latestFull.completedAt,
    },
    sections: shown,
  };
}
