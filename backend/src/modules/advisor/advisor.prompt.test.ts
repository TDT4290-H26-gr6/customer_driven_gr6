import { describe, expect, it } from "vitest";
import {
  MAX_STEPS,
  buildAdviceMessages,
  parseAdvice,
  toAdviceProgress,
  type AdviceContext,
  type Candidate,
} from "./advisor.prompt";

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    kind: "source",
    id: "source-1",
    title: "Intro to FAIR data (NTNU)",
    description: "The basics of FAIR data.",
    competence: "Data management",
    url: "https://moodle.example.org/course/view.php?id=101",
    ...overrides,
  };
}

function context(overrides: Partial<AdviceContext> = {}): AdviceContext {
  return {
    role: "PhD candidate",
    profile: {
      industry: "Higher education",
      academicDegree: "PhD",
      background: "PhD candidate in biology",
      yearsOfExperience: 3,
      goals: "Publish my data openly",
    },
    competences: [
      { name: "Data management", section: "Research data", percent: 31.6 },
      { name: "Open access", section: "Publishing", percent: 80 },
    ],
    journey: { name: "FAIR foundations", description: "Start with the basics." },
    candidates: [candidate(), candidate({ kind: "module", id: "module-1", title: "Step 1" })],
    progress: null,
    minSteps: 1,
    ...overrides,
  };
}

describe("buildAdviceMessages", () => {
  it("sends a system prompt that says low scores need the most work", () => {
    const [system] = buildAdviceMessages(context());

    expect(system.role).toBe("system");
    expect(system.content).toMatch(/LOW score means the learner needs the MOST improvement/);
    expect(system.content).toMatch(/Never invent courses/);
  });

  it("sends the learner data as JSON, weakest first, with short refs and rounded scores", () => {
    const [, user] = buildAdviceMessages(context());
    const data = JSON.parse(user.content);

    expect(data.role).toBe("PhD candidate");
    expect(data.industry).toBe("Higher education");
    expect(data.academicDegree).toBe("PhD");
    expect(data.background).toBe("PhD candidate in biology");
    expect(data.yearsOfExperienceInAiOrOpenScience).toBe(3);
    expect(data.goals).toBe("Publish my data openly");
    expect(data.competenceScoresWeakestFirst[0]).toEqual({
      competence: "Data management",
      section: "Research data",
      scorePercent: 32,
    });
    expect(data.recommendedJourney.name).toBe("FAIR foundations");
    expect(data.candidates.map((c: { ref: string }) => c.ref)).toEqual(["c1", "c2"]);
    // Ids and links stay on our side — the model only needs refs.
    expect(user.content).not.toContain("source-1");
    expect(user.content).not.toContain("moodle.example.org");
  });

  it("caps long learner-written profile text", () => {
    const [, user] = buildAdviceMessages(
      context({
        profile: {
          industry: null,
          academicDegree: null,
          background: "x".repeat(2000),
          yearsOfExperience: null,
          goals: "y".repeat(2000),
        },
      }),
    );
    const data = JSON.parse(user.content);

    expect(data.background.length).toBeLessThanOrEqual(501);
    expect(data.goals.length).toBeLessThanOrEqual(501);
    expect(data.industry).toBeNull();
  });
});

describe("parseAdvice", () => {
  const candidates = [
    candidate({ id: "source-1", title: "First" }),
    candidate({ id: "source-2", title: "Second" }),
  ];

  it("maps refs back to the real candidates, in the model's order", () => {
    const advice = parseAdvice(
      {
        summary: " Focus on data management first. ",
        steps: [
          { ref: "c2", reason: "Builds your weakest area." },
          { ref: "c1", reason: "A good follow-up." },
        ],
      },
      candidates,
    );

    expect(advice.summary).toBe("Focus on data management first.");
    expect(advice.steps.map((s) => [s.id, s.reason])).toEqual([
      ["source-2", "Builds your weakest area."],
      ["source-1", "A good follow-up."],
    ]);
    expect(advice.steps[0].url).toBe(candidates[1].url);
  });

  it("drops made-up refs, duplicates and steps without a reason", () => {
    const advice = parseAdvice(
      {
        summary: "ok",
        steps: [
          { ref: "c9", reason: "Not a real candidate" },
          { ref: "c1", reason: "Real" },
          { ref: "c1", reason: "Duplicate" },
          { ref: "c2", reason: "   " },
          "nonsense",
        ],
      },
      candidates,
    );

    expect(advice.steps.map((s) => s.id)).toEqual(["source-1"]);
  });

  it(`keeps at most ${MAX_STEPS} steps`, () => {
    const many = Array.from({ length: 8 }, (_, i) => candidate({ id: `s${i}` }));
    const advice = parseAdvice(
      { summary: "ok", steps: many.map((_, i) => ({ ref: `c${i + 1}`, reason: "r" })) },
      many,
    );

    expect(advice.steps).toHaveLength(MAX_STEPS);
  });

  it("accepts a summary with no usable steps", () => {
    expect(parseAdvice({ summary: "ok", steps: "none" }, candidates)).toEqual({
      summary: "ok",
      steps: [],
    });
  });

  it.each([
    ["not an object", "just text"],
    ["no summary", { steps: [] }],
    ["a blank summary", { summary: "  ", steps: [] }],
  ])("throws for %s", (_label, reply) => {
    expect(() => parseAdvice(reply, candidates)).toThrow();
  });
});

describe("toAdviceProgress", () => {
  const section = (id: string, code: string | null, name: string) => ({ id, code, name });

  it("turns each section's before/after into percentages and level codes", () => {
    const progress = toAdviceProgress(3, 2, [
      {
        section: section("a", "A", "Data"),
        levelCount: 4,
        latest: { instanceNum: 3, score: 7, maxScore: 10, level: 3 },
        previous: { instanceNum: 2, score: 4, maxScore: 10, level: 0 },
      },
    ]);

    expect(progress).toEqual({
      previousAssessment: 2,
      latestAssessment: 3,
      sections: [
        {
          section: "Data",
          previousPercent: 40,
          latestPercent: 70,
          previousLevel: "below A1",
          latestLevel: "A3",
          retakenThisTime: true,
        },
      ],
    });
  });

  it("marks a section the latest assessment didn't retake", () => {
    const carried = { instanceNum: 1, score: 5, maxScore: 10, level: 2 };
    const [s] = toAdviceProgress(2, 1, [
      {
        section: section("b", "B", "Publishing"),
        levelCount: 4,
        latest: carried,
        previous: carried,
      },
    ]).sections;

    expect(s.retakenThisTime).toBe(false);
    expect(s.latestPercent).toBe(s.previousPercent);
  });

  it("leaves out sections that were never assessed", () => {
    const progress = toAdviceProgress(2, 1, [
      { section: section("c", "C", "Ethics"), levelCount: 4, latest: null, previous: null },
    ]);
    expect(progress.sections).toEqual([]);
  });
});

describe("buildAdviceMessages with progress", () => {
  it("tells the model how to talk about progress, and sends it", () => {
    const progress = toAdviceProgress(2, 1, []);
    const [system, user] = buildAdviceMessages(context({ progress }));

    expect(system.content).toMatch(/Never invent progress/);
    expect(JSON.parse(user.content).progressSincePreviousAssessment).toEqual(progress);
  });
});

describe("number of steps", () => {
  const candidates = [
    {
      kind: "source" as const,
      id: "s1",
      title: "First",
      description: null,
      competence: "Data",
      url: null,
    },
    {
      kind: "source" as const,
      id: "s2",
      title: "Second",
      description: null,
      competence: null,
      url: null,
    },
  ];

  it("recommends at most 3", () => {
    expect(MAX_STEPS).toBe(3);
  });

  it("tells the model the min and max, and to weigh relevance to the learner's role", () => {
    const [system, user] = buildAdviceMessages(context({ minSteps: 1 }));

    expect(JSON.parse(user.content).numberOfSteps).toEqual({ min: 1, max: 3 });
    expect(system.content).toMatch(/matter for the learner's role/);
    expect(system.content).toMatch(/at least its "min"/);
  });

  it("asks for no steps when there are no candidates (a perfect score)", () => {
    const [system, user] = buildAdviceMessages(context({ minSteps: 0, candidates: [] }));

    expect(JSON.parse(user.content).numberOfSteps).toEqual({ min: 0, max: 3 });
    expect(system.content).toMatch(/perfect score: return no steps/);
  });

  it("adds the first candidate when the model chose nothing but one is required", () => {
    const advice = parseAdvice({ summary: "ok", steps: [] }, candidates, 1);

    expect(advice.steps).toHaveLength(1);
    expect(advice.steps[0]).toMatchObject({ id: "s1", title: "First" });
    expect(advice.steps[0].reason).toMatch(/Builds Data/);
  });

  it("also adds one when every step the model chose was invalid", () => {
    const advice = parseAdvice(
      { summary: "ok", steps: [{ ref: "c9", reason: "made up" }] },
      candidates,
      1,
    );

    expect(advice.steps.map((s) => s.id)).toEqual(["s1"]);
  });

  it("adds nothing when no step is required", () => {
    expect(parseAdvice({ summary: "Perfect!", steps: [] }, candidates, 0).steps).toEqual([]);
  });

  it("adds nothing when there's nothing to add (no candidates)", () => {
    expect(parseAdvice({ summary: "Perfect!", steps: [] }, [], 1).steps).toEqual([]);
  });

  it("keeps the model's own choice when it chose something", () => {
    const advice = parseAdvice(
      { summary: "ok", steps: [{ ref: "c2", reason: "Fits your role." }] },
      candidates,
      1,
    );

    expect(advice.steps.map((s) => [s.id, s.reason])).toEqual([["s2", "Fits your role."]]);
  });
});
