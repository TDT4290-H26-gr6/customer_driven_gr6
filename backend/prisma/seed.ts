import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const areas = {
    c1: await prisma.competenceArea.create({
      data: { name: "Open Science Principles and Policy" },
    }),
    c2: await prisma.competenceArea.create({
      data: { name: "Research Data and Metadata Management" },
    }),
    c3: await prisma.competenceArea.create({
      data: { name: "Reproducibility and Research Workflows" },
    }),
    c4: await prisma.competenceArea.create({
      data: { name: "Legal, Ethical, and Governance Aspects" },
    }),
    c5: await prisma.competenceArea.create({
      data: { name: "Use of AI Tools in Open Science" },
    }),
  };

function mcQuestion(competenceAreaId: string, prompt: string, choices: { label: string; correct: boolean }[]) {
  return {
    competenceAreaId,
    prompt,
    questionType: "behavioral_anchor",
    content: {
      elements: { "multiple-choice": "@pie-element/multiple-choice@latest" },
      models: [{
        id: "1",
        element: "multiple-choice",
        prompt,
        choiceMode: "radio",
        choices: choices.map((c, i) => ({ value: String(i), label: `<div>${c.label}</div>`, correct: c.correct })),
      }],
      markup: "<multiple-choice id='1'></multiple-choice>",
    },
  };
}

  await prisma.question.create({
    data: mcQuestion(areas.c1.id,
      "Which article of the UN Declaration of Human Rights does Open Science most directly support?",
      [
        { label: "Article 27.1 — the right of everyone to share in scientific advancement and its benefits", correct: true },
        { label: "Article 26.3 — parents' right to choose the kind of education their children receive", correct: false },
        { label: "Article 27.2 — protection of material interests resulting from individuals' scientific production", correct: false },
      ]),
  });

  await prisma.question.create({
    data: mcQuestion(areas.c1.id,
      "What does FAIR stand for in FAIR data?",
      [
        { label: "Findable, Accessible, Interoperable, Reusable", correct: true },
        { label: "Function, Access, Infrastructure, Rich", correct: false },
        { label: "Findable, Applicable, Interoperable, Rich", correct: false },
        { label: "Fair, Applicable, Inter-cultural, ...", correct: false },
      ]),
  });

  await prisma.question.create({
    data: mcQuestion(areas.c1.id,
      "Is data that follows the FAIR principles automatically 'open data'?",
      [
        { label: "No. FAIR data focuses on interoperability and re-usability with minimum manual work, while open data usually refers to open access.", correct: true },
        { label: "Yes; following the FAIR principles includes trying to make data as publicly available as possible.", correct: false },
        { label: "Yes; following the FAIR principles includes removing proprietary restrictions on that data.", correct: false },
        { label: "No; FAIR data is specific to privacy-sensitive data, for which open access is not appropriate.", correct: false },
      ]),
  });

  await prisma.question.create({
    data: mcQuestion(areas.c1.id,
      "Which of the following is not a key attribute of open data?",
      [
        { label: "Available", correct: false },
        { label: "Accessible", correct: false },
        { label: "Re-usable", correct: false },
        { label: "Described", correct: false },
        { label: "De-anonymized", correct: true },
      ]),
  });

  await prisma.question.create({
    data: {
      ...mcQuestion(areas.c5.id,
        "As an open science officer, how comfortable would you be evaluating whether your institute's current generative AI tool suffices, or whether to purchase another?",
        [
          { label: "Very uncomfortable making this evaluation myself", correct: false },
          { label: "Uncomfortable", correct: false },
          { label: "In the middle", correct: false },
          { label: "Comfortable", correct: false },
          { label: "Very comfortable making this evaluation myself", correct: false },
        ]),
      questionType: "self_rating",
    },
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());