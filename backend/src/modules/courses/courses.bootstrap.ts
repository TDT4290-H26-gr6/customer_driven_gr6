import { prisma } from "../../db/prisma";

// Example third-party courses/resources for building AI & open-science
// literacy, gathered while scouting partner institutions. Idempotent
// (upserted on sourceUrl): safe to run on every boot, like roles.bootstrap.ts.
export const SEED_COURSES = [
  {
    institution: "University of Bologna (UNIBO)",
    country: "Italy",
    name: "Open Science (1) (LM)",
    type: "Formal university course",
    level: "Master's (Laurea Magistrale)",
    degreeProgramme: "Digital Humanities and Digital Knowledge",
    credits: "6 ECTS",
    language: "English",
    instructor: "Silvio Peroni",
    format: "In-person, hands-on/project-based",
    topics:
      "Introduction to Open Science, Reproducibility, FAIR and Open Data, Open Methodology, Open Peer Review, Open Source Software, Open Access, Open Metrics, Open Infrastructures",
    prerequisites: "Basic programming (Python/JavaScript) recommended",
    description: null,
    sourceUrl:
      "https://www.unibo.it/en/study/course-units-transferable-skills-moocs/course-unit-catalogue/course-unit/2025/443753",
    confidence: "Confirmed — named, credit-bearing course",
  },
  {
    institution: "University of Bologna (UNIBO)",
    country: "Italy",
    name: "Data Steward@Unibo",
    type: "Support service / training programme",
    level: "N/A (open to all researchers)",
    degreeProgramme: null,
    credits: null,
    language: null,
    instructor: null,
    format: null,
    topics: null,
    prerequisites: null,
    description:
      'Personalized guidance on Data Management Plans and producing FAIR data; includes an "Open Science Corner" recurring meeting series and library information-literacy training.',
    sourceUrl: "https://www.unibo.it/en/research/open-science",
    confidence: "Confirmed — but not a course in the traditional sense",
  },
  {
    institution: "University of Thessaly (UTH)",
    country: "Greece",
    name: "Open Access and Science",
    type: "Institutional initiative",
    level: null,
    degreeProgramme: null,
    credits: null,
    language: null,
    instructor: null,
    format: null,
    topics: null,
    prerequisites: null,
    description:
      'Programme run by the Library & Information Centre with the Research Committee (dissertation repository, publications, data repository). A separate general "Open Courses" lifelong-learning platform exists, but no open-science-specific course is confirmed in it.',
    sourceUrl: "https://www.uth.gr/en/ereyna/open-access-and-science",
    confidence: "Unconfirmed / gap — needs manual check of UTH's Open Courses catalogue",
  },
  {
    institution: "Hellenic Open University (HOU)",
    country: "Greece",
    name: "DAISSy Research Group — Open Education & MOOC Quality",
    type: "Research group / EU project involvement",
    level: null,
    degreeProgramme: null,
    credits: null,
    language: null,
    instructor: null,
    format: null,
    topics: null,
    prerequisites: null,
    description:
      "DAISSy research group at HOU participates as a partner in EU-funded projects on open education/MOOC quality (e.g. MOOQ) — not a standalone open-science course for enrolled students.",
    sourceUrl: "http://mooc-quality.eu/about/hellenic-open-university",
    confidence: "Unconfirmed / gap — needs manual check of HOU's programme catalogue",
  },
] as const;

export async function ensureSeedCourses() {
  for (const course of SEED_COURSES) {
    await prisma.course.upsert({
      where: { sourceUrl: course.sourceUrl },
      update: course,
      create: course,
    });
  }
}
