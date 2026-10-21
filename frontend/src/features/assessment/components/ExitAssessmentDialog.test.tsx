import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExitAssessmentDialog, type ExitStatus } from "./ExitAssessmentDialog";

function renderDialog(props: { unsavedCount?: number; status?: ExitStatus; error?: string } = {}) {
  const handlers = { onKeepGoing: vi.fn(), onSaveAndExit: vi.fn(), onDiscard: vi.fn() };
  render(
    <ExitAssessmentDialog
      unsavedCount={props.unsavedCount ?? 0}
      status={props.status ?? "idle"}
      error={props.error ?? null}
      {...handlers}
    />,
  );
  return handlers;
}

describe("ExitAssessmentDialog", () => {
  it("is a labelled modal that starts on the safe choice", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "Leave the assessment?" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    // A stray Enter must never delete answers.
    expect(screen.getByRole("button", { name: "Keep going" })).toHaveFocus();
  });

  it.each([
    ["Keep going", "onKeepGoing"],
    ["Save & exit", "onSaveAndExit"],
    ["Abort and delete answers", "onDiscard"],
  ] as const)("“%s” calls %s", async (name, handler) => {
    const handlers = renderDialog();
    await userEvent.click(screen.getByRole("button", { name }));
    expect(handlers[handler]).toHaveBeenCalledTimes(1);
  });

  it.each([
    [1, "1 answer hasn't been saved yet"],
    [3, "3 answers haven't been saved yet"],
  ])("warns about %i unsaved answer(s)", (unsavedCount, text) => {
    renderDialog({ unsavedCount });
    expect(screen.getByText(new RegExp(text))).toBeInTheDocument();
  });

  it("shows an error", () => {
    renderDialog({ error: "Could not reach the server." });
    expect(screen.getByRole("alert")).toHaveTextContent("Could not reach the server.");
  });

  it.each([
    ["leaving", "Saving…"],
    ["discarding", "Deleting…"],
  ] as const)("while %s: says so and locks every button", (status, label) => {
    renderDialog({ status });
    expect(screen.getByRole("button", { name: label })).toBeDisabled();
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });

  it("Escape and a backdrop click mean keep going", () => {
    const { onKeepGoing } = renderDialog();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("presentation"));
    expect(onKeepGoing).toHaveBeenCalledTimes(2);

    // A click inside the dialog isn't a backdrop click.
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onKeepGoing).toHaveBeenCalledTimes(2);
  });

  it("can't be dismissed while a leave is in progress", () => {
    const { onKeepGoing } = renderDialog({ status: "leaving" });
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("presentation"));
    expect(onKeepGoing).not.toHaveBeenCalled();
  });

  it("keeps Tab inside the dialog, both ways", async () => {
    renderDialog();
    const [first, , last] = screen.getAllByRole("button");

    last.focus();
    await userEvent.tab();
    expect(first).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(last).toHaveFocus();

    // Focus that somehow left the dialog is pulled back in.
    document.body.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();
  });
});
