import { describe, expect, it, vi } from "vitest";
import { prisma } from "../db/prisma";
import {
  applyRebuild,
  loadStoredQuestions,
  planRebuild,
  type StoredQuestion,
} from "./contentRebuild";
import { buildPieContent, type AuthoredContent } from "./pie";

vi.mock("../db/prisma", () => ({
  prisma: {
    question: { findMany: vi.fn(), update: vi.fn((args: unknown) => args) },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

const authored: AuthoredContent = {
  options: [
    { id: "a", text: "CC BY" },
    { id: "b", text: "All rights reserved" },
  ],
  correctOptionIds: ["a"],
};

function stored(prompt: string, content?: unknown): StoredQuestion {
  return {
    id: "q-1",
    questionType: "single_choice",
    prompt,
    authoredContent: authored,
    content: content ?? buildPieContent("single_choice", prompt, authored),
  };
}

describe("planRebuild", () => {
  it("rebuilds a question saved before its prompt was escaped", () => {
    const prompt = "Is <b>this</b> open?";
    // As an older pie.ts stored it: the prompt as raw markup.
    const old = buildPieContent("single_choice", "x", authored) as { models: { prompt: string }[] };
    old.models[0].prompt = prompt;

    const plan = planRebuild([stored(prompt, old)]);

    expect(plan.rebuild).toHaveLength(1);
    expect(JSON.stringify(plan.rebuild[0].content)).toContain("Is &lt;b&gt;this&lt;/b&gt; open?");
  });

  it("leaves a question that's already stored as it's built now, whatever its key order", () => {
    const fresh = buildPieContent("single_choice", "Open?", authored);
    // MySQL hands JSON back with its keys reordered.
    const reordered = JSON.parse(JSON.stringify(fresh, Object.keys(fresh).reverse()));
    expect(planRebuild([stored("Open?", { ...reordered, ...fresh })]).rebuild).toEqual([]);
  });

  it("leaves out, and names, a question it can't build again", () => {
    const plan = planRebuild([
      { ...stored("Old"), id: "q-old", authoredContent: null },
      { ...stored("Broken"), id: "q-bad", questionType: "ordering", authoredContent: {} },
    ]);
    expect(plan.rebuild).toEqual([]);
    expect(plan.unbuildable.map((u) => u.id)).toEqual(["q-old", "q-bad"]);
  });
});

describe("the database steps", () => {
  it("reads every question's authored and stored forms", async () => {
    vi.mocked(prisma.question.findMany).mockResolvedValue([]);
    await loadStoredQuestions();
    expect(prisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          questionType: true,
          prompt: true,
          authoredContent: true,
          content: true,
        },
      }),
    );
  });

  it("stores the rebuilt content, in one transaction", async () => {
    await applyRebuild({ rebuild: [{ id: "q-1", content: { models: [] } }], unbuildable: [] });
    expect(prisma.question.update).toHaveBeenCalledWith({
      where: { id: "q-1" },
      data: { content: { models: [] } },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
