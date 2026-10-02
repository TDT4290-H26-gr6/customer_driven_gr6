import { Prisma, type Question } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { findLearnerById, getRoleGrants } from "../identity/identity.service";
import { ORDERED_QUESTION_TYPES } from "./assessment.pie";
import { completedCompetenceScoresQuery, newestPerCompetence } from "./assessment.newestScores";
import {
  extractDragAndDropBlanks,
  extractMultipleChoiceValues,
  IDK_VALUE,
  QUESTION_MAX_SCORE,
  scoreDragAndDrop,
  scoreLikert,
  scoreMultipleChoice,
  type ScoreResult,
} from "./assessment.scoring";

// All Prisma access for assessment_* tables lives here.

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Randomizes the on-screen order of a question's answer choices (Fisher–
 * Yates) so "it's always the 2nd option" never becomes a shortcut. Each
 * choice keeps its own value/id and correct flag, so this has no effect on
 * scoring (assessment.scoring.ts looks choices up by value/id, never by
 * position) — but ordered scales (likert) and true/false are left alone,
 * since their order is the point, not noise to shuffle. The "I don't know"
 * choice every question carries (IDK_VALUE) is never shuffled in among the
 * others either — it's held back and always placed last.
 */
function withShuffledChoices<T extends Pick<Question, "questionType" | "content">>(question: T): T {
  if (ORDERED_QUESTION_TYPES.includes(question.questionType)) return question;

  const content = question.content as { models?: { choices?: { value?: unknown }[] }[] } | null;
  const models = content?.models;
  const firstModel = models?.[0];
  if (!content || !models || !firstModel?.choices) return question;

  const idk = firstModel.choices.filter((c) => c.value === IDK_VALUE);
  const rest = firstModel.choices.filter((c) => c.value !== IDK_VALUE);
  const shuffledModels = [
    { ...firstModel, choices: [...shuffle(rest), ...idk] },
    ...models.slice(1),
  ];
  return { ...question, content: { ...content, models: shuffledModels } as Prisma.JsonValue };
}

/** Whether this learner has never finished a SAT instance — their initial assessment is still ahead of them. */
async function isInitialAssessment(learnerId: string): Promise<boolean> {
  const completedCount = await prisma.satInstance.count({
    where: { learnerId, completedAt: { not: null } },
  });
  return completedCount === 0;
}

/**
 * Which questions this learner may currently see. Everyone gets the whole
 * bank for their initial assessment (every section, every competence) —
 * that's the point of it — regardless of role. Once they've completed at
 * least one instance, later runs go back to the normal role allow-lists:
 * those whose competence has been granted to the role, OR whose module sits
 * in a section granted to the role (identity_role_competence /
 * identity_role_section). A role with no grants then sees nothing. Returns
 * null for a learner with no role at all — they can't take anything yet.
 */
async function roleQuestionFilter(learnerId: string): Promise<Prisma.QuestionWhereInput | null> {
  const learner = await findLearnerById(learnerId);
  if (!learner?.roleId) return null;

  if (await isInitialAssessment(learnerId)) return {};

  const { sectionIds, competenceIds } = await getRoleGrants(learner.roleId);
  return {
    OR: [
      { competenceId: { in: competenceIds } },
      { sectionModule: { sectionId: { in: sectionIds } } },
    ],
  };
}

/**
 * roleQuestionFilter, narrowed to the sections the learner's in-progress
 * reassessment is limited to (see startReassessment) — when it's limited at
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
    where: { modules: { some: { questions: { some: roleFilter } } } },
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
    withShuffledChoices({
      id: q.id,
      prompt: q.prompt,
      questionType: q.questionType,
      content: q.content,
      competence: q.competence,
    }),
  );
}

/**
 * Shape of the PIE `content` this module stores — narrowed just enough to
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
 * PieAnswer wrapper (`{ session, complete }` — see PieQuestionPlayer), not
 * the raw PIE session itself; the session lives at `answer.session`.
 */
function scoreAnswer(
  question: Pick<Question, "questionType" | "content">,
  answer: unknown,
): ScoreResult | null {
  const model = (question.content as { models?: PieModel[] } | null)?.models?.[0];
  if (!model) return null;
  const modelId = model.id ?? "1"; // every question this module stores has exactly one model, id "1"
  const session = (answer as { session?: unknown } | null)?.session;

  if (question.questionType === "drag_and_drop" && model.correctResponse) {
    return scoreDragAndDrop(model.correctResponse, extractDragAndDropBlanks(session, modelId));
  }

  if (!model.choices) return null;

  const selected = extractMultipleChoiceValues(session, modelId);

  // "I don't know" always scores 0 out of the full question — even on a
  // multi_choice where other boxes were also ticked — rather than scoring it
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

/** The learner's current unfinished SAT instance, if any — not created here. */
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
 * Creates the learner's next instance (instanceNum = their highest + 1).
 * `extra` carries a reassessment's journey and section limit.
 */
async function createInstance(
  learnerId: string,
  extra: Omit<Prisma.SatInstanceUncheckedCreateInput, "learnerId" | "instanceNum"> = {},
) {
  const latest = await prisma.satInstance.findFirst({
    where: { learnerId },
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
    // instance first (unique on learnerId + instanceNum) — use theirs.
    if (isUniqueViolation(err)) {
      const created = await findActiveInstance(learnerId);
      if (created) return created;
    }
    throw err;
  }
}

export type StartReassessmentInput = { completedJourneyId: string; sectionIds: string[] };

export type StartReassessmentResult =
  { ok: true } | { ok: false; status: 400 | 409; error: string };

/**
 * Starts a reassessment after the learner finished a learning journey: a new
 * instance that records the journey and is limited to the chosen sections,
 * so listQuestions only returns those. (A reassessment without a journey
 * needs no start — the first saved answer creates a normal instance.)
 * Refused while another instance is in progress, before the first
 * assessment is done (that one covers everything), for an unknown journey,
 * and for sections with no question the learner's role can see.
 */
export async function startReassessment(
  learnerId: string,
  { completedJourneyId, sectionIds }: StartReassessmentInput,
): Promise<StartReassessmentResult> {
  if (await findActiveInstance(learnerId)) {
    return { ok: false, status: 409, error: "An assessment is already in progress" };
  }
  if (await isInitialAssessment(learnerId)) {
    return { ok: false, status: 409, error: "Finish your first assessment before reassessing" };
  }

  const journey = await prisma.learningJourney.findUnique({
    where: { id: completedJourneyId },
    select: { name: true },
  });
  if (!journey) return { ok: false, status: 400, error: "Unknown learning journey" };

  const assessable = new Map(
    (await listAssessableSections(learnerId)).map((s) => [s.id, s.name] as const),
  );
  const unique = [...new Set(sectionIds)];
  if (unique.length === 0 || unique.some((id) => !assessable.has(id))) {
    return { ok: false, status: 400, error: "Choose one or more sections you can be assessed in" };
  }

  try {
    await createInstance(learnerId, {
      completedJourneyId,
      // Copies for History, which must outlive the journey and sections.
      completedJourneyName: journey.name,
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

/**
 * Save/resume (CD-7 / SAT2): the learner's in-progress instance plus every
 * answer saved so far, so the frontend can restore exactly where they left
 * off. Returns null if they haven't started (or have only completed
 * instances) — a fresh start, not an error.
 */
export async function getProgress(learnerId: string) {
  const active = await findActiveInstance(learnerId);
  if (!active) return null;

  const responses = await prisma.response.findMany({
    where: { satInstanceId: active.id },
  });

  return {
    satInstanceId: active.id,
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
 * Returns null — and saves nothing — when the question doesn't exist or
 * isn't one the learner's role may see: a learner can only answer the
 * questions listQuestions would have given them. Checked before the
 * instance is created, so a bad id never leaves an empty instance behind.
 */
export async function saveResponse(
  learnerId: string,
  questionId: string,
  answer: Prisma.InputJsonValue,
) {
  const visible = await visibleQuestionFilter(learnerId);
  if (!visible) return null;

  const question = await prisma.question.findFirst({
    where: { AND: [{ id: questionId }, visible] },
  });
  if (!question) return null;

  const instance = await getOrCreateActiveInstance(learnerId);
  const result = scoreAnswer(question, answer);
  const data = { answer, score: result?.score ?? null, maxScore: result?.maxScore ?? null };

  return prisma.response.upsert({
    where: { satInstanceId_questionId: { satInstanceId: instance.id, questionId } },
    update: data,
    create: { satInstanceId: instance.id, questionId, ...data },
  });
}

/**
 * Marks the learner's active instance complete and rolls its scored
 * responses up into one CompetenceScore row per competence touched — grouped
 * by each question's own competenceId, independent of the section/module
 * hierarchy. Unscored responses, and answers whose question has since been
 * deleted, are excluded. Each score also stores a copy of its competence's
 * name, so History can still show it if the competence is deleted later.
 * No-ops if there isn't an active instance.
 */
export async function completeActiveInstance(learnerId: string) {
  const active = await findActiveInstance(learnerId);
  if (!active) return null;

  const responses = await prisma.response.findMany({
    where: { satInstanceId: active.id, score: { not: null } },
    include: {
      question: { select: { competenceId: true, competence: { select: { name: true } } } },
    },
  });

  const byCompetence = new Map<
    string,
    { score: number; maxScore: number; competenceName: string }
  >();
  for (const r of responses) {
    if (!r.question) continue;
    const competenceId = r.question.competenceId;
    const totals = byCompetence.get(competenceId) ?? {
      score: 0,
      maxScore: 0,
      competenceName: r.question.competence.name,
    };
    totals.score += r.score ?? 0;
    totals.maxScore += r.maxScore ?? 0;
    byCompetence.set(competenceId, totals);
  }

  await prisma.$transaction([
    prisma.satInstance.update({ where: { id: active.id }, data: { completedAt: new Date() } }),
    ...Array.from(byCompetence.entries()).map(([competenceId, totals]) =>
      prisma.competenceScore.upsert({
        where: { satInstanceId_competenceId: { satInstanceId: active.id, competenceId } },
        update: totals,
        create: { satInstanceId: active.id, competenceId, ...totals },
      }),
    ),
  ]);

  return active;
}

/**
 * Aborts the learner's in-progress SAT: deletes the unfinished instance, and
 * with it (onDelete: Cascade) every answer saved to it — as if it was never
 * started. Only ever touches unfinished instances, so completed ones and
 * their scores can't be deleted through here. No-ops if there isn't one.
 * Returns how many instances were deleted.
 */
export async function discardActiveInstance(learnerId: string) {
  const { count } = await prisma.satInstance.deleteMany({
    where: { learnerId, completedAt: null },
  });
  return count;
}

/**
 * The learner's most recently completed SAT instance's competence scores —
 * one entry per competence actually scored in that instance, sorted by name
 * for a stable axis order. Deliberately not filtered by the learner's
 * *current* role: an initial assessment covers every competence regardless
 * of role, and a later retake's own CompetenceScore rows already reflect
 * whatever was visible when it was taken — re-applying today's role filter
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Every completed SAT instance for a learner, oldest first, with a summed
 * score and the per-area breakdown — so a History page can show how they've
 * progressed over retakes (CD-21). A reassessment after a learning journey
 * also carries that journey's name and the sections the learner ticked
 * (exactly those — not every section the journey covers); a normal run
 * has null and an empty list. Built from the copies taken when the
 * instance started/finished, so it survives later removal of journeys,
 * sections, competences or questions; rows recorded before those copies
 * existed fall back to the live content while it's still there. Unlike getLatestCompetenceScores, this
 * only lists the areas actually covered by that specific instance (no
 * padding to every area in the bank) — if a role change ever narrows which
 * questions a learner sees, this naturally shows exactly what that
 * instance tested, without needing to know why.
 */
export async function getSatHistory(learnerId: string) {
  const instances = await prisma.satInstance.findMany({
    where: { learnerId, completedAt: { not: null } },
    orderBy: { instanceNum: "asc" },
    include: {
      competenceScores: { include: { competence: { select: { name: true } } } },
      completedJourney: { select: { name: true } },
      sections: {
        select: { section: { select: { name: true } } },
        orderBy: { section: { name: "asc" } },
      },
    },
  });

  return instances.map((instance) => {
    const areas = instance.competenceScores
      .map((s) => ({
        name: s.competenceName ?? s.competence?.name ?? REMOVED_COMPETENCE,
        score: s.score,
        maxScore: s.maxScore,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      instanceNum: instance.instanceNum,
      completedAt: instance.completedAt,
      sumScore: areas.reduce((sum, a) => sum + a.score, 0),
      sumMaxScore: areas.reduce((sum, a) => sum + a.maxScore, 0),
      areas,
      completedJourney: instance.completedJourneyName ?? instance.completedJourney?.name ?? null,
      reassessedSections: isStringArray(instance.reassessedSectionNames)
        ? instance.reassessedSectionNames
        : instance.sections.map((s) => s.section.name),
    };
  });
}

/**
 * The latest completed SAT's scores broken down per section: for each section
 * the learner was actually assessed in, one entry per competence its modules
 * cover (main or secondary) or its visible questions name, whether or not it
 * was scored there (0/0 if not). Sections with no scored answers in the
 * instance are left out entirely. Scores are grouped by each question's own section and
 * competence, so a competence appearing in several sections is scored
 * separately in each. Deliberately not filtered by the learner's *current*
 * role — see the note on getLatestCompetenceScores above; the same reasoning
 * applies here.
 */
export async function getLatestSectionCompetenceScores(learnerId: string) {
  // Newest completed instance first, so the first instance seen for a
  // section is the newest one that assessed it.
  const responses = await prisma.response.findMany({
    where: { satInstance: { learnerId, completedAt: { not: null } }, maxScore: { gt: 0 } },
    orderBy: [{ satInstance: { completedAt: "desc" } }, { satInstanceId: "asc" }],
    select: {
      satInstanceId: true,
      score: true,
      maxScore: true,
      question: { select: { competenceId: true, sectionModule: { select: { sectionId: true } } } },
    },
  });

  // Answers whose question was deleted no longer belong to any section.
  const live = responses.flatMap((r) => (r.question ? [{ ...r, question: r.question }] : []));
  if (live.length === 0) return [];

  const newestInstanceForSection = new Map<string, string>(); // sectionId -> satInstanceId
  for (const r of live) {
    const sectionId = r.question.sectionModule.sectionId;
    if (!newestInstanceForSection.has(sectionId)) {
      newestInstanceForSection.set(sectionId, r.satInstanceId);
    }
  }

  const totals = new Map<string, { score: number; maxScore: number }>(); // "sectionId:competenceId"
  const assessedSectionIds = new Set<string>();
  for (const r of live) {
    const sectionId = r.question.sectionModule.sectionId;
    if (newestInstanceForSection.get(sectionId) !== r.satInstanceId) continue;
    const key = `${sectionId}:${r.question.competenceId}`;
    const entry = totals.get(key) ?? { score: 0, maxScore: 0 };
    entry.score += r.score ?? 0;
    entry.maxScore += r.maxScore ?? 0;
    totals.set(key, entry);
    assessedSectionIds.add(sectionId);
  }

  // A section's axes are every competence its modules cover (main or
  // secondary) plus any a question in it names — whether or not it was scored.
  const modules = await prisma.sectionModule.findMany({
    where: { sectionId: { in: [...assessedSectionIds] } },
    select: {
      section: { select: { id: true, name: true } },
      mainCompetence: { select: { id: true, name: true } },
      secondaryCompetences: { select: { competence: { select: { id: true, name: true } } } },
      questions: { select: { competence: { select: { id: true, name: true } } } },
    },
  });

  const sections = new Map<
    string,
    { section: { id: string; name: string }; competences: Map<string, string> }
  >();
  for (const m of modules) {
    const entry = sections.get(m.section.id) ?? { section: m.section, competences: new Map() };
    const covered = [
      m.mainCompetence,
      ...m.secondaryCompetences.map((c) => c.competence),
      ...m.questions.map((q) => q.competence),
    ];
    for (const c of covered) entry.competences.set(c.id, c.name);
    sections.set(m.section.id, entry);
  }

  return Array.from(sections.values())
    .sort((a, b) => a.section.name.localeCompare(b.section.name))
    .map(({ section, competences }) => ({
      section,
      competences: Array.from(competences.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([competenceId, name]) => ({
          competence: { name },
          score: totals.get(`${section.id}:${competenceId}`)?.score ?? 0,
          maxScore: totals.get(`${section.id}:${competenceId}`)?.maxScore ?? 0,
        })),
    }));
}
