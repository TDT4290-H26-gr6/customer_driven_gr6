import { prisma } from "../../db/prisma";
import { MAIN_KIND } from "../assessment/assessment.kinds";

// Question drop-off for the admin page: at which question do learners stop?
// Read-only, computed on demand over SatInstance + Response + QuestionView, and
// aggregate-only — no learner id, name or email ever leaves this module.
//
// An "attempt" is one SatInstance, or — for a learner who opened the first
// question and left before answering anything — a group of views with no
// instance yet (only possible for the initial assessment).
//
// Definitions:
//  - completed: SatInstance.completedAt is set.
//  - abandoned: not completed AND its latest activity (a view or an answer) is
//    older than `inactiveDays`. Not completed with fresher activity is "in
//    progress" and left out of every drop-off count.
//  - an attempt "stopped at" the last question it was shown (viewed).
//  - drop-off rate = stoppedHere / viewed, where viewed counts distinct
//    completed + abandoned attempts that were shown the question.
//  - an answer implies the question was shown, so a question answered but with
//    no view row (older data, or a view request that failed) still counts as
//    viewed, at the time it was answered.

export type DropoffType = "initial" | "targeted_reevaluation";

export const LOW_SAMPLE_THRESHOLD = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DropoffQuery = {
  type: DropoffType;
  sectionId?: string;
  from?: Date;
  to?: Date;
  inactiveDays: number;
};

export type DropoffAttempt = {
  startedAt: Date;
  completedAt: Date | null;
  /** Answers; a null questionId means the question was deleted since. */
  responses: { questionId: string | null; answeredAt: Date }[];
  /** First views; same null rule. */
  views: { questionId: string | null; viewedAt: Date }[];
};

export type DropoffQuestionMeta = {
  id: string;
  prompt: string;
  questionType: string;
  createdAt: Date;
  section: { id: string; code: string | null; name: string };
};

export type DropoffQuestionRow = {
  questionId: string;
  text: string;
  questionType: string;
  section: { id: string; code: string | null; name: string };
  /** 1-based rank of the question by its typical position in an attempt. */
  order: number;
  /** Finished or abandoned attempts that were shown the question. */
  viewedCount: number;
  /** Finished or abandoned attempts that answered it. */
  answeredCount: number;
  /** Abandoned attempts whose last-viewed question this is ("stopped here"). */
  droppedCount: number;
  /** droppedCount / viewedCount. */
  dropOffRate: number;
  lowSample: boolean;
};

export type DropoffResult = {
  summary: { started: number; completed: number; abandoned: number; inProgress: number };
  questions: DropoffQuestionRow[];
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

type Event = { questionId: string | null; at: number };

/**
 * Pure aggregation, kept apart from Prisma so the numbers are easy to verify.
 * With `sectionId` set, only attempts that were shown something in that
 * section count, and only that section's questions are reported.
 */
export function computeDropoff(
  attempts: DropoffAttempt[],
  questions: Map<string, DropoffQuestionMeta>,
  now: Date,
  inactiveDays: number,
  sectionId?: string,
): DropoffResult {
  const cutoff = now.getTime() - inactiveDays * DAY_MS;
  const summary = { started: 0, completed: 0, abandoned: 0, inProgress: 0 };
  const stats = new Map<
    string,
    { viewed: number; answered: number; dropped: number; positions: number[] }
  >();

  for (const attempt of attempts) {
    // Everything the learner did, oldest first (a stable sort keeps views
    // before the answer to the same question when the times tie).
    const events: Event[] = [
      ...attempt.views.map((v) => ({ questionId: v.questionId, at: v.viewedAt.getTime() })),
      ...attempt.responses.map((r) => ({ questionId: r.questionId, at: r.answeredAt.getTime() })),
    ].sort((a, b) => a.at - b.at);

    // The sequence of questions shown: each question at its first appearance.
    const shown: string[] = [];
    for (const event of events) {
      if (event.questionId !== null && questions.has(event.questionId)) {
        if (!shown.includes(event.questionId)) shown.push(event.questionId);
      }
    }
    if (sectionId && !shown.some((id) => questions.get(id)!.section.id === sectionId)) continue;
    summary.started += 1;

    const completed = attempt.completedAt !== null;
    const lastEvent = events[events.length - 1];
    const lastActivity = lastEvent?.at ?? attempt.startedAt.getTime();
    const abandoned = !completed && lastActivity < cutoff;
    if (completed) summary.completed += 1;
    else if (abandoned) summary.abandoned += 1;
    else {
      summary.inProgress += 1;
      continue; // in progress: excluded from numerator and denominator
    }

    const answeredIds = new Set(attempt.responses.map((r) => r.questionId));
    shown.forEach((id, index) => {
      const entry = stats.get(id) ?? { viewed: 0, answered: 0, dropped: 0, positions: [] };
      entry.viewed += 1;
      if (answeredIds.has(id)) entry.answered += 1;
      entry.positions.push(index + 1);
      stats.set(id, entry);
    });

    // Stopped at the last thing they were shown. If that was a since-deleted
    // question there's nothing to attribute the stop to.
    if (abandoned && lastEvent?.questionId != null && stats.has(lastEvent.questionId)) {
      stats.get(lastEvent.questionId)!.dropped += 1;
    }
  }

  const rows = [...stats.entries()]
    .map(([questionId, entry]) => ({
      meta: questions.get(questionId)!,
      entry,
      position: median(entry.positions),
    }))
    .filter(({ meta }) => !sectionId || meta.section.id === sectionId)
    .sort(
      (a, b) =>
        a.position - b.position ||
        a.meta.createdAt.getTime() - b.meta.createdAt.getTime() ||
        a.meta.id.localeCompare(b.meta.id),
    );

  return {
    summary,
    questions: rows.map(({ meta, entry }, index) => ({
      questionId: meta.id,
      text: meta.prompt,
      questionType: meta.questionType,
      section: meta.section,
      order: index + 1,
      viewedCount: entry.viewed,
      answeredCount: entry.answered,
      droppedCount: entry.dropped,
      dropOffRate: entry.viewed > 0 ? entry.dropped / entry.viewed : 0,
      lowSample: entry.viewed < LOW_SAMPLE_THRESHOLD,
    })),
  };
}

export async function getDropoff(query: DropoffQuery, now = new Date()): Promise<DropoffResult> {
  const initial = query.type === "initial";
  const inRange = (at: Date) => (!query.from || at >= query.from) && (!query.to || at <= query.to);

  const instances = await prisma.satInstance.findMany({
    where: {
      kind: MAIN_KIND,
      ...(initial ? { instanceNum: 1 } : {}),
      ...(query.from || query.to
        ? {
            startedAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    },
    select: {
      learnerId: true,
      instanceNum: true,
      startedAt: true,
      completedAt: true,
      reassessedSectionNames: true,
      responses: {
        select: { questionId: true, answeredAt: true },
        orderBy: [{ answeredAt: "asc" }, { id: "asc" }],
      },
    },
  });

  // Filtered in code, not the Prisma `where`, to sidestep Prisma's
  // DbNull/JsonNull distinction for a nullable Json column (as stats.service does).
  const scoped = instances.filter((instance) =>
    initial ? instance.reassessedSectionNames === null : instance.reassessedSectionNames !== null,
  );

  // Views are keyed to the attempt (learner + number), not to an instance.
  const viewRows = await prisma.questionView.findMany({
    where: { kind: MAIN_KIND, ...(initial ? { instanceNum: 1 } : { instanceNum: { gte: 2 } }) },
    select: { learnerId: true, instanceNum: true, questionId: true, viewedAt: true },
    orderBy: { viewedAt: "asc" },
  });
  const viewsByAttempt = new Map<string, { questionId: string | null; viewedAt: Date }[]>();
  for (const v of viewRows) {
    const key = `${v.learnerId}:${v.instanceNum}`;
    const list = viewsByAttempt.get(key) ?? [];
    list.push({ questionId: v.questionId, viewedAt: v.viewedAt });
    viewsByAttempt.set(key, list);
  }

  const attempts: DropoffAttempt[] = scoped.map((instance) => {
    const key = `${instance.learnerId}:${instance.instanceNum}`;
    const views = viewsByAttempt.get(key) ?? [];
    viewsByAttempt.delete(key);
    return {
      startedAt: instance.startedAt,
      completedAt: instance.completedAt,
      responses: instance.responses,
      views,
    };
  });

  // Views left over belong to a learner who opened the first question and left
  // before answering, so no instance exists. Only the initial assessment
  // arises that way (a reassessment creates its instance when it starts).
  if (initial) {
    for (const [key, views] of viewsByAttempt) {
      if (!key.endsWith(":1") || !inRange(views[0].viewedAt)) continue;
      attempts.push({ startedAt: views[0].viewedAt, completedAt: null, responses: [], views });
    }
  }

  const questionIds = [
    ...new Set(
      attempts.flatMap((a) => [
        ...a.responses.map((r) => r.questionId),
        ...a.views.map((v) => v.questionId),
      ]),
    ),
  ].filter((id): id is string => id !== null);
  const rows = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true,
      prompt: true,
      questionType: true,
      createdAt: true,
      sectionModule: { select: { section: { select: { id: true, code: true, name: true } } } },
    },
  });
  const questions = new Map<string, DropoffQuestionMeta>(
    rows.map((q) => [
      q.id,
      {
        id: q.id,
        prompt: q.prompt,
        questionType: q.questionType,
        createdAt: q.createdAt,
        section: q.sectionModule.section,
      },
    ]),
  );

  return computeDropoff(attempts, questions, now, query.inactiveDays, query.sectionId);
}
