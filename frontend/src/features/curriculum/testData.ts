import type { Curriculum, CurriculumModule, CurriculumSection, QuestionSummary } from "./types";

// Shared by the curriculum page tests.

export function questionSummary(overrides: Partial<QuestionSummary> = {}): QuestionSummary {
  return {
    id: "q-1",
    prompt: "Which licence lets anyone reuse data?",
    questionType: "single_choice",
    sectionModuleId: "mod-a1",
    competenceId: "c-lic",
    retiredAt: null,
    answerCount: 0,
    editable: true,
    ...overrides,
  };
}

export function curriculumModule(overrides: Partial<CurriculumModule> = {}): CurriculumModule {
  return {
    id: "mod-a1",
    name: "Licences",
    description: null,
    level: 1,
    mainCompetenceId: "c-lic",
    secondaryCompetenceIds: [],
    moodleUrl: null,
    retiredAt: null,
    questionCount: 0,
    ...overrides,
  };
}

export function curriculumSection(overrides: Partial<CurriculumSection> = {}): CurriculumSection {
  return {
    id: "sec-a",
    code: "A",
    name: "Open data",
    description: null,
    retiredAt: null,
    journeyCount: 0,
    usedInAssessments: false,
    modules: [],
    ...overrides,
  };
}

export function curriculum(overrides: Partial<Curriculum> = {}): Curriculum {
  return {
    sections: [
      curriculumSection({
        description: "Finding, sharing and reusing data",
        journeyCount: 2,
        modules: [
          curriculumModule({
            moodleUrl: "https://moodle.example.org/course/view.php?id=1",
            secondaryCompetenceIds: ["c-rep"],
            questionCount: 2,
          }),
          curriculumModule({
            id: "mod-a2",
            name: "Repositories",
            level: 2,
            mainCompetenceId: "c-rep",
          }),
        ],
      }),
      curriculumSection({
        id: "sec-b",
        code: "B",
        name: "Open code",
        modules: [
          curriculumModule({
            id: "mod-b1",
            name: "Versioning",
            mainCompetenceId: "c-git",
            questionCount: 1,
          }),
        ],
      }),
    ],
    competences: [
      {
        id: "c-lic",
        name: "Licensing",
        description: "Open licences",
        questionCount: 2,
        moduleCount: 1,
      },
      { id: "c-rep", name: "Repositories", description: null, questionCount: 0, moduleCount: 1 },
      { id: "c-git", name: "Version control", description: null, questionCount: 1, moduleCount: 1 },
    ],
    questions: [
      questionSummary(),
      questionSummary({
        id: "q-2",
        prompt: "How confident are you choosing a licence?",
        questionType: "likert",
        answerCount: 7,
      }),
      questionSummary({
        id: "q-3",
        prompt: "Git keeps every version of a file.",
        questionType: "true_false",
        sectionModuleId: "mod-b1",
        competenceId: "c-git",
        retiredAt: "2026-10-01T00:00:00.000Z",
        answerCount: 3,
      }),
    ],
    journeys: [
      {
        id: "lj-1",
        name: "Data steward",
        description: "For research data work",
        moodleUrl: "https://moodle.example.org/course/view.php?id=3",
        retiredAt: null,
        sections: [
          { sectionId: "sec-a", coverageLevel: "M" },
          { sectionId: "sec-b", coverageLevel: "S" },
        ],
        steps: [
          { id: "step-1", title: "Plan your data", description: null, sourceId: "src-1" },
          { id: "step-2", title: "Share it", description: "In a repository", sourceId: null },
        ],
        used: true,
      },
      {
        id: "lj-2",
        name: "Open code",
        description: null,
        moodleUrl: null,
        retiredAt: null,
        sections: [{ sectionId: "sec-b", coverageLevel: "M" }],
        steps: [],
        used: false,
      },
    ],
    sources: [{ id: "src-1", courseName: "FAIR basics", institution: "NTNU" }],
    ...overrides,
  };
}
