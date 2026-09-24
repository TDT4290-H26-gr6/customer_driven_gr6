import { prisma } from "../src/db/prisma";
import { seedFakeFood } from "../src/seed/fakeFoodSeed";

// `npx prisma db seed` — loads the fake dataset by hand. The backend also does
// this by itself on start when the database has no questions.
seedFakeFood()
  .then((counts) => console.log("Seeded:", counts))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
