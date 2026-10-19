import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Question } from "../types";
import { QuestionCard } from "./QuestionCard";

// The PIE player is a web component jsdom can't run; this records what it's given.
vi.mock("./PieQuestionPlayer", () => ({
  PieQuestionPlayer: ({ content, answer }: { content: unknown; answer?: unknown }) => (
    <p data-testid="player">{JSON.stringify({ content, answer })}</p>
  ),
}));

it("shows the competence being assessed and hands the item and answer to the player", () => {
  const question = {
    id: "q1",
    competence: { name: "FAIR data" },
    content: { id: "item-1" },
  } as unknown as Question;
  const answer = { session: { value: ["a"] }, complete: true };

  render(<QuestionCard question={question} answer={answer} onAnswerChange={vi.fn()} />);

  expect(screen.getByText("FAIR data")).toBeInTheDocument();
  expect(JSON.parse(screen.getByTestId("player").textContent!)).toEqual({
    content: { id: "item-1" },
    answer,
  });
});
