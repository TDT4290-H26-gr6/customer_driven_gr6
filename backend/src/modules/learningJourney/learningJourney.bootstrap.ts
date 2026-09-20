import { prisma } from "../../db/prisma";

// Example journeys, one per seeded competence area (see prisma/seed.ts).
// Looked up by competence area *name*, not id, since competence areas are
// seeded separately (prisma/seed.ts, run by hand) and may not exist yet on a
// fresh DB — skipped gracefully until they do, so prisma/seed.ts calls this
// again right after creating the areas. Idempotent (upserted on the journey's
// unique name): safe to run on every boot, like courses.bootstrap.ts.
const SEED_JOURNEYS: {
  areaName: string;
  name: string;
  description: string;
  modules: { title: string; description: string }[];
}[] = [
  {
    areaName: "Open Science Principles and Policy",
    name: "Open Science Foundations",
    description: "Build a working grasp of open science principles and policy.",
    modules: [
      { title: "What is Open Science?", description: "Core principles and why they matter." },
      {
        title: "Open Science Policy Landscape",
        description: "EU and institutional policy context.",
      },
    ],
  },
  {
    areaName: "Research Data and Metadata Management",
    name: "FAIR Data Essentials",
    description: "Learn to manage research data and metadata the FAIR way.",
    modules: [
      { title: "FAIR Principles", description: "Findable, Accessible, Interoperable, Reusable." },
      {
        title: "Writing a Data Management Plan",
        description: "Practical DMP structure and tools.",
      },
    ],
  },
  {
    areaName: "Use of AI Tools in Open Science",
    name: "AI Tools for Open Science",
    description: "Evaluate and apply AI tools responsibly in an open science workflow.",
    modules: [
      { title: "Choosing an AI Tool", description: "Evaluating fit, cost, and openness." },
      { title: "Responsible AI Use", description: "Bias, provenance, and disclosure." },
    ],
  },
  {
    areaName: "Legal, Ethical, and Governance Aspects",
    name: "Legal & Ethical Foundations",
    description: "Get comfortable with the legal and governance rules that shape open science.",
    modules: [
      { title: "Data Protection Basics", description: "GDPR and what it means for research data." },
      { title: "Research Ethics & Governance", description: "Consent, oversight, and accountability." },
    ],
  },
  {
    areaName: "Reproducibility and Research Workflows",
    name: "Reproducible Research Practices",
    description: "Build workflows that make your research easy to verify and repeat.",
    modules: [
      { title: "What Makes Research Reproducible?", description: "Common failure points and fixes." },
      { title: "Documenting a Workflow", description: "Version control, provenance, and pipelines." },
    ],
  },
];

export async function ensureSeedLearningJourneys() {
  for (const seed of SEED_JOURNEYS) {
    const area = await prisma.competenceArea.findFirst({ where: { name: seed.areaName } });
    if (!area) continue;

    const journey = await prisma.learningJourney.upsert({
      where: { name: seed.name },
      update: { description: seed.description, competenceAreaId: area.id },
      create: { name: seed.name, description: seed.description, competenceAreaId: area.id },
    });

    for (const [i, mod] of seed.modules.entries()) {
      await prisma.learningJourneyModule.upsert({
        where: { journeyId_order: { journeyId: journey.id, order: i } },
        update: { title: mod.title, description: mod.description },
        create: { journeyId: journey.id, order: i, title: mod.title, description: mod.description },
      });
    }
  }
}
