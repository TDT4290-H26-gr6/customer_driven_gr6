import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../db/prisma";
import { buildCurriculumExport } from "./curriculum.export";

vi.mock("../../db/prisma", () => {
  const model = () => ({ findMany: vi.fn() });
  return {
    prisma: {
      source: model(),
      role: model(),
      competence: model(),
      competenceSecondarySource: model(),
      section: model(),
      sectionModule: model(),
      sectionModuleSecondaryCompetence: model(),
      question: model(),
      learningJourney: model(),
      journeySection: model(),
      learningModule: model(),
      roleSection: model(),
      roleCompetence: model(),
    },
  };
});

const db = vi.mocked(prisma, true);

beforeEach(() => {
  vi.resetAllMocks();
  for (const model of Object.values(db)) model.findMany.mockResolvedValue([]);
});

describe("buildCurriculumExport", () => {
  it("writes every content table in the dataset format the loader reads", async () => {
    const now = new Date("2026-10-31T12:00:00Z");
    const result = await buildCurriculumExport(now);
    expect(Object.keys(result)).toEqual([
      "_meta",
      "aios.sources.source",
      "aios.identity.role",
      "aios.assessment.competence",
      "aios.assessment.competence_secondary_source",
      "aios.assessment.section",
      "aios.assessment.section_module",
      "aios.assessment.section_module_secondary_competence",
      "aios.assessment.question",
      "aios.learningJourney.journey",
      "aios.learningJourney.journey_section",
      "aios.learningJourney.learning_module",
      "aios.identity.role_section",
      "aios.identity.role_competence",
    ]);
    expect(result._meta).toMatchObject({ exportedAt: "2026-10-31T12:00:00.000Z" });
    expect(result._meta).not.toHaveProperty("questionsWithoutAuthoredContent");
  });

  it("writes questions as authored, which the loader builds the PIE item from", async () => {
    db.question.findMany.mockResolvedValue([
      {
        id: "q-1",
        prompt: "Rate it",
        questionType: "likert",
        authoredContent: { scale: { min: 1, max: 5 } },
        sectionModuleId: "mod-1",
        competenceId: "c-1",
        retiredAt: null,
      },
      { id: "q-old", authoredContent: null },
    ] as never);
    const result = await buildCurriculumExport();
    expect(result["aios.assessment.question"]).toEqual([
      {
        id: "q-1",
        prompt: "Rate it",
        questionType: "likert",
        content: { scale: { min: 1, max: 5 } },
        sectionModuleId: "mod-1",
        competenceId: "c-1",
        retiredAt: null,
      },
    ]);
    // One that can't be loaded is named rather than silently left out.
    expect(result._meta).toMatchObject({ questionsWithoutAuthoredContent: ["q-old"] });
  });

  it("leaves learners out: no grant says who made it", async () => {
    await buildCurriculumExport();
    expect(db.roleSection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: { roleId: true, sectionId: true } }),
    );
    expect(db.roleCompetence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: { roleId: true, competenceId: true } }),
    );
  });
});
