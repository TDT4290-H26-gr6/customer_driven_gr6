import { prisma } from "../../db/prisma";

// The curriculum as a dataset file, in the format of database/src/seed/data/
// aios_wp2_seed.json, so `db-init` can load it into an empty database (put it
// in place of that file, or alongside it as a new dataset). This is how the
// curriculum moves with the application: the database is the source of
// truth, and this is a copy of it.
//
// Only content: no learners, answers, results or change log. Removed items
// keep their retiredAt, so they come back removed. Moodle links are written
// out in full (moodleUrl), which the loader prefers over a course id; role
// grants leave out who granted them, as that learner won't exist.

type ExportedTable = Record<string, unknown>[];

const byId = { orderBy: { id: "asc" } } as const;

export async function buildCurriculumExport(now = new Date()) {
  const [
    sources,
    roles,
    competences,
    competenceSources,
    sections,
    modules,
    moduleCompetences,
    questions,
    journeys,
    journeySections,
    steps,
    roleSections,
    roleCompetences,
  ] = await Promise.all([
    prisma.source.findMany({
      ...byId,
      select: {
        id: true,
        institution: true,
        country: true,
        courseName: true,
        type: true,
        level: true,
        degreeProgramme: true,
        credits: true,
        language: true,
        instructor: true,
        format: true,
        topics: true,
        prerequisites: true,
        description: true,
        sourceUrl: true,
        confidence: true,
      },
    }),
    prisma.role.findMany({ ...byId, select: { id: true, name: true } }),
    prisma.competence.findMany({
      ...byId,
      select: { id: true, name: true, description: true, primarySourceId: true },
    }),
    prisma.competenceSecondarySource.findMany({
      orderBy: [{ competenceId: "asc" }, { sourceId: "asc" }],
      select: { competenceId: true, sourceId: true },
    }),
    prisma.section.findMany({
      ...byId,
      select: { id: true, code: true, name: true, description: true, retiredAt: true },
    }),
    prisma.sectionModule.findMany({
      ...byId,
      select: {
        id: true,
        name: true,
        description: true,
        mainCompetenceId: true,
        sectionId: true,
        level: true,
        moodleUrl: true,
        retiredAt: true,
      },
    }),
    prisma.sectionModuleSecondaryCompetence.findMany({
      orderBy: [{ moduleId: "asc" }, { competenceId: "asc" }],
      select: { moduleId: true, competenceId: true },
    }),
    prisma.question.findMany({
      ...byId,
      select: {
        id: true,
        prompt: true,
        questionType: true,
        authoredContent: true,
        sectionModuleId: true,
        competenceId: true,
        retiredAt: true,
      },
    }),
    prisma.learningJourney.findMany({
      ...byId,
      select: { id: true, name: true, description: true, moodleUrl: true, retiredAt: true },
    }),
    prisma.journeySection.findMany({
      orderBy: [{ journeyId: "asc" }, { sectionId: "asc" }],
      select: { journeyId: true, sectionId: true, coverageLevel: true },
    }),
    prisma.learningModule.findMany({
      orderBy: [{ journeyId: "asc" }, { order: "asc" }],
      select: {
        id: true,
        journeyId: true,
        order: true,
        title: true,
        description: true,
        sourceId: true,
      },
    }),
    prisma.roleSection.findMany({
      orderBy: [{ roleId: "asc" }, { sectionId: "asc" }],
      select: { roleId: true, sectionId: true },
    }),
    prisma.roleCompetence.findMany({
      orderBy: [{ roleId: "asc" }, { competenceId: "asc" }],
      select: { roleId: true, competenceId: true },
    }),
  ]);

  // The dataset stores a question as authored; the loader builds the PIE item
  // from it. A question without its authored form can't be loaded, so it's
  // listed instead (none should be: db-init fills it in for older rows).
  const exportable = questions.filter((q) => q.authoredContent !== null);
  const notExported = questions.filter((q) => q.authoredContent === null).map((q) => q.id);

  const tables: Record<string, ExportedTable | Record<string, unknown>> = {
    _meta: {
      description:
        "AIOS curriculum exported from the database by the curriculum editor. Loads into an " +
        "empty database like aios_wp2_seed.json.",
      exportedAt: now.toISOString(),
      ...(notExported.length > 0 && { questionsWithoutAuthoredContent: notExported }),
    },
    "aios.sources.source": sources,
    "aios.identity.role": roles,
    "aios.assessment.competence": competences,
    "aios.assessment.competence_secondary_source": competenceSources,
    "aios.assessment.section": sections,
    "aios.assessment.section_module": modules,
    "aios.assessment.section_module_secondary_competence": moduleCompetences,
    "aios.assessment.question": exportable.map(({ authoredContent, ...q }) => ({
      ...q,
      content: authoredContent,
    })),
    "aios.learningJourney.journey": journeys,
    "aios.learningJourney.journey_section": journeySections,
    "aios.learningJourney.learning_module": steps,
    "aios.identity.role_section": roleSections,
    "aios.identity.role_competence": roleCompetences,
  };
  return tables;
}
