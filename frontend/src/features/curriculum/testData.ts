import type { Curriculum, QuestionSummary } from "./types";

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

export function curriculum(overrides: Partial<Curriculum> = {}): Curriculum {
  return {
    sections: [
      {
        id: "sec-a",
        code: "A",
        name: "Open data",
        modules: [
          { id: "mod-a1", name: "Licences", level: 1, mainCompetenceId: "c-lic" },
          { id: "mod-a2", name: "Repositories", level: 2, mainCompetenceId: "c-rep" },
        ],
      },
      {
        id: "sec-b",
        code: "B",
        name: "Open code",
        modules: [{ id: "mod-b1", name: "Versioning", level: 1, mainCompetenceId: "c-git" }],
      },
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
    ...overrides,
  };
}
