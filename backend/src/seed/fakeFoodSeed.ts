import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { buildPieContent, type AuthoredContent } from "../modules/assessment/assessment.pie";
import seedData from "./data/aios_fake_food_seed.json";

// Loads the FAKE food-themed dataset in data/aios_fake_food_seed.json — every
// table of schema v3 except the ones a learner fills in themselves
// (sat_instance, response, competence_score, recommendation), so a freshly
// signed-in learner starts with all questions unanswered.
//
// Runs automatically at backend start when the database has no questions
// (see index.ts) and by hand via `npx prisma db seed`. Every insert skips rows
// that already exist, so it is safe to run again.

type Row = Record<string, unknown>;

const tables = seedData as unknown as Record<string, Row[]>;

/** The JSON stores timestamps as ISO strings; Prisma wants Dates. */
function withDates(row: Row): Row {
  const out = { ...row };
  for (const key of ["createdAt", "updatedAt"]) {
    if (typeof out[key] === "string") out[key] = new Date(out[key] as string);
  }
  return out;
}

function table<T>(name: string, map: (row: Row) => Row = (row) => row): T[] {
  return (tables[name] ?? []).map((row) => map(withDates(row))) as unknown as T[];
}

export async function seedFakeFood() {
  const counts: Record<string, number> = {};
  const insert = async (name: string, run: () => Promise<{ count: number }>) => {
    counts[name] = (await run()).count;
  };

  // Order matters: a table is inserted only after every table it points at.
  await insert("source", () =>
    prisma.source.createMany({
      data: table<Prisma.SourceCreateManyInput>("aios.sources.source"),
      skipDuplicates: true,
    }),
  );
  await insert("role", () =>
    prisma.role.createMany({
      data: table<Prisma.RoleCreateManyInput>("aios.identity.role"),
      skipDuplicates: true,
    }),
  );
  await insert("competence", () =>
    prisma.competence.createMany({
      data: table<Prisma.CompetenceCreateManyInput>("aios.assessment.competence"),
      skipDuplicates: true,
    }),
  );
  await insert("competence_secondary_source", () =>
    prisma.competenceSecondarySource.createMany({
      data: table<Prisma.CompetenceSecondarySourceCreateManyInput>(
        "aios.assessment.competence_secondary_source",
      ),
      skipDuplicates: true,
    }),
  );
  await insert("section", () =>
    prisma.section.createMany({
      data: table<Prisma.SectionCreateManyInput>("aios.assessment.section"),
      skipDuplicates: true,
    }),
  );
  await insert("section_module", () =>
    prisma.sectionModule.createMany({
      data: table<Prisma.SectionModuleCreateManyInput>("aios.assessment.section_module"),
      skipDuplicates: true,
    }),
  );
  await insert("section_module_secondary_competence", () =>
    prisma.sectionModuleSecondaryCompetence.createMany({
      data: table<Prisma.SectionModuleSecondaryCompetenceCreateManyInput>(
        "aios.assessment.section_module_secondary_competence",
      ),
      skipDuplicates: true,
    }),
  );
  await insert("question", () =>
    prisma.question.createMany({
      data: table<Prisma.QuestionCreateManyInput>("aios.assessment.question", (row) => ({
        ...row,
        // The seed authors questions in a simple shape; the app stores (and
        // renders) them as PIE items.
        content: buildPieContent(
          String(row.questionType),
          String(row.prompt),
          row.content as AuthoredContent,
        ),
      })),
      skipDuplicates: true,
    }),
  );
  await insert("journey", () =>
    prisma.learningJourney.createMany({
      data: table<Prisma.LearningJourneyCreateManyInput>("aios.learningJourney.journey"),
      skipDuplicates: true,
    }),
  );
  await insert("journey_section", () =>
    prisma.journeySection.createMany({
      data: table<Prisma.JourneySectionCreateManyInput>("aios.learningJourney.journey_section"),
      skipDuplicates: true,
    }),
  );
  await insert("learning_module", () =>
    prisma.learningModule.createMany({
      data: table<Prisma.LearningModuleCreateManyInput>("aios.learningJourney.learning_module"),
      skipDuplicates: true,
    }),
  );
  await insert("learner", () =>
    prisma.learner.createMany({
      data: table<Prisma.LearnerCreateManyInput>("aios.identity.learner", (row) => ({
        ...row,
        hasCompletedInitialAssessment: Boolean(row.hasCompletedInitialAssessment),
      })),
      skipDuplicates: true,
    }),
  );
  await insert("role_section", () =>
    prisma.roleSection.createMany({
      data: table<Prisma.RoleSectionCreateManyInput>("aios.identity.role_section"),
      skipDuplicates: true,
    }),
  );
  await insert("role_competence", () =>
    prisma.roleCompetence.createMany({
      data: table<Prisma.RoleCompetenceCreateManyInput>("aios.identity.role_competence"),
      skipDuplicates: true,
    }),
  );

  return counts;
}

/** Seeds only when the question bank is empty — a fresh database. Returns whether it seeded. */
export async function seedIfEmpty() {
  if ((await prisma.question.count()) > 0) return false;
  await seedFakeFood();
  return true;
}
