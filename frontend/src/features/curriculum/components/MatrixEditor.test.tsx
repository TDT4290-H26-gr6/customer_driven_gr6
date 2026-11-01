import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { MatrixRow, Option, QuestionType } from "../types";
import { MatrixEditor } from "./MatrixEditor";

/** The editor with its own state, reporting every change. */
function Harness(props: {
  questionType: QuestionType;
  columns: Option[];
  rows: MatrixRow[];
  onChange?: (columns: Option[], rows: MatrixRow[]) => void;
}) {
  const [columns, setColumns] = useState(props.columns);
  const [rows, setRows] = useState(props.rows);
  return (
    <MatrixEditor
      questionType={props.questionType}
      columns={columns}
      rows={rows}
      onChange={(c, r) => {
        setColumns(c);
        setRows(r);
        props.onChange?.(c, r);
      }}
    />
  );
}

const categories = [
  { id: "a", text: "Good practice" },
  { id: "b", text: "Poor practice" },
];
const rows = [
  { id: "a", text: "Maintain a README", correctColumnId: "a" },
  { id: "b", text: "Skip the README", correctColumnId: "" },
];

describe("MatrixEditor", () => {
  it("edits the categories and gives each item its right one", async () => {
    const onChange = vi.fn();
    render(
      <Harness
        questionType="classification_matrix"
        columns={categories}
        rows={rows}
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText("Category 1 text")).toHaveValue("Good practice");
    const answer = screen.getByRole("combobox", { name: "Item 2: right answer" });
    expect(
      within(answer)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Right answer…", "Good practice", "Poor practice"]);

    await userEvent.selectOptions(answer, "Poor practice");
    expect(onChange).toHaveBeenLastCalledWith(categories, [
      rows[0],
      { ...rows[1], correctColumnId: "b" },
    ]);
  });

  it("clears an item's answer when its category is removed", async () => {
    const onChange = vi.fn();
    render(
      <Harness
        questionType="matching"
        columns={[...categories, { id: "c", text: "Neither" }]}
        rows={rows}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove answer 1" }));
    const [, nextRows] = onChange.mock.lastCall!;
    expect(nextRows[0]).toEqual({ ...rows[0], correctColumnId: "" });
  });

  it("adds, moves and removes items, keeping at least two", async () => {
    const onChange = vi.fn();
    render(
      <Harness questionType="matching" columns={categories} rows={rows} onChange={onChange} />,
    );
    expect(screen.getByRole("button", { name: "Remove item 1" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Add item" }));
    await userEvent.type(screen.getByLabelText("Item 3 text"), "Record provenance");
    await userEvent.click(screen.getByRole("button", { name: "Move item 3 up" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove item 1" }));

    const [, nextRows] = onChange.mock.lastCall!;
    expect(nextRows.map((r: MatrixRow) => r.text)).toEqual([
      "Record provenance",
      "Skip the README",
    ]);
    expect(nextRows[0]).toMatchObject({
      id: expect.stringMatching(/^[a-z0-9]{8}$/),
      correctColumnId: "",
    });
  });

  it("gives a true/false matrix fixed True and False answers, new statements with none chosen yet", async () => {
    const onChange = vi.fn();
    render(
      <Harness
        questionType="true_false_matrix"
        columns={[]}
        rows={[
          { id: "a", text: "A DOI is persistent.", correctColumnId: "true" },
          { id: "b", text: "Every repository takes everything.", correctColumnId: "false" },
        ]}
        onChange={onChange}
      />,
    );
    expect(screen.queryByText(/the table's columns/)).not.toBeInTheDocument();
    const answer = screen.getByRole("combobox", { name: "Statement 2: right answer" });
    expect(answer).toHaveDisplayValue("False");

    await userEvent.click(screen.getByRole("button", { name: "Add statement" }));
    // Not True by default: a false statement whose select was forgotten
    // would otherwise go live with the wrong answer.
    expect(onChange.mock.lastCall![1][2]).toEqual({
      id: expect.stringMatching(/^[a-z0-9]{8}$/),
      text: "",
      correctColumnId: "",
    });
  });

  it("names an answer without text by its number", () => {
    render(
      <Harness
        questionType="matching"
        columns={[
          { id: "a", text: "" },
          { id: "b", text: "Two" },
        ]}
        rows={rows}
      />,
    );
    const answer = screen.getByRole("combobox", { name: "Item 1: right answer" });
    expect(within(answer).getByRole("option", { name: "Answer 1" })).toBeInTheDocument();
  });
});
