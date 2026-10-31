import { describe, expect, it } from "vitest";
import { assessmentGuideSteps } from "./assessmentGuide";

const text = (canGoBack: boolean) =>
  assessmentGuideSteps({ canGoBack })
    .flatMap((step) => [step.title, step.body, ...(step.rules ?? [])])
    .join(" ");

describe("assessmentGuideSteps", () => {
  it("opens with the rules, then walks through every control once", () => {
    const steps = assessmentGuideSteps({ canGoBack: false });
    expect(steps[0].target).toBeNull();
    expect(steps[0].rules?.length).toBeGreaterThan(0);
    expect(steps.map((s) => s.target)).toEqual([
      null,
      "progress",
      "question",
      "next",
      "exit",
      "help",
    ]);
  });

  it("says answers are final when the assessment has no Back button", () => {
    expect(text(false)).toContain("you can't go back and change it");
    expect(text(false)).not.toContain("Back takes you");
  });

  it("explains Back instead when the assessment has one", () => {
    expect(text(true)).toContain("Back takes you to the previous question");
    expect(text(true)).not.toContain("can't go back");
  });

  it("explains I don't know, saving as you go, and how to open the guide again", () => {
    const all = text(false);
    expect(all).toContain("I don't know");
    expect(all).toContain("saved as you go");
    expect(all).toContain("?");
  });
});
