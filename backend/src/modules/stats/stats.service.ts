import { prisma } from "../../db/prisma";
import { experienceBucket } from "./stats.csv";

// All Prisma access for the stats export lives here. Read-only cross-module
// reads of identity_*/assessment_* tables — allowed per
// context/backend-structure.md §5 ("reads, never writes, via Prisma").
//
// Scope (CD-23): only completed, FULL kind:"main" self-assessments — a
// targeted reassessment of one or two weak sections has a different
// (smaller) question set, and a kind:"journey" instance (assessing one
// learning journey on its own) never counts towards the main results
// either (see SatInstance.kind) — mixing either into "how does role X
// perform" stats would just add noise, not signal.

async function completedFullInstances() {
  const instances = await prisma.satInstance.findMany({
    where: { completedAt: { not: null }, kind: "main" },
    include: {
      learner: { include: { userRole: true, profile: true } },
      competenceScores: true,
      responses: {
        include: {
          question: {
            include: { competence: true, sectionModule: { include: { section: true } } },
          },
        },
      },
    },
    orderBy: { startedAt: "asc" },
  });
  // Filtered in code, not the Prisma `where`, to sidestep Prisma's
  // DbNull/JsonNull distinction for a nullable Json column.
  return instances.filter((instance) => instance.reassessedSectionNames === null);
}

export type TestRow = {
  satInstanceId: string;
  role: string;
  industry: string;
  academicDegree: string;
  experienceBucket: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  activeTimeMs: number;
  score: number;
  maxScore: number;
  scorePercent: number;
};

/** One row per completed full assessment — never an identified learner, see stats.csv.ts. */
export async function listTestRows(): Promise<TestRow[]> {
  const instances = await completedFullInstances();

  return instances.map((instance): TestRow => {
    const score = instance.competenceScores.reduce((sum, c) => sum + c.score, 0);
    const maxScore = instance.competenceScores.reduce((sum, c) => sum + c.maxScore, 0);
    const activeTimeMs = instance.responses.reduce((sum, r) => sum + (r.timeSpentMs ?? 0), 0);
    const completedAt = instance.completedAt!; // the filter above guarantees this

    return {
      satInstanceId: instance.id,
      role: instance.learner.userRole?.name ?? "",
      industry: instance.learner.profile?.industry ?? "",
      academicDegree: instance.learner.profile?.academicDegree ?? "",
      experienceBucket: experienceBucket(instance.learner.profile?.yearsOfExperience),
      startedAt: instance.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - instance.startedAt.getTime(),
      activeTimeMs,
      score,
      maxScore,
      scorePercent: maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0,
    };
  });
}

export type QuestionRow = {
  satInstanceId: string;
  role: string;
  section: string;
  competence: string;
  score: number | null;
  maxScore: number | null;
  timeSpentMs: number | null;
};

/**
 * One row per answered question in a completed full assessment, joined back
 * to its test via satInstanceId (a random id, not identifying on its own —
 * safe as a join key with listTestRows' export). "Unknown" section/competence
 * means the question (or its content) has since been deleted.
 */
export async function listQuestionRows(): Promise<QuestionRow[]> {
  const instances = await completedFullInstances();

  return instances.flatMap((instance) =>
    instance.responses.map((response): QuestionRow => ({
      satInstanceId: instance.id,
      role: instance.learner.userRole?.name ?? "",
      section: response.question?.sectionModule.section.name ?? "Unknown",
      competence: response.question?.competence.name ?? "Unknown",
      score: response.score,
      maxScore: response.maxScore,
      timeSpentMs: response.timeSpentMs,
    })),
  );
}
