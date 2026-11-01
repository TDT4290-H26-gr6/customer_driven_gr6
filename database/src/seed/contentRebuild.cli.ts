import { prisma } from "../db/prisma";
import { applyRebuild, loadStoredQuestions, planRebuild } from "./contentRebuild";

// npm run content:rebuild               dry run: lists what would change
// npm run content:rebuild -- --apply    stores the rebuilt questions
// (see contentRebuild.ts)

async function main() {
  const apply = process.argv.slice(2).includes("--apply");
  const plan = planRebuild(await loadStoredQuestions());

  if (plan.unbuildable.length > 0) {
    console.log("Left as they are, since they can't be built again:");
    for (const u of plan.unbuildable) console.log(`  ${u.id}: ${u.reason}`);
    console.log("");
  }
  if (plan.rebuild.length === 0) {
    console.log("No changes: every question is stored as it's built now.");
    return;
  }
  console.log("Stored differently from how they're built now:");
  for (const r of plan.rebuild) console.log(`  ${r.id}`);

  if (!apply) {
    console.log(
      "\nDry run: nothing was changed. To store them as they're built now, run:\n" +
        "  npm run content:rebuild -- --apply",
    );
    return;
  }
  await applyRebuild(plan);
  console.log(`\nRebuilt ${plan.rebuild.length} question(s).`);
}

main()
  .catch((err: unknown) => {
    console.error(`\nContent rebuild failed, nothing was changed:\n${String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
