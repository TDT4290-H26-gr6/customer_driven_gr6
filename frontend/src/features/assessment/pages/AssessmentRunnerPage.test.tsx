import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentRunnerPage } from "./AssessmentRunnerPage";
import {
  completeAssessment,
  discardAssessment,
  getProgress,
  getQuestions,
  saveResponse,
} from "../api";
import { completeInitialAssessment } from "@/features/auth";
import type { Question } from "../types";

vi.mock("../api", () => ({
  getQuestions: vi.fn(),
  getProgress: vi.fn(),
  saveResponse: vi.fn(),
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
// is up and answers it on click.
vi.mock("../components/QuestionCard", () => ({
  QuestionCard: ({
    question,
    onAnswerChange,
  }: {
    question: Question;
    onAnswerChange: (answer: { session: unknown; complete: boolean }) => void;
  }) => (
    <div>
      <p>{question.prompt}</p>
      <button onClick={() => onAnswerChange({ session: {}, complete: true })}>Answer</button>
    </div>
  ),
}));

function question(id: string): Question {
  return {
    id,
    prompt: `Question ${id}`,
    questionType: "likert",
    competence: { id: "c1", name: "Competence" },
    content: { elements: {}, models: [], markup: "" },
  };
}

const networkError = { status: 0, message: "offline" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getProgress).mockResolvedValue(null);
  vi.mocked(saveResponse).mockResolvedValue(undefined);
  vi.mocked(completeAssessment).mockResolvedValue(undefined);
  vi.mocked(discardAssessment).mockResolvedValue(undefined);
  vi.mocked(completeInitialAssessment).mockResolvedValue({} as never);
});

describe("AssessmentRunnerPage", () => {
  it("offers a retry when the assessment fails to load, instead of 'no questions'", async () => {
    vi.mocked(getQuestions)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue([question("1")]);
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the assessment");
    expect(screen.queryByText(/no questions are available/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Question 1")).toBeInTheDocument();
  });

  it("finishes and goes to the dashboard when every save succeeded", async () => {
    vi.mocked(getQuestions).mockResolvedValue([question("1")]);
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Answer" }));
    await user.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/", { replace: true }));
    expect(saveResponse).toHaveBeenCalledWith("1", { session: {}, complete: true });
    expect(completeAssessment).toHaveBeenCalledOnce();
    expect(markInitialAssessmentComplete).toHaveBeenCalledOnce();
  });

  it("shows an unsaved-answer banner and refuses to finish until the save is retried", async () => {
    vi.mocked(getQuestions).mockResolvedValue([question("1")]);
    vi.mocked(saveResponse).mockRejectedValueOnce(networkError);
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Answer" }));

    expect(await screen.findByText(/1 answer hasn't been saved/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(await screen.findByText(/some answers haven't been saved yet/i)).toBeInTheDocument();
    expect(completeAssessment).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /retry saving/i }));

    await waitFor(() => expect(screen.queryByText(/hasn't been saved/i)).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/", { replace: true }));
  });

  it("stays on the page with an error when completing the assessment fails", async () => {
    vi.mocked(getQuestions).mockResolvedValue([question("1")]);
    vi.mocked(completeAssessment).mockRejectedValueOnce(networkError);
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Answer" }));
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(await screen.findByText(/couldn't finish the assessment/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled();
  });

  it("reloads the questions instead of retrying when a save is rejected with 404", async () => {
    vi.mocked(getQuestions)
      .mockResolvedValueOnce([question("1"), question("2")])
      .mockResolvedValueOnce([question("2")]); // an admin revoked question 1's section
    vi.mocked(saveResponse).mockRejectedValueOnce({ status: 404, message: "Unknown question" });
    const user = userEvent.setup();

    render(<AssessmentRunnerPage />);
    await user.click(await screen.findByRole("button", { name: "Answer" }));

    expect(await screen.findByText(/no longer available for your role/i)).toBeInTheDocument();
    expect(screen.getByText("Question 2")).toBeInTheDocument();
    expect(screen.queryByText(/hasn't been saved/i)).not.toBeInTheDocument();
    expect(saveResponse).toHaveBeenCalledOnce();
  });
});

describe("AssessmentRunnerPage exit dialog", () => {
  it("Keep going closes the dialog and stays on the question", async () => {
    vi.mocked(getQuestions).mockResolvedValue([question("1")]);
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
    vi.mocked(getQuestions).mockResolvedValue([question("1"), question("2")]);
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
    vi.mocked(getQuestions).mockResolvedValue([question("1"), question("2")]);
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
    vi.mocked(getQuestions).mockResolvedValue([question("1"), question("2")]);
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
    vi.mocked(getQuestions).mockResolvedValue([question("1")]);
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
