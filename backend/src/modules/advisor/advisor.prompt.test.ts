import { describe, expect, it } from "vitest";
import {
  MAX_STEPS,
  buildAdviceMessages,
  parseAdvice,
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
    profile: { goals: "Publish my data openly", background: "Biology", yearsOfExperience: 3 },
    competences: [
      { name: "Data management", section: "Research data", percent: 31.6 },
      { name: "Open access", section: "Publishing", percent: 80 },
    ],
    journey: { name: "FAIR foundations", description: "Start with the basics." },
    candidates: [candidate(), candidate({ kind: "module", id: "module-1", title: "Step 1" })],
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
      context({ profile: { goals: "x".repeat(2000), background: null, yearsOfExperience: null } }),
    );
    const data = JSON.parse(user.content);

    expect(data.goals.length).toBeLessThanOrEqual(501);
    expect(data.background).toBeNull();
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
