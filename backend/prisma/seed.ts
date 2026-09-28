import { prisma } from "../src/db/prisma";
import { seedFakeFood } from "../src/seed/fakeFoodSeed";
import { seedOpenScienceContent } from "../src/seed/openScienceSeed";

// `npx prisma db seed` — loads the fake dataset and the real open-science
// content by hand. The backend also does both by itself on start.
Promise.all([seedFakeFood(), seedOpenScienceContent()])
  .then(([fake, openScience]) => console.log("Seeded:", { fake, openScience }))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
