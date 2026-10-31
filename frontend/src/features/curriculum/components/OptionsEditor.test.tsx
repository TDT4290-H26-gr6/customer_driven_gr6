import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Option } from "../types";
import { OptionsEditor } from "./OptionsEditor";

/** The editor with its own state, reporting every change. */
function Harness(props: {
  mode: "single" | "multi" | "order";
  options: Option[];
  correct?: string[];
  fixed?: boolean;
  onChange?: (options: Option[], correct: string[]) => void;
}) {
  const [options, setOptions] = useState(props.options);
  const [correct, setCorrect] = useState(props.correct ?? []);
  return (
    <OptionsEditor
      options={options}
      correctIds={correct}
      mode={props.mode}
      fixed={props.fixed}
      onChange={(o, c) => {
        setOptions(o);
        setCorrect(c);
        props.onChange?.(o, c);
      }}
    />
  );
}

const two = [
  { id: "a", text: "One" },
  { id: "b", text: "Two" },
];
const texts = () =>
  screen.getAllByRole("textbox").map((input) => (input as HTMLInputElement).value);

describe("OptionsEditor", () => {
  it("edits the text, keeping each option's id", async () => {
    const onChange = vi.fn();
    render(<Harness mode="multi" options={two} onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Option 1 text" }), "!");
    expect(onChange).toHaveBeenLastCalledWith(
      [
        { id: "a", text: "One!" },
        { id: "b", text: "Two" },
      ],
      [],
    );
  });

  it("single: exactly one correct answer", async () => {
    const onChange = vi.fn();
    render(<Harness mode="single" options={two} correct={["a"]} onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "Option 1 is correct" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Option 2 is correct" }));
    expect(onChange).toHaveBeenLastCalledWith(two, ["b"]);
  });

  it("multi: ticks and unticks any number", async () => {
    const onChange = vi.fn();
    render(<Harness mode="multi" options={two} correct={["a"]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Option 2 is correct" }));
    expect(onChange).toHaveBeenLastCalledWith(two, ["a", "b"]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Option 1 is correct" }));
    expect(onChange).toHaveBeenLastCalledWith(two, ["b"]);
  });

  it("adds, moves and removes options; removing a correct one unmarks it", async () => {
    render(<Harness mode="multi" options={two} correct={["b"]} />);

    await userEvent.click(screen.getByRole("button", { name: "Add option" }));
    expect(texts()).toEqual(["One", "Two", ""]);

    await userEvent.click(screen.getByRole("button", { name: "Move option 2 up" }));
    expect(texts()).toEqual(["Two", "One", ""]);
    await userEvent.click(screen.getByRole("button", { name: "Move option 1 down" }));
    expect(texts()).toEqual(["One", "Two", ""]);

    await userEvent.click(screen.getByRole("button", { name: "Remove option 2" }));
    expect(texts()).toEqual(["One", ""]);
    expect(screen.queryAllByRole("checkbox", { checked: true })).toHaveLength(0);
  });

  it("keeps at least two options, and at most twelve", async () => {
    render(<Harness mode="multi" options={two} />);
    expect(screen.getByRole("button", { name: "Remove option 1" })).toBeDisabled();
    const add = screen.getByRole("button", { name: "Add option" });
    for (let i = 0; i < 10; i++) await userEvent.click(add);
    expect(add).toBeDisabled();
  });

  it("order: numbered positions, no correct marks", () => {
    render(<Harness mode="order" options={two} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByText(/correct/)).not.toBeInTheDocument();
  });

  it("fixed (true/false): only which one is correct can change", () => {
    render(<Harness mode="single" options={two} correct={["a"]} fixed />);
    expect(screen.getByRole("textbox", { name: "Option 1 text" })).toHaveAttribute("readonly");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
