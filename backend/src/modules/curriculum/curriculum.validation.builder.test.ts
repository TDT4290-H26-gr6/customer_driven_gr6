import { describe, expect, it, vi } from "vitest";
import { validateQuestionInput } from "./curriculum.validation";

// The builder is the last line of defence: anything it would reject becomes a
// 400 with its message, never a half-built question.
vi.mock("../assessment/assessment.pie", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  buildPieContent: vi.fn(() => {
    throw new Error("likert question needs content.scale");
  }),
}));

describe("validateQuestionInput", () => {
  it("reports what the question builder rejects", () => {
    const result = validateQuestionInput({
      questionType: "likert",
      prompt: "How confident are you?",
      sectionModuleId: "mod-1",
      competenceId: "c-1",
      content: { scale: { min: 1, max: 5 } },
    });
    expect(result).toEqual({ error: "likert question needs content.scale" });
  });
});
