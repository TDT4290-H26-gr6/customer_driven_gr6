import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { buildPieContent, type AuthoredContent } from "../modules/assessment/assessment.pie";
import seedData from "./data/aios_open_science_seed.json";

// Loads the REAL open-science content (CD-74): the sources, competences,
// sections/modules and questions authored from the curated course list and
// the 21 real self-assessment questions that existed before the schema
// overhaul (CD-72), re-authored into the new Section → SectionModule →
// Competence hierarchy. Two of the five original competence areas ("Research
// Data and Metadata Management", "Reproducibility and Research Workflows")
// are seeded as bare Competence rows only — no section/module/questions have
// ever been authored for them, in the old schema or this one.
//
// Runs on every backend boot (see index.ts) and by hand via
// `npx prisma db seed`. Every insert skips rows that already exist, so it is
// safe to run again.

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

/**
 * The real (non-fake) personas this content is for. Granted the real
 * sections/competences below; the FAKE roles stay exclusively on fake
 * content. These names may already exist in the database from before this
 * seed existed — upserted by `name` (its unique key) rather than inserted
 * with a fixed id, so an existing role keeps its existing id and just gets
 * the grants added, instead of silently ending up with two rows for the
 * same persona.
 */
const REAL_ROLE_NAMES = [
  "Administrator",
  "CEO",
  "Librarian",
  "Other",
  "Professor",
  "Research Data Steward",
  "Researcher",
  "Student",
] as const;

async function ensureRealRoleIds(): Promise<string[]> {
  const roles = await Promise.all(
    REAL_ROLE_NAMES.map((name) =>
      prisma.role.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );
  return roles.map((role) => role.id);
}

const REAL_SECTION_IDS = [
  "section-real-open-science-policy",
  "section-real-legal-ethics-governance",
  "section-real-ai-tools",
];

export async function seedOpenScienceContent() {
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
  await insert("competence", () =>
    prisma.competence.createMany({
      data: table<Prisma.CompetenceCreateManyInput>("aios.assessment.competence"),
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
  await insert("question", () =>
    prisma.question.createMany({
      data: table<Prisma.QuestionCreateManyInput>("aios.assessment.question", (row) => ({
        ...row,
        content: buildPieContent(
          String(row.questionType),
          String(row.prompt),
          row.content as AuthoredContent,
        ),
      })),
      skipDuplicates: true,
    }),
  );

  const roleIds = await ensureRealRoleIds();
  await insert("role_section", () =>
    prisma.roleSection.createMany({
      data: roleIds.flatMap((roleId) =>
        REAL_SECTION_IDS.map((sectionId) => ({ roleId, sectionId })),
      ),
      skipDuplicates: true,
    }),
  );

  return counts;
}
