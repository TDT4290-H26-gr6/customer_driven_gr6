import { isDeepStrictEqual } from "node:util";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { buildPieContent, type AuthoredContent } from "./pie";

// `npm run content:rebuild` (see contentRebuild.cli.ts): builds every stored
// question again from its authored form (`authoredContent`) with today's
// pie.ts, and stores the result where it differs. Learners get the stored
// `content`, built when the question was saved, so a change to how questions
// are built (e.g. escaping prompts as HTML) only reaches questions saved
// after it, unless they're rebuilt. Nothing else changes: not the prompt,
// the authored form, the answers or the scores.

export type StoredQuestion = {
  id: string;
  questionType: string;
  prompt: string;
  authoredContent: unknown;
  content: unknown;
};

export type RebuildPlan = {
  /** Questions whose stored content differs from a fresh build, with that build. */
  rebuild: { id: string; content: unknown }[];
  /** Questions that can't be built again, left as they are. */
  unbuildable: { id: string; reason: string }[];
};

/** Pure: which questions are stored differently from how they're built now. */
export function planRebuild(questions: StoredQuestion[]): RebuildPlan {
  const plan: RebuildPlan = { rebuild: [], unbuildable: [] };
  for (const q of questions) {
    if (!q.authoredContent) {
      plan.unbuildable.push({ id: q.id, reason: "no authored form to build it from" });
      continue;
    }
    let built: unknown;
    try {
      built = buildPieContent(q.questionType, q.prompt, q.authoredContent as AuthoredContent);
    } catch (err) {
      plan.unbuildable.push({ id: q.id, reason: String(err) });
      continue;
    }
    // MySQL stores JSON with its keys reordered, so compare values, not text.
    if (!isDeepStrictEqual(built, q.content)) plan.rebuild.push({ id: q.id, content: built });
  }
  return plan;
}

export function loadStoredQuestions(): Promise<StoredQuestion[]> {
  return prisma.question.findMany({
    select: { id: true, questionType: true, prompt: true, authoredContent: true, content: true },
    orderBy: { id: "asc" },
  });
}

/** Writes a plan's rebuilt content, all or nothing. */
export async function applyRebuild(plan: RebuildPlan): Promise<void> {
  await prisma.$transaction(
    plan.rebuild.map(({ id, content }) =>
      prisma.question.update({
        where: { id },
        data: { content: content as Prisma.InputJsonObject },
      }),
    ),
  );
}
