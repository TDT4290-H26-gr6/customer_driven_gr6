import { PrismaClient } from "@prisma/client";
import { DEFAULT_ROLES } from "../src/modules/identity/roles.bootstrap";
const prisma = new PrismaClient();

async function main() {
  await prisma.role.createMany({
    data: DEFAULT_ROLES.map((name) => ({ name })),
    skipDuplicates: true,
  });

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

  function mcQuestion(
    competenceAreaId: string,
    prompt: string,
    choices: { label: string; correct: boolean }[],
    choiceMode: "radio" | "checkbox" = "radio",
  ) {
    return {
      competenceAreaId,
      prompt,
      questionType: "behavioral_anchor",
      content: {
        elements: { "multiple-choice": "@pie-element/multiple-choice@latest" },
        models: [
          {
            id: "1",
            element: "multiple-choice",
            prompt,
            choiceMode,
            choices: choices.map((c, i) => ({
              value: String(i),
              label: `<div>${c.label}</div>`,
              correct: c.correct,
            })),
          },
        ],
        markup: "<multiple-choice id='1'></multiple-choice>",
      },
    };
  }

  await prisma.question.create({
    data: mcQuestion(
      areas.c1.id,
      "Which article of the UN Declaration of Human Rights does Open Science most directly support?",
      [
        {
          label:
            "Article 27.1 — the right of everyone to share in scientific advancement and its benefits",
          correct: true,
        },
        {
          label:
            "Article 26.3 — parents' right to choose the kind of education their children receive",
          correct: false,
        },
        {
          label:
            "Article 27.2 — protection of material interests resulting from individuals' scientific production",
          correct: false,
        },
      ],
    ),
  });

  await prisma.question.create({
    data: mcQuestion(areas.c1.id, "What does FAIR stand for in FAIR data?", [
      { label: "Findable, Accessible, Interoperable, Reusable", correct: true },
      { label: "Function, Access, Infrastructure, Rich", correct: false },
      { label: "Findable, Applicable, Interoperable, Rich", correct: false },
      { label: "Fair, Applicable, Inter-cultural, ...", correct: false },
    ]),
  });

  await prisma.question.create({
    data: mcQuestion(
      areas.c1.id,
      "Is data that follows the FAIR principles automatically 'open data'?",
      [
        {
          label:
            "No. FAIR data focuses on interoperability and re-usability with minimum manual work, while open data usually refers to open access.",
          correct: true,
        },
        {
          label:
            "Yes; following the FAIR principles includes trying to make data as publicly available as possible.",
          correct: false,
        },
        {
          label:
            "Yes; following the FAIR principles includes removing proprietary restrictions on that data.",
          correct: false,
        },
        {
          label:
            "No; FAIR data is specific to privacy-sensitive data, for which open access is not appropriate.",
          correct: false,
        },
      ],
    ),
  });

  await prisma.question.create({
    data: mcQuestion(areas.c1.id, "Which of the following is not a key attribute of open data?", [
      { label: "Available", correct: false },
      { label: "Accessible", correct: false },
      { label: "Re-usable", correct: false },
      { label: "Described", correct: false },
      { label: "De-anonymized", correct: true },
    ]),
  });

  await prisma.question.create({
    data: {
      ...mcQuestion(
        areas.c5.id,
        "As an open science officer, how comfortable would you be evaluating whether your institute's current generative AI tool suffices, or whether to purchase another?",
        [
          { label: "Very uncomfortable making this evaluation myself", correct: false },
          { label: "Uncomfortable", correct: false },
          { label: "In the middle", correct: false },
          { label: "Comfortable", correct: false },
          { label: "Very comfortable making this evaluation myself", correct: false },
        ],
      ),
      questionType: "self_rating",
    },
  });

  // Drag-and-drop example, using @pie-element/drag-in-the-blank (bundled in
  // pie-fixed-player-static — see docs/demo/generate.js in the pie-elements
  // repo for the config shape this is based on). `rows[].text` becomes a table
  // row with a `{{i}}` blank; `rows[].term` becomes the draggable choice that
  // belongs in that blank.
  function dragQuestion(
    competenceAreaId: string,
    prompt: string,
    rows: { text: string; term: string }[],
  ) {
    const choices = rows.map((r, i) => ({ id: String(i), value: r.term }));
    const correctResponse = Object.fromEntries(rows.map((_, i) => [i, String(i)]));
    const tableRows = rows
      .map((r, i) => `<tr><td><p>${r.text}</p></td><td><p>{{${i}}}</p></td></tr>`)
      .join("\n");

    return {
      competenceAreaId,
      prompt,
      questionType: "drag_and_drop",
      content: {
        elements: { "drag-in-the-blank": "@pie-element/drag-in-the-blank@latest" },
        models: [
          {
            id: "1",
            element: "drag-in-the-blank",
            prompt: `<p>${prompt}</p>`,
            choicesPosition: "below",
            lockChoiceOrder: true,
            partialScoring: true,
            // How many blanks must be filled to count as answered — the
            // widget's own isComplete() compares against this and there's no
            // way to derive it automatically from the markup, so it must be
            // set explicitly or the item can never report complete.
            responseAreasToBeFilled: rows.length,
            duplicates: false,
            feedback: {},
            mode: "gather",
            choices,
            markup:
              `<table class="table table-bordered">\n<tbody>\n` +
              `<tr><td><strong>Description</strong></td><td><strong>Term</strong></td></tr>\n${tableRows}\n` +
              `</tbody>\n</table>`,
            correctResponse,
          },
        ],
        markup: "<drag-in-the-blank id='1'></drag-in-the-blank>",
      },
    };
  }

  await prisma.question.create({
    data: dragQuestion(areas.c1.id, "Drag each term into the box next to its correct definition.", [
      {
        text: "Findable, Accessible, Interoperable, and Reusable — guiding principles for research data.",
        term: "FAIR",
      },
      { text: "Data anyone can access, use, and share without restriction.", term: "Open Data" },
      {
        text: "Independently repeating a study and getting the same results.",
        term: "Reproducibility",
      },
    ]),
  });


  await prisma.question.create({
    data: mcQuestion(
      areas.c4.id,
      "Which law is least likely to be relevant in decisions to make data openly accessible? Assuming that the law is relevant in your jurisdiction.",
      [
        { label: "GDPR", correct: true },
        { label: "AI Act", correct: false },
        { label: "EU Cyber Resilience Act", correct: false },
      ],
    ),
  });

  await prisma.question.create({
    data: mcQuestion(
      areas.c4.id,
      "Which practices display legality more than ethical adequacy?",
      [
        {
          label:
            "A company mines data from its users because they have consented to this in the terms and conditions of a particular product.",
          correct: true,
        },
        {
          label:
            "A company operates across the US and the EU. It has patented a real-time surveillance mechanism in casinos that monitors facial expressions and can accurately predict organized fraud. It suppresses the roll-out of this mechanism in the EU, where the EU AI Act makes it illegal.",
          correct: true,
        },
        {
          label:
            "A company employs \"ethical hackers\" to perform penetration testing of new software. The hackers' scope and behavior is governed by codes of conduct.",
          correct: false,
        },
        { label: "None of the above", correct: false },
      ],
      "checkbox",
    ),
  });

  await prisma.question.create({
    data: mcQuestion(
      areas.c4.id,
      "What are key elements of the EU Data Governance Act?",
      [
        {
          label: "Focus on protection of non-personal data, as the GDPR covers personal data.",
          correct: false,
        },
        {
          label: "Provide rules and safeguards to facilitate re-use of data held by the public sector",
          correct: true,
        },
        {
          label: "Allow public sector bodies to charge fees for allowing the reuse of their data",
          correct: true,
        },
        { label: "Prevent the monetization of publicly held data", correct: false },
      ],
      "checkbox",
    ),
  });

  await prisma.question.create({
    data: mcQuestion(
      areas.c4.id,
      "What does the Data Governance Act say about data altruism?",
      [
        {
          label:
            "Data altruism is built into the collection of data from the public, with an opt-out approach",
          correct: false,
        },
        { label: "Consent or permission can be granted by individuals", correct: true },
        { label: "Consent or permission can be granted by companies", correct: true },
        {
          label: "Consent or permission should be given voluntarily and without reward",
          correct: true,
        },
        {
          label:
            "A lack of data-sharing tools is more of a barrier than a lack of willingness among the public",
          correct: true,
        },
        { label: "Data intermediaries should be avoided.", correct: false },
      ],
      "checkbox",
    ),
  });

  await prisma.question.create({
    data: mcQuestion(
      areas.c4.id,
      "What are identified obstacles to data-sharing in the EU?",
      [
        { label: "Low trust in data-sharing", correct: true },
        { label: "Technical and infrastructure", correct: true },
        { label: "Uncertainty about what type of public data can be collected", correct: true },
        {
          label: "No cross-sectoral instrument to regulate publicly held data",
          correct: false,
        },
      ],
      "checkbox",
    ),
  });

  await prisma.question.create({
    data: mcQuestion(
      areas.c4.id,
      "The main difference between the Open Data Directive and the Data Governance Act is:",
      [
        {
          label:
            "The Open Data Directive regulates the reuse of publicly available information held by the public sector, while the Data Governance Act regulates the use of protected data held by the public sector.",
          correct: true,
        },
        {
          label:
            "The Open Data Directive regulates the reuse of protected data held by the public sector, while the Data Governance Act regulates the sharing of publicly available data held by the public sector.",
          correct: false,
        },
        {
          label:
            "The Open Data Directive requires certain types of data to be shared, while the Data Governance Act creates the legal infrastructure for these types of data to be safely shared.",
          correct: false,
        },
        {
          label:
            "Neither address personal data, but the Open Data Directive focuses on companies that process public data, while the Data Governance Act focuses on the public sector.",
          correct: false,
        },
      ],
    ),
  });

  await prisma.question.create({
    data: {
      ...mcQuestion(
        areas.c4.id,
        "How comfortable are you describing how intellectual property rights and ancillary rights are both enablers and blockers to legal openness?",
        [
          { label: "Very uncomfortable describing this", correct: false },
          { label: "Uncomfortable", correct: false },
          { label: "In the middle", correct: false },
          { label: "Comfortable", correct: false },
          { label: "Very comfortable describing this", correct: false },
        ],
      ),
      questionType: "self_rating",
    },
  });

  await prisma.question.create({
    data: mcQuestion(
      areas.c4.id,
      "Which of the following characterize privacy and data protection as rights in the EU?",
      [
        { label: "They are fundamental rights", correct: true },
        { label: "They are automatic", correct: true },
        { label: "They are non-waivable", correct: true },
        { label: "They are non-transferrable", correct: true },
        { label: "None of the above", correct: false },
      ],
      "checkbox",
    ),
  });

  await prisma.question.create({
    data: mcQuestion(
      areas.c4.id,
      "Which are examples of upstream practices, rather than downstream practices?",
      [
        { label: "Getting rights to data before disseminating it", correct: true },
        { label: "Transfer of intellectual property rights", correct: true },
        { label: "Moral rights policies", correct: true },
        { label: "Model licenses", correct: false },
      ],
      "checkbox",
    ),
  });

  await prisma.question.create({
    data: mcQuestion(
      areas.c4.id,
      "Which are examples of downstream practices, rather than upstream practices?",
      [
        { label: "Model licenses such as the CC family", correct: true },
        { label: "Constraining data usage", correct: true },
        { label: "Focusing on data output", correct: true },
        { label: "Transfer of contributor rights", correct: false },
      ],
      "checkbox",
    ),
  });

  await prisma.question.create({
    data: {
      ...mcQuestion(
        areas.c4.id,
        "How comfortable would you be to defend your organization's use of APIs in a discussion about intellectual property rights claims and a license dispute?",
        [
          { label: "Very uncomfortable", correct: false },
          { label: "Uncomfortable", correct: false },
          { label: "In the middle", correct: false },
          { label: "Comfortable", correct: false },
          { label: "Very comfortable", correct: false },
        ],
      ),
      questionType: "self_rating",
    },
  });

  await prisma.question.create({
    data: mcQuestion(
      areas.c4.id,
      "Which of the following is/are true?",
      [
        { label: "APIs are more conducive to establishing data-sharing ecosystems", correct: true },
        { label: "APIs still depend on intellectual property rights", correct: false },
        { label: "APIs are not under the scope of the Open Data Directive", correct: false },
        { label: "APIs are subject to common constraints on data retention", correct: true },
      ],
      "checkbox",
    ),
  });

  await prisma.question.create({
    data: mcQuestion(areas.c4.id, "Which main issue was Creative Commons developed to address?", [
      { label: "The lack of a standard open license", correct: true },
      { label: "The lack of a machine-readable license", correct: false },
      {
        label: "Unclear intellectual property rights of content shared on the internet",
        correct: false,
      },
      { label: "Lack of consensus among national intellectual property experts", correct: false },
    ]),
  });

  await prisma.question.create({
    data: mcQuestion(
      areas.c4.id,
      "Which types of creative commons licenses exist?",
      [
        { label: "Commercial use allowed", correct: true },
        { label: "Commercial use not allowed", correct: true },
        { label: "Derivative works allowed", correct: true },
        { label: "Downstream use behind paywall", correct: false },
        { label: "Downstream as upstream", correct: true },
      ],
      "checkbox",
    ),
  });

  await prisma.question.create({
    data: mcQuestion(areas.c4.id, "What does licensing have to do with open data?", [
      { label: "Data which is shared with a license becomes open data.", correct: true },
      { label: "Licensing is a way to indicate ownership over data.", correct: false },
      {
        label: "Licensing prevents data from being publicly shared, but allows for private agreements.",
        correct: false,
      },
    ]),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
