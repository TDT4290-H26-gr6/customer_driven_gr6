/**
 * DEV-ONLY. Plants a completed SatInstance + CompetenceScore rows for one
 * learner, so the Learning Journey recommendation (and the dashboard) have
 * something real to read before the actual quiz-submission + grading
 * pipeline exists. Not wired into the container boot or `prisma db seed` ,
 * run by hand against your local DB:
 *
 *   npx tsx scripts/seed-dev-scores.ts <learner-email>
 *
 * Safe to re-run: each run adds one more completed instance for that
 * learner, so the recommendation always has the latest one to read.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/seed-dev-scores.ts <learner-email>");
    process.exit(1);
  }

  const learner = await prisma.learner.findUnique({ where: { email } });
  if (!learner) {
    console.error(`No learner with email ${email}, log in once via the app first.`);
    process.exit(1);
  }

  const areas = await prisma.competenceArea.findMany();
  if (areas.length === 0) {
    console.error("No competence areas found, run `npx prisma db seed` first.");
    process.exit(1);
  }

  const instance = await prisma.satInstance.create({
    data: { learnerId: learner.id, instanceNum: 1, completedAt: new Date() },
  });

  // Deliberately uneven mock scores so one area is clearly weakest and the
  // recommendation logic has an unambiguous pick.
  await prisma.competenceScore.createMany({
    data: areas.map((area, i) => ({
      satInstanceId: instance.id,
      competenceAreaId: area.id,
      score: ((i * 7) % 5) + 1, // 1..5, varied per area
    })),
  });

  await prisma.learner.update({
    where: { id: learner.id },
    data: { hasCompletedInitialAssessment: true },
  });

  console.log(`Seeded SatInstance ${instance.id} with ${areas.length} competence scores.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
