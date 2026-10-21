import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../db/prisma";
import {
  computeDropoff,
  getDropoff,
  type DropoffAttempt,
  type DropoffQuestionMeta,
} from "./dropoff.service";

vi.mock("../../db/prisma", () => ({
  prisma: {
    satInstance: { findMany: vi.fn() },
    questionView: { findMany: vi.fn() },
    question: { findMany: vi.fn() },
  },
}));

const mockPrisma = vi.mocked(prisma, true);

const NOW = new Date("2026-10-21T12:00:00.000Z");
const OLD = new Date("2026-10-01T12:00:00.000Z"); // 20 days ago -> abandoned
const FRESH = new Date("2026-10-20T12:00:00.000Z"); // 1 day ago -> in progress

const secA = { id: "secA", code: "A", name: "Section A" };
const secB = { id: "secB", code: "B", name: "Section B" };

function meta(id: string, section = secA, day = 1): DropoffQuestionMeta {
  return {
    id,
    prompt: `Prompt ${id}`,
    questionType: "likert",
    createdAt: new Date(2026, 0, day),
    section,
  };
}

const questions = new Map([
  ["q1", meta("q1", secA, 1)],
  ["q2", meta("q2", secA, 2)],
  ["q3", meta("q3", secB, 3)],
]);

const at = (base: Date, step: number) => new Date(base.getTime() + step * 1000);

/** An attempt that answered `answered` (and, if given, was also shown `viewed` — a superset). */
function attempt(
  answered: (string | null)[],
  base: Date,
  opts: { completed?: boolean; viewed?: (string | null)[] } = {},
): DropoffAttempt {
  const responses = answered.map((questionId, i) => ({
    questionId,
    answeredAt: at(base, i * 2 + 1),
  }));
  const views = (opts.viewed ?? []).map((questionId, i) => ({
    questionId,
    viewedAt: at(base, i * 2),
  }));
  return {
    startedAt: base,
    completedAt: opts.completed ? at(base, 100) : null,
    responses,
    views,
  };
}

describe("computeDropoff (no view rows: answers imply views)", () => {
  const attempts = [
    attempt(["q1", "q2", "q3"], OLD, { completed: true }),
    attempt(["q1", "q2"], OLD), // abandoned, stopped at q2
    attempt(["q1"], OLD), // abandoned, stopped at q1
    attempt(["q1", "q2"], FRESH), // in progress: excluded everywhere
  ];

  it("counts completed, abandoned and in-progress, excluding in-progress from rates", () => {
    const { summary, questions: rows } = computeDropoff(attempts, questions, NOW, 7);

    expect(summary).toEqual({ started: 4, completed: 1, abandoned: 2, inProgress: 1 });
    const byId = Object.fromEntries(rows.map((r) => [r.questionId, r]));
    expect(byId.q1).toMatchObject({ viewedCount: 3, answeredCount: 3, droppedCount: 1 });
    expect(byId.q1.dropOffRate).toBeCloseTo(1 / 3);
    expect(byId.q2).toMatchObject({ viewedCount: 2, droppedCount: 1, dropOffRate: 0.5 });
    expect(byId.q3).toMatchObject({ viewedCount: 1, droppedCount: 0, dropOffRate: 0 });
    expect(byId.q1.lowSample).toBe(true);
  });

  it("orders questions by their typical position in an attempt", () => {
    const { questions: rows } = computeDropoff(attempts, questions, NOW, 7);
    expect(rows.map((r) => [r.questionId, r.order])).toEqual([
      ["q1", 1],
      ["q2", 2],
      ["q3", 3],
    ]);
  });

  it("a longer inactivity window turns abandoned attempts into in-progress", () => {
    const { summary } = computeDropoff(attempts, questions, NOW, 30);
    expect(summary).toEqual({ started: 4, completed: 1, abandoned: 0, inProgress: 3 });
  });

  it("flags lowSample only below 5 views", () => {
    const many = Array.from({ length: 5 }, () => attempt(["q1"], OLD, { completed: true }));
    const { questions: rows } = computeDropoff(many, questions, NOW, 7);
    expect(rows[0]).toMatchObject({ viewedCount: 5, lowSample: false });
  });

  it("limits to one section when sectionId is set", () => {
    const { summary, questions: rows } = computeDropoff(attempts, questions, NOW, 7, "secB");
    expect(summary.started).toBe(1);
    expect(rows.map((r) => r.questionId)).toEqual(["q3"]);
  });

  it("ignores deleted questions without attributing a stop to them", () => {
    const { summary, questions: rows } = computeDropoff(
      [attempt(["q1", null], OLD)],
      questions,
      NOW,
      7,
    );
    expect(summary.abandoned).toBe(1);
    expect(rows[0]).toMatchObject({ questionId: "q1", viewedCount: 1, droppedCount: 0 });
  });
});

describe("computeDropoff (recorded views)", () => {
  it("stops at the question that was shown but not answered", () => {
    // Answered q1, was shown q2, left.
    const a = attempt(["q1"], OLD, { viewed: ["q1", "q2"] });

    const { summary, questions: rows } = computeDropoff([a], questions, NOW, 7);

    expect(summary.abandoned).toBe(1);
    const byId = Object.fromEntries(rows.map((r) => [r.questionId, r]));
    expect(byId.q1).toMatchObject({ viewedCount: 1, answeredCount: 1, droppedCount: 0 });
    expect(byId.q2).toMatchObject({
      viewedCount: 1,
      answeredCount: 0,
      droppedCount: 1,
      dropOffRate: 1,
    });
  });

  it("counts a view-only attempt (nothing answered) as abandoned at the first question", () => {
    const a = attempt([], OLD, { viewed: ["q1"] });

    const { summary, questions: rows } = computeDropoff([a], questions, NOW, 7);

    expect(summary).toEqual({ started: 1, completed: 0, abandoned: 1, inProgress: 0 });
    expect(rows[0]).toMatchObject({
      questionId: "q1",
      viewedCount: 1,
      answeredCount: 0,
      droppedCount: 1,
    });
  });

  it("treats a recent view as activity, so the attempt is still in progress", () => {
    const a = attempt(["q1"], OLD, { viewed: ["q1", "q2"] });
    a.views.push({ questionId: "q2", viewedAt: FRESH });
    a.views.shift(); // keep one view, but a recent one

    const { summary } = computeDropoff([a], questions, NOW, 7);

    expect(summary.inProgress).toBe(1);
  });

  it("an answered question with no view row still counts as viewed", () => {
    const a = attempt(["q1", "q2"], OLD, { viewed: ["q1"] }); // q2's view request was lost

    const { questions: rows } = computeDropoff([a], questions, NOW, 7);

    expect(rows.map((r) => [r.questionId, r.viewedCount])).toEqual([
      ["q1", 1],
      ["q2", 1],
    ]);
  });

  it("revisiting an earlier question does not move the stop", () => {
    // First views are all that's stored, so the stop is the furthest question.
    const a = attempt(["q1", "q2"], OLD, { viewed: ["q1", "q2"] });
    expect(
      computeDropoff([a], questions, NOW, 7).questions.find((r) => r.droppedCount),
    ).toMatchObject({
      questionId: "q2",
    });
  });

  it("returns only aggregates, no learner fields", () => {
    const json = JSON.stringify(computeDropoff([attempt(["q1"], OLD)], questions, NOW, 7));
    expect(json).not.toMatch(/learner|email/i);
  });
});

describe("getDropoff", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.question.findMany.mockResolvedValue([
      {
        id: "q1",
        prompt: "Prompt q1",
        questionType: "likert",
        createdAt: new Date(2026, 0, 1),
        sectionModule: { section: secA },
      },
    ] as never);
    mockPrisma.questionView.findMany.mockResolvedValue([]);
  });

  const row = (reassessed: unknown, instanceNum = 1, learnerId = "l1") => ({
    learnerId,
    instanceNum,
    startedAt: OLD,
    completedAt: null,
    reassessedSectionNames: reassessed,
    responses: [{ questionId: "q1", answeredAt: OLD }],
  });

  it("initial: full main instances only, with date filters in the query", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([row(null), row(["A"], 2)] as never);

    const result = await getDropoff(
      {
        type: "initial",
        inactiveDays: 7,
        from: new Date("2026-10-01"),
        to: new Date("2026-10-31"),
      },
      NOW,
    );

    expect(result.summary.started).toBe(1);
    const where = mockPrisma.satInstance.findMany.mock.calls[0][0]!.where;
    expect(where).toMatchObject({
      kind: "main",
      instanceNum: 1,
      startedAt: { gte: new Date("2026-10-01"), lte: new Date("2026-10-31") },
    });
    expect(mockPrisma.questionView.findMany.mock.calls[0][0]!.where).toMatchObject({
      kind: "main",
      instanceNum: 1,
    });
  });

  it("targeted_reevaluation: partial reassessments only", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([row(null), row(["A"], 2)] as never);

    const result = await getDropoff({ type: "targeted_reevaluation", inactiveDays: 7 }, NOW);

    expect(result.summary.started).toBe(1);
    const where = mockPrisma.satInstance.findMany.mock.calls[0][0]!.where!;
    expect(where).not.toHaveProperty("instanceNum");
  });

  it("joins views to their instance by learner and attempt number", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([row(null, 1, "l1")] as never);
    mockPrisma.questionView.findMany.mockResolvedValue([
      { learnerId: "l1", instanceNum: 1, questionId: "q1", viewedAt: OLD },
      { learnerId: "other", instanceNum: 1, questionId: "q1", viewedAt: OLD }, // someone else's
    ] as never);

    const result = await getDropoff({ type: "initial", inactiveDays: 7 }, NOW);

    // l1's instance + other's view-only attempt = 2 started; l1's own view isn't doubled.
    expect(result.summary).toEqual({ started: 2, completed: 0, abandoned: 2, inProgress: 0 });
    expect(result.questions[0]).toMatchObject({ viewedCount: 2, droppedCount: 2 });
  });

  it("a learner who only viewed the first question counts as a started, abandoned attempt", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([]);
    mockPrisma.questionView.findMany.mockResolvedValue([
      { learnerId: "l9", instanceNum: 1, questionId: "q1", viewedAt: OLD },
    ] as never);

    const result = await getDropoff({ type: "initial", inactiveDays: 7 }, NOW);

    expect(result.summary).toEqual({ started: 1, completed: 0, abandoned: 1, inProgress: 0 });
  });

  it("applies the date range to view-only attempts too, and ignores them for reevaluations", async () => {
    mockPrisma.satInstance.findMany.mockResolvedValue([]);
    mockPrisma.questionView.findMany.mockResolvedValue([
      { learnerId: "l9", instanceNum: 1, questionId: "q1", viewedAt: OLD },
    ] as never);

    const outOfRange = await getDropoff(
      { type: "initial", inactiveDays: 7, from: new Date("2026-10-10") },
      NOW,
    );
    const reeval = await getDropoff({ type: "targeted_reevaluation", inactiveDays: 7 }, NOW);

    expect(outOfRange.summary.started).toBe(0);
    expect(reeval.summary.started).toBe(0);
  });
});
