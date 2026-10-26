import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentRunnerPage } from "./AssessmentRunnerPage";
import {
  completeAssessment,
  discardAssessment,
  getAssessmentPath,
  recordQuestionView,
  saveResponse,
} from "../api";
import { completeInitialAssessment } from "@/features/auth";
import type { AssessmentPath, PathItem, Question } from "../types";

vi.mock("../api", () => ({
  getAssessmentPath: vi.fn(),
  saveResponse: vi.fn(),
  recordQuestionView: vi.fn(),
  completeAssessment: vi.fn(),
  discardAssessment: vi.fn(),
}));

vi.mock("@/features/auth", () => ({
  completeInitialAssessment: vi.fn(),
}));

const markInitialAssessmentComplete = vi.fn();
vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ markInitialAssessmentComplete }),
}));

const navigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

// Retries are covered in retry.test.ts; here one try keeps the tests instant.
vi.mock("@/shared/api/retry", () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
}));

// The real card renders the PIE widget; this stand-in shows which question
// is up, whether it has an answer, and answers it on click.
vi.mock("../components/QuestionCard", () => ({
  QuestionCard: ({
    question,
    answer,
    onAnswerChange,
  }: {
    question: Question;
    answer?: { complete: boolean };
    onAnswerChange: (answer: { session: unknown; complete: boolean }) => void;
  }) => (
    <div>
      <p>{question.prompt}</p>
      {answer?.complete && <p>answered</p>}
      <button onClick={() => onAnswerChange({ session: {}, complete: true })}>Answer</button>
    </div>
  ),
}));

const done = { session: {}, complete: true };

function item(
  id: string,
  { answered = false, code = "A", level = 1, sectionNumber = 1 } = {},
): PathItem {
  return {
    question: {
      id,
      prompt: `Question ${id}`,
      questionType: "single_choice",
      competence: { id: "c1", name: "Competence" },
      content: { elements: {}, models: [], markup: "" },
    },
    answer: answered ? done : null,
    section: { code, name: `Section ${code}` },
    sectionNumber,
    level,
  };
}

function path(
  items: PathItem[],
  isDone = false,
  sectionCount = 2,
  journey: AssessmentPath["journey"] = null,
): AssessmentPath {
  return { items, sectionCount, done: isDone, journey };
}

const networkError = { status: 0, message: "offline" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(saveResponse).mockResolvedValue(undefined);
  vi.mocked(recordQuestionView).mockResolvedValue(undefined);
  vi.mocked(completeAssessment).mockResolvedValue(undefined);
  vi.mocked(discardAssessment).mockResolvedValue(undefined);
  vi.mocked(completeInitialAssessment).mockResolvedValue({} as never);
});

describe("AssessmentRunnerPage question views (CD-125)", () => {
  it("records that the first question was shown, before anything is answered", async () => {
    vi.mocked(getAssessmentPath).mockResolvedValue(path([item("1")]));

    render(<AssessmentRunnerPage />);
    await screen.findByText("Question 1");

    await waitFor(() => expect(recordQuestionView).toHaveBeenCalledWith("1"));
    expect(recordQuestionView).toHaveBeenCalledTimes(1);
    expect(saveResponse).not.toHaveBeenCalled();
  });

  it("records the next question once it appears, and not the one already answered", async () => {
    vi.mocked(getAssessmentPath)
      .mockResolvedValueOnce(path([item("1")]))
      .mockResolvedValueOnce(path([item("1", { answered: true }), item("2")]));
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Answer" }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText("Question 2");

    await waitFor(() => expect(recordQuestionView).toHaveBeenCalledWith("2"));
    expect(vi.mocked(recordQuestionView).mock.calls.map(([id]) => id)).toEqual(["1", "2"]);
  });

  it("does not record questions that were answered before (resume, Back)", async () => {
    vi.mocked(getAssessmentPath).mockResolvedValue(
      path([item("1", { answered: true }), item("2", { answered: true })], true),
    );

    render(<AssessmentRunnerPage />);
    await screen.findByText("Question 2");

    expect(recordQuestionView).not.toHaveBeenCalled();
  });

  it("carries on when recording a view fails", async () => {
    vi.mocked(recordQuestionView).mockRejectedValue(networkError);
    vi.mocked(getAssessmentPath).mockResolvedValue(path([item("1")]));

    render(<AssessmentRunnerPage />);

    expect(await screen.findByText("Question 1")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("AssessmentRunnerPage", () => {
  it("offers a retry when the assessment fails to load", async () => {
    vi.mocked(getAssessmentPath)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue(path([item("1")]));
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the assessment");
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Question 1")).toBeInTheDocument();
  });

  it("shows how far through the sections the learner is, but not which section or level", async () => {
    vi.mocked(getAssessmentPath).mockResolvedValue(
      path([item("1", { code: "C", level: 2, sectionNumber: 3 })], false, 5),
    );

    render(<AssessmentRunnerPage />);

    expect(await screen.findByText("Section 3 of 5")).toBeInTheDocument();
    expect(screen.queryByText("C2")).not.toBeInTheDocument();
    expect(screen.queryByText("Section C")).not.toBeInTheDocument();
  });

  it("resumes at the next question, after the ones already answered", async () => {
    vi.mocked(getAssessmentPath).mockResolvedValue(
      path([item("1", { answered: true }), item("2", { answered: true }), item("3")]),
    );

    render(<AssessmentRunnerPage />);

    expect(await screen.findByText("Question 3")).toBeInTheDocument();
  });

  it("Next saves the answer, asks for the path again and moves to the question it adds", async () => {
    vi.mocked(getAssessmentPath)
      .mockResolvedValueOnce(path([item("1")]))
      // A1 passed early: the backend skips ahead to A2.
      .mockResolvedValueOnce(path([item("1", { answered: true }), item("A2-q", { level: 2 })]));
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Answer" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Question A2-q")).toBeInTheDocument();
    expect(saveResponse).toHaveBeenCalledWith("1", done, expect.any(Number));
    expect(getAssessmentPath).toHaveBeenCalledTimes(2);
  });

  it("finishes and goes to the dashboard when the path ends", async () => {
    vi.mocked(getAssessmentPath)
      .mockResolvedValueOnce(path([item("1")]))
      .mockResolvedValueOnce(path([item("1", { answered: true })], true));
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Answer" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/", { replace: true }));
    expect(completeAssessment).toHaveBeenCalledOnce();
    expect(markInitialAssessmentComplete).toHaveBeenCalledOnce();
  });

  it("doesn't save an answer the player re-emits while finishing, so it can't start a new attempt", async () => {
    vi.mocked(getAssessmentPath)
      .mockResolvedValueOnce(path([item("1")]))
      .mockResolvedValueOnce(path([item("1", { answered: true })], true));
    let completeNow!: () => void;
    vi.mocked(completeAssessment).mockReturnValueOnce(
      new Promise<void>((resolve) => (completeNow = resolve)),
    );
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Answer" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("button", { name: "Finishing…" });
    // The PIE player firing session-changed again mid-finish.
    await user.click(screen.getByRole("button", { name: "Answer" }));
    completeNow();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/", { replace: true }));
    expect(saveResponse).toHaveBeenCalledOnce();
  });

  it("finishes a journey assessment on Competencies, without completing the self-assessment", async () => {
    const lj2 = { id: "journey-2", name: "LJ2 — Research Data" };
    vi.mocked(getAssessmentPath)
      .mockResolvedValueOnce(path([item("1")], false, 2, lj2))
      .mockResolvedValueOnce(path([item("1", { answered: true })], true, 2, lj2));
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Answer" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/competencies", { replace: true }));
    expect(completeAssessment).toHaveBeenCalledOnce();
    expect(completeInitialAssessment).not.toHaveBeenCalled();
    expect(markInitialAssessmentComplete).not.toHaveBeenCalled();
  });

  it("says which journey is being assessed, and that it doesn't change the self-assessment", async () => {
    vi.mocked(getAssessmentPath).mockResolvedValue(
      path([item("1")], false, 2, {
        id: "journey-2",
        name: "LJ2 — Research Data",
      }),
    );

    render(<AssessmentRunnerPage />);

    expect(await screen.findByText("LJ2 — Research Data")).toBeInTheDocument();
    expect(screen.getByText(/doesn't change your self-assessment/i)).toBeInTheDocument();
  });

  it("shows no journey banner during the self-assessment", async () => {
    vi.mocked(getAssessmentPath).mockResolvedValue(path([item("1")]));

    render(<AssessmentRunnerPage />);

    await screen.findByText("Question 1");
    expect(screen.queryByText(/assessing the journey/i)).not.toBeInTheDocument();
  });

  it("labels the button Finish when resuming a path that's already complete", async () => {
    vi.mocked(getAssessmentPath).mockResolvedValue(path([item("1", { answered: true })], true));

    render(<AssessmentRunnerPage />);

    expect(await screen.findByRole("button", { name: "Finish" })).toBeEnabled();
  });

  it("Back shows the previous question with its saved answer", async () => {
    vi.mocked(getAssessmentPath).mockResolvedValue(
      path([item("1", { answered: true }), item("2")]),
    );
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Back" }));

    expect(screen.getByText("Question 1")).toBeInTheDocument();
    expect(screen.getByText("answered")).toBeInTheDocument();
  });

  it("after changing an earlier answer, Next goes on to the question already shown after it", async () => {
    const shown = path([item("1", { answered: true }), item("2", { answered: true }), item("3")]);
    // Answered questions stay put whatever the change, so the path keeps them.
    vi.mocked(getAssessmentPath).mockResolvedValue(shown);
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Question 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Answer" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Question 2")).toBeInTheDocument();
    expect(saveResponse).toHaveBeenCalledWith("1", done, expect.any(Number));
  });

  it("refuses to move on while an answer is unsaved, until the save is retried", async () => {
    vi.mocked(getAssessmentPath)
      .mockResolvedValueOnce(path([item("1")]))
      .mockResolvedValueOnce(path([item("1", { answered: true }), item("2")]));
    vi.mocked(saveResponse).mockRejectedValueOnce(networkError);
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Answer" }));
    expect(await screen.findByText(/1 answer hasn't been saved/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText(/haven't been saved yet/i)).toBeInTheDocument();
    expect(getAssessmentPath).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: /retry saving/i }));
    await waitFor(() => expect(screen.queryByText(/hasn't been saved/i)).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Question 2")).toBeInTheDocument();
  });

  it("stays on the page with an error when completing the assessment fails", async () => {
    vi.mocked(getAssessmentPath).mockResolvedValue(path([item("1", { answered: true })], true));
    vi.mocked(completeAssessment).mockRejectedValueOnce(networkError);
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Finish" }));

    expect(await screen.findByText(/couldn't finish the assessment/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled();
  });

  it("reloads the path instead of retrying when a save is rejected with 404", async () => {
    vi.mocked(getAssessmentPath)
      .mockResolvedValueOnce(path([item("1")]))
      .mockResolvedValueOnce(path([item("2")])); // an admin hid question 1 from the role
    vi.mocked(saveResponse).mockRejectedValueOnce({
      status: 404,
      message: "Unknown question",
    });
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Answer" }));

    expect(await screen.findByText(/no longer available for your role/i)).toBeInTheDocument();
    expect(screen.getByText("Question 2")).toBeInTheDocument();
    expect(screen.queryByText(/hasn't been saved/i)).not.toBeInTheDocument();
    expect(saveResponse).toHaveBeenCalledOnce();
  });

  it("says so when there's nothing to ask", async () => {
    vi.mocked(getAssessmentPath).mockResolvedValue(path([], true, 0));

    render(<AssessmentRunnerPage />);

    expect(await screen.findByText(/no questions are available/i)).toBeInTheDocument();
  });
});

describe("AssessmentRunnerPage exit dialog", () => {
  it("Keep going closes the dialog and stays on the question", async () => {
    vi.mocked(getAssessmentPath).mockResolvedValue(path([item("1")]));
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Exit" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep going" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Question 1")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(discardAssessment).not.toHaveBeenCalled();
  });

  it("Save & exit leaves without deleting anything", async () => {
    vi.mocked(getAssessmentPath).mockResolvedValue(path([item("1")]));
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Answer" }));
    await user.click(screen.getByRole("button", { name: "Exit" }));
    await user.click(screen.getByRole("button", { name: "Save & exit" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/", { replace: true }));
    expect(saveResponse).toHaveBeenCalledOnce();
    expect(discardAssessment).not.toHaveBeenCalled();
  });

  it("Save & exit retries unsaved answers and stays if they still fail", async () => {
    vi.mocked(getAssessmentPath).mockResolvedValue(path([item("1")]));
    vi.mocked(saveResponse).mockRejectedValue(networkError);
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Answer" }));
    await screen.findByText(/1 answer hasn't been saved/i);
    await user.click(screen.getByRole("button", { name: "Exit" }));
    await user.click(screen.getByRole("button", { name: "Save & exit" }));

    expect(await screen.findByText(/still couldn't be saved/i)).toBeInTheDocument();
    expect(saveResponse).toHaveBeenCalledTimes(2);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("Abort waits for a save still in flight before deleting, so it can't recreate the attempt", async () => {
    vi.mocked(getAssessmentPath).mockResolvedValue(path([item("1")]));
    let finishSave!: () => void;
    vi.mocked(saveResponse).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSave = resolve;
      }),
    );
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Answer" }));
    await user.click(screen.getByRole("button", { name: "Exit" }));
    await user.click(screen.getByRole("button", { name: /abort/i }));

    expect(discardAssessment).not.toHaveBeenCalled();

    finishSave();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/", { replace: true }));
    expect(discardAssessment).toHaveBeenCalledOnce();
  });

  it("stays with an error when aborting fails", async () => {
    vi.mocked(getAssessmentPath).mockResolvedValue(path([item("1")]));
    vi.mocked(discardAssessment).mockRejectedValueOnce(networkError);
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Exit" }));
    await user.click(screen.getByRole("button", { name: /abort/i }));

    expect(await screen.findByText(/couldn't abort the assessment/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /abort/i })).toBeEnabled();
  });
});
