import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AssessmentProgress } from "./AssessmentProgress";

describe("AssessmentProgress", () => {
  it("shows the current/total count as text", () => {
    render(<AssessmentProgress current={3} total={10} />);
    expect(screen.getByText("3 / 10")).toBeInTheDocument();
  });

  it("shows a custom label instead of the count when given one", () => {
    render(<AssessmentProgress current={1} total={5} label="Section 2 of 5" />);
    expect(screen.getByText("Section 2 of 5")).toBeInTheDocument();
    expect(screen.queryByText("1 / 5")).not.toBeInTheDocument();
  });

  it("computes the progress percentage for the progressbar", () => {
    render(<AssessmentProgress current={3} total={10} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "30");
  });

  it("rounds a non-exact percentage", () => {
    render(<AssessmentProgress current={1} total={3} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
  });

  it("doesn't divide by zero when total is 0", () => {
    render(<AssessmentProgress current={0} total={0} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("reaches 100% on the last question", () => {
    render(<AssessmentProgress current={10} total={10} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});
