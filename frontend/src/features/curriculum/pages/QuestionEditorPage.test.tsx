import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCompetence,
  createQuestion,
  getCurriculum,
  getQuestion,
  previewQuestion,
  updateQuestion,
} from "../api";
import { curriculum, curriculumModule, curriculumSection, questionSummary } from "../testData";
import { QuestionEditorPage } from "./QuestionEditorPage";

vi.mock("../api", () => ({
  getCurriculum: vi.fn(),
  getQuestion: vi.fn(),
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  previewQuestion: vi.fn(),
  createCompetence: vi.fn(),
}));
// The real player is a web component jsdom can't run; this shows what it's given.
vi.mock("@/features/assessment", () => ({
  PieQuestionPlayer: ({ content }: { content: unknown }) => (
    <p data-testid="player">{JSON.stringify(content)}</p>
  ),
}));

function Overview() {
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  return <p>overview: {notice}</p>;
}

function renderEditor(path = "/admin/curriculum/questions/new") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/curriculum/questions/new" element={<QuestionEditorPage />} />
        <Route path="/admin/curriculum/questions/:id" element={<QuestionEditorPage />} />
        <Route path="/admin/curriculum" element={<Overview />} />
      </Routes>
    </MemoryRouter>,
  );
}

const select = (name: string) => screen.getByRole("combobox", { name });
const typeInto = (name: string, text: string) =>
  userEvent.type(screen.getByRole("textbox", { name }), text);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurriculum).mockResolvedValue(curriculum());
  vi.mocked(createQuestion).mockResolvedValue({ id: "q-new" });
  vi.mocked(updateQuestion).mockResolvedValue({ id: "q-1" });
});

describe("QuestionEditorPage: a new question", () => {
  it("starts as a single choice question in the first module, assessing its competence", async () => {
    renderEditor();
    expect(await screen.findByRole("heading", { name: "Add a question" })).toBeInTheDocument();
    expect(select("Section and module")).toHaveValue("mod-a1");
    expect(select("Competence it assesses")).toHaveValue("c-lic");
    expect(select("Question type")).toHaveValue("single_choice");
    expect(screen.getByText(/Exactly one is correct/)).toBeInTheDocument();
  });

  it("starts in the module the overview linked from", async () => {
    renderEditor("/admin/curriculum/questions/new?module=mod-b1");
    await screen.findByRole("heading", { name: "Add a question" });
    expect(select("Section and module")).toHaveValue("mod-b1");
    expect(select("Competence it assesses")).toHaveValue("c-git");
  });

  it("follows the module's competence, unless another was chosen on purpose", async () => {
    renderEditor();
    await screen.findByRole("heading", { name: "Add a question" });

    await userEvent.selectOptions(select("Section and module"), "mod-a2");
    expect(select("Competence it assesses")).toHaveValue("c-rep");

    await userEvent.selectOptions(select("Competence it assesses"), "c-git");
    await userEvent.selectOptions(select("Section and module"), "mod-a1");
    expect(select("Competence it assesses")).toHaveValue("c-git");
  });

  it("saves a multiple choice question and goes back to the overview", async () => {
    renderEditor();
    await screen.findByRole("heading", { name: "Add a question" });

    await userEvent.selectOptions(select("Question type"), "multi_choice");
    await typeInto("Question", "Which of these are open licences?");
    await typeInto("Option 1 text", "CC BY");
    await typeInto("Option 2 text", "CC0");
    await userEvent.click(screen.getByRole("checkbox", { name: "Option 1 is correct" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Option 2 is correct" }));
    await userEvent.click(screen.getByRole("button", { name: "Add question" }));

    expect(createQuestion).toHaveBeenCalledWith({
      questionType: "multi_choice",
      prompt: "Which of these are open licences?",
      sectionModuleId: "mod-a1",
      competenceId: "c-lic",
      content: {
        options: [
          { id: "a", text: "CC BY" },
          { id: "b", text: "CC0" },
        ],
        correctOptionIds: ["a", "b"],
      },
    });
    expect(await screen.findByText("overview: Question added.")).toBeInTheDocument();
  });

  it("builds each type's own fields: a scale, an example to judge, items in order", async () => {
    renderEditor();
    await screen.findByRole("heading", { name: "Add a question" });

    await userEvent.selectOptions(select("Question type"), "likert");
    expect(screen.getByRole("spinbutton", { name: "Scale starts at" })).toHaveValue(1);

    await userEvent.selectOptions(select("Question type"), "criteria_check");
    expect(
      screen.getByRole("textbox", { name: "The example the learner judges" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Criterion 1 text" })).toBeInTheDocument();

    await userEvent.selectOptions(select("Question type"), "ordering");
    expect(screen.getByText("Items, in the correct order")).toBeInTheDocument();
    // Ordering questions are the one type without "I don't know".
    expect(screen.queryByText(/I don't know/)).not.toBeInTheDocument();

    await userEvent.selectOptions(select("Question type"), "true_false");
    expect(screen.getByRole("textbox", { name: "Option 1 text" })).toHaveValue("True");
  });

  it("saves a criteria check with its example", async () => {
    renderEditor();
    await screen.findByRole("heading", { name: "Add a question" });
    await userEvent.selectOptions(select("Question type"), "criteria_check");
    await typeInto("Question", "Which criteria does the README meet?");
    await typeInto("The example the learner judges", "Licence: CC BY");
    await typeInto("Criterion 1 text", "States a licence");
    await typeInto("Criterion 2 text", "Gives a DOI");
    await userEvent.click(screen.getByRole("checkbox", { name: "Criterion 1 is correct" }));
    await userEvent.click(screen.getByRole("button", { name: "Add question" }));

    expect(createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        questionType: "criteria_check",
        content: {
          exhibit: "Licence: CC BY",
          options: [
            { id: "a", text: "States a licence" },
            { id: "b", text: "Gives a DOI" },
          ],
          correctOptionIds: ["a"],
        },
      }),
    );
  });

  it("shows the server's reason when a save is refused", async () => {
    vi.mocked(createQuestion).mockRejectedValue({
      status: 400,
      message: "Mark exactly one option as correct",
    });
    renderEditor();
    await screen.findByRole("heading", { name: "Add a question" });
    await typeInto("Question", "Which?");
    await userEvent.click(screen.getByRole("button", { name: "Add question" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Mark exactly one option as correct",
    );
  });

  it("shows a general error when the save fails for another reason", async () => {
    vi.mocked(createQuestion).mockRejectedValue({ status: 0, message: "offline" });
    renderEditor();
    await screen.findByRole("heading", { name: "Add a question" });
    await typeInto("Question", "Which?");
    await userEvent.click(screen.getByRole("button", { name: "Add question" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save the question");
  });

  it("previews the question as learners will see it", async () => {
    vi.mocked(previewQuestion).mockResolvedValue({ content: { built: true } as never });
    renderEditor();
    await screen.findByRole("heading", { name: "Add a question" });
    await typeInto("Question", "Which?");
    await userEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(previewQuestion).toHaveBeenCalledWith(expect.objectContaining({ prompt: "Which?" }));
    expect(await screen.findByTestId("player")).toHaveTextContent('{"built":true}');
    // Previewing, adding an option or a competence never saves the question.
    await userEvent.click(screen.getByRole("button", { name: "Add option" }));
    await userEvent.click(screen.getByRole("button", { name: "+ New competence" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(createQuestion).not.toHaveBeenCalled();

    // Any edit makes the preview out of date, so it goes.
    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    await screen.findByTestId("player");
    await typeInto("Question", "!");
    expect(screen.queryByTestId("player")).not.toBeInTheDocument();
  });

  it("explains why a preview can't be built", async () => {
    vi.mocked(previewQuestion).mockRejectedValue({ status: 400, message: "Write the question" });
    renderEditor();
    await screen.findByRole("heading", { name: "Add a question" });
    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Write the question");
  });

  it("adds a new competence on the spot and selects it", async () => {
    vi.mocked(createCompetence).mockResolvedValue({
      id: "c-new",
      name: "Data citation",
      description: null,
      questionCount: 0,
      history: { created: null, lastChange: null },
      moduleCount: 0,
    });
    renderEditor();
    await screen.findByRole("heading", { name: "Add a question" });

    await userEvent.click(screen.getByRole("button", { name: "+ New competence" }));
    await typeInto("New competence name", "Data citation");
    await userEvent.click(screen.getByRole("button", { name: "Add competence" }));

    expect(createCompetence).toHaveBeenCalledWith({ name: "Data citation", description: null });
    expect(await screen.findByRole("option", { name: "Data citation" })).toBeInTheDocument();
    expect(select("Competence it assesses")).toHaveValue("c-new");
  });

  it("reports a competence that can't be added, and can cancel", async () => {
    vi.mocked(createCompetence).mockRejectedValue({ status: 409, message: "already exists" });
    renderEditor();
    await screen.findByRole("heading", { name: "Add a question" });
    await userEvent.click(screen.getByRole("button", { name: "+ New competence" }));
    await typeInto("New competence name", "Licensing");
    await userEvent.click(screen.getByRole("button", { name: "Add competence" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: "New competence name" })).not.toBeInTheDocument();
  });
});

describe("QuestionEditorPage: an existing question", () => {
  const likert = {
    ...questionSummary({ id: "q-2", questionType: "likert", answerCount: 7 }),
    prompt: "How confident are you choosing a licence?",
    authoredContent: { scale: { min: 1, max: 5, minLabel: "Not at all", maxLabel: "Very" } },
  };

  it("loads it, keeps its type once answered, and saves the edit", async () => {
    vi.mocked(getQuestion).mockResolvedValue(likert);
    renderEditor("/admin/curriculum/questions/q-2");

    expect(await screen.findByRole("heading", { name: "Edit question" })).toBeInTheDocument();
    expect(screen.getByText(/answered this question 7 times/)).toBeInTheDocument();
    expect(select("Question type")).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Label for 1 (optional)" })).toHaveValue(
      "Not at all",
    );

    await typeInto("Question", "?");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateQuestion).toHaveBeenCalledWith(
      "q-2",
      expect.objectContaining({ prompt: "How confident are you choosing a licence??" }),
    );
    expect(await screen.findByText("overview: Changes saved.")).toBeInTheDocument();
  });

  it("says when it's removed", async () => {
    vi.mocked(getQuestion).mockResolvedValue({ ...likert, retiredAt: "2026-10-01T00:00:00.000Z" });
    renderEditor("/admin/curriculum/questions/q-2");
    expect(await screen.findByText(/This question is removed/)).toBeInTheDocument();
  });

  it("can't save a question that has no editable form yet", async () => {
    vi.mocked(getQuestion).mockResolvedValue({ ...likert, editable: false, authoredContent: null });
    renderEditor("/admin/curriculum/questions/q-2");
    expect(await screen.findByRole("alert")).toHaveTextContent("no editable form yet");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("says so when the question can't be loaded", async () => {
    vi.mocked(getQuestion).mockRejectedValue({ status: 404, message: "Unknown question" });
    renderEditor("/admin/curriculum/questions/gone");
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the question");
    expect(screen.getByRole("link", { name: "Back to the curriculum editor" })).toBeInTheDocument();
  });
});

describe("QuestionEditorPage: removed modules", () => {
  it("offers only modules in use, except the question's own", async () => {
    vi.mocked(getCurriculum).mockResolvedValue(
      curriculum({
        sections: [
          curriculumSection({
            modules: [
              curriculumModule({ id: "mod-live", name: "Live" }),
              curriculumModule({ id: "mod-gone", name: "Gone", retiredAt: "2026-10-01" }),
            ],
          }),
          curriculumSection({
            id: "sec-old",
            code: "Z",
            name: "Old section",
            retiredAt: "2026-10-01",
            modules: [curriculumModule({ id: "mod-old", name: "In old section" })],
          }),
        ],
      }),
    );
    vi.mocked(getQuestion).mockResolvedValue({
      ...questionSummary({ sectionModuleId: "mod-gone" }),
      authoredContent: {
        options: [
          { id: "a", text: "x" },
          { id: "b", text: "y" },
        ],
        correctOptionIds: ["a"],
      },
    });
    renderEditor("/admin/curriculum/questions/q-1");

    await screen.findByRole("heading", { name: "Edit question" });
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toContain("A · Live (level 1)");
    expect(options).toContain("A · Gone (level 1)");
    expect(options).not.toContain("Z · In old section (level 1)");
    // The removed section has no group at all.
    expect(screen.queryByRole("group", { name: "Z Old section" })).not.toBeInTheDocument();
  });

  it("starts a new question in the first module in use", async () => {
    vi.mocked(getCurriculum).mockResolvedValue(
      curriculum({
        sections: [
          curriculumSection({
            modules: [
              curriculumModule({ id: "mod-gone", name: "Gone", retiredAt: "2026-10-01" }),
              curriculumModule({ id: "mod-live", name: "Live", mainCompetenceId: "c-git" }),
            ],
          }),
        ],
      }),
    );
    renderEditor();
    await screen.findByRole("heading", { name: "Add a question" });
    expect(screen.getByRole("combobox", { name: "Section and module" })).toHaveValue("mod-live");
  });
});
