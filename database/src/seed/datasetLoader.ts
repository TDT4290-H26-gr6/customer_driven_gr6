import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { config } from "../config";
import { buildPieContent, type AuthoredContent } from "./pie";

// Loads one content dataset (a JSON file in data/) into an empty database:
// every table of schema v3 except the ones a learner fills in themselves
// (sat_instance, response, competence_score, recommendation), so a freshly
// signed-in learner starts with all questions unanswered. Used for both the
// fake food-themed dataset and the real WP2 curriculum (see seed/index.ts).
//
// Once a database holds the content, the database is the source of truth:
// admins change it in the curriculum editor, and this never reloads or
// overwrites it (see seedIfEmpty). Dataset updates are applied on purpose
// with `npm run content:sync`.
//
// The load is one transaction: if any table fails, nothing is kept, and the
// next start simply tries again.

type Row = Record<string, unknown>;

/** Generous: the default 5 s interactive-transaction timeout is too short for a full dataset. */
const SEED_TIMEOUT_MS = 60_000;

/** The JSON stores timestamps (including an exported file's retiredAt) as ISO strings; Prisma wants Dates. */
function withDates(row: Row): Row {
  const out = { ...row };
  for (const key of ["createdAt", "updatedAt", "retiredAt"]) {
    if (typeof out[key] === "string") out[key] = new Date(out[key] as string);
  }
  return out;
}

/**
 * A row's Moodle link. Seed data names the Moodle course by id
 * (`moodleCourseId`), so the real Moodle site can be swapped in in one place
 * (MOODLE_BASE_URL); a row that already knows its full link gives it as
 * `moodleUrl` instead, which wins. Null when the row has neither.
 * (A source outside Moodle, a partner institution's own course page ,
 * gives its `sourceUrl` directly instead; see withMoodleLink.)
 */
export function moodleLink(row: Row, baseUrl = config.moodleBaseUrl): string | null {
  if (typeof row.moodleUrl === "string" && row.moodleUrl) return row.moodleUrl;
  if (row.moodleCourseId === undefined || row.moodleCourseId === null) return null;
  return `${baseUrl}/course/view.php?id=${row.moodleCourseId}`;
}

/** Whether `url` is a web address (http or https), the only links learners are given. */
function isWebLink(url: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * The row without the authoring-only Moodle fields, plus the built link under
 * `key`. A source that gives its own `sourceUrl` (a partner's course page,
 * not Moodle) keeps it. A link that isn't a web address (a `javascript:` or
 * `data:` one would run code when clicked, a typo without `https://` leads
 * nowhere) fails the load, as the curriculum editor refuses one.
 */
export function withMoodleLink(row: Row, key: "moodleUrl" | "sourceUrl"): Row {
  const own = key === "sourceUrl" && typeof row.sourceUrl === "string" && row.sourceUrl;
  const link = own || moodleLink(row);
  if (link && !isWebLink(link)) {
    throw new Error(`${String(row.id)}: its ${key} "${link}" isn't a web address (http or https)`);
  }
  const out: Row = { ...row, [key]: link };
  delete out.moodleCourseId;
  if (key !== "moodleUrl") delete out.moodleUrl;
  return out;
}

export function createDatasetLoader(data: unknown) {
  const tables = data as Record<string, Row[]>;

  function table<T>(name: string, map: (row: Row) => Row = (row) => row): T[] {
    return (tables[name] ?? []).map((row) => map(withDates(row))) as unknown as T[];
  }

  const sectionIds = (tables["aios.assessment.section"] ?? []).map((row) => String(row.id));
  const questionIds = (tables["aios.assessment.question"] ?? []).map((row) => String(row.id));

  async function seedTables(tx: Prisma.TransactionClient) {
    const counts: Record<string, number> = {};
    const insert = async (name: string, run: () => Promise<{ count: number }>) => {
      counts[name] = (await run()).count;
    };

    // Order matters: a table is inserted only after every table it points at.
    await insert("source", () =>
      tx.source.createMany({
        data: table<Prisma.SourceCreateManyInput>("aios.sources.source", (row) =>
          withMoodleLink(row, "sourceUrl"),
        ),
        skipDuplicates: true,
      }),
    );
    await insert("role", () =>
      tx.role.createMany({
        data: table<Prisma.RoleCreateManyInput>("aios.identity.role"),
        skipDuplicates: true,
      }),
    );
    await insert("competence", () =>
      tx.competence.createMany({
        data: table<Prisma.CompetenceCreateManyInput>("aios.assessment.competence"),
        skipDuplicates: true,
      }),
    );
    await insert("competence_secondary_source", () =>
      tx.competenceSecondarySource.createMany({
        data: table<Prisma.CompetenceSecondarySourceCreateManyInput>(
          "aios.assessment.competence_secondary_source",
        ),
        skipDuplicates: true,
      }),
    );
    await insert("section", () =>
      tx.section.createMany({
        data: table<Prisma.SectionCreateManyInput>("aios.assessment.section"),
        skipDuplicates: true,
      }),
    );
    await insert("section_module", () =>
      tx.sectionModule.createMany({
        data: table<Prisma.SectionModuleCreateManyInput>("aios.assessment.section_module", (row) =>
          withMoodleLink(row, "moodleUrl"),
        ),
        skipDuplicates: true,
      }),
    );
    await insert("section_module_secondary_competence", () =>
      tx.sectionModuleSecondaryCompetence.createMany({
        data: table<Prisma.SectionModuleSecondaryCompetenceCreateManyInput>(
          "aios.assessment.section_module_secondary_competence",
        ),
        skipDuplicates: true,
      }),
    );
    await insert("question", () =>
      tx.question.createMany({
        data: table<Prisma.QuestionCreateManyInput>("aios.assessment.question", (row) => ({
          ...row,
          // Kept as authored too: the curriculum editor edits this form.
          authoredContent: row.content as Prisma.InputJsonValue,
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
      tx.learningJourney.createMany({
        data: table<Prisma.LearningJourneyCreateManyInput>("aios.learningJourney.journey", (row) =>
          withMoodleLink(row, "moodleUrl"),
        ),
        skipDuplicates: true,
      }),
    );
    await insert("journey_section", () =>
      tx.journeySection.createMany({
        data: table<Prisma.JourneySectionCreateManyInput>("aios.learningJourney.journey_section"),
        skipDuplicates: true,
      }),
    );
    await insert("learning_module", () =>
      tx.learningModule.createMany({
        data: table<Prisma.LearningModuleCreateManyInput>("aios.learningJourney.learning_module"),
        skipDuplicates: true,
      }),
    );
    await insert("learner", () =>
      tx.learner.createMany({
        data: table<Prisma.LearnerCreateManyInput>("aios.identity.learner", (row) => ({
          ...row,
          hasCompletedInitialAssessment: Boolean(row.hasCompletedInitialAssessment),
        })),
        skipDuplicates: true,
      }),
    );
    await insert("role_section", () =>
      tx.roleSection.createMany({
        data: table<Prisma.RoleSectionCreateManyInput>("aios.identity.role_section"),
        skipDuplicates: true,
      }),
    );
    await insert("role_competence", () =>
      tx.roleCompetence.createMany({
        data: table<Prisma.RoleCompetenceCreateManyInput>("aios.identity.role_competence"),
        skipDuplicates: true,
      }),
    );

    return counts;
  }

  function seed() {
    return prisma.$transaction(seedTables, { timeout: SEED_TIMEOUT_MS, maxWait: SEED_TIMEOUT_MS });
  }

  /**
   * Fills in each question's authored content where the database lacks it:
   * rows loaded before the curriculum editor existed. Only ever fills an
   * empty column, so it never overwrites what an admin has edited.
   */
  async function backfillAuthoredContent() {
    let filled = 0;
    for (const question of tables["aios.assessment.question"] ?? []) {
      const { count } = await prisma.question.updateMany({
        where: { id: String(question.id), authoredContent: { equals: Prisma.DbNull } },
        data: { authoredContent: question.content as Prisma.InputJsonValue },
      });
      filled += count;
    }
    return filled;
  }

  /**
   * Loads the dataset into a database that holds none of it yet (none of its
   * sections). A database that already has its content is left as it is,
   * apart from backfillAuthoredContent: what's in it may have been edited in
   * the curriculum editor, and re-adding deleted rows or overwriting edits
   * would undo that. Returns whether anything was added or filled in.
   */
  async function seedIfEmpty() {
    const present = await prisma.section.count({ where: { id: { in: sectionIds } } });
    if (present === 0) {
      await seed();
      return true;
    }
    return (await backfillAuthoredContent()) > 0;
  }

  return { seed, seedIfEmpty, sectionIds, questionIds };
}
