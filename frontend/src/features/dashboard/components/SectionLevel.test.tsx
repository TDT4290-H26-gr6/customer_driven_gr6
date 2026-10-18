import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionLevel } from "./SectionLevel";

describe("SectionLevel", () => {
  it("shows the level passed, explains what it measures, and doesn't use a letter code", () => {
    render(<SectionLevel level={2} levelCount={4} />);

    expect(screen.getByText("Your skill level")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Level 2 of 4 passed")).toBeInTheDocument();
    expect(screen.getByText(/two-thirds correct/i)).toBeInTheDocument();
    expect(screen.queryByText(/^[A-Z]\d/)).not.toBeInTheDocument();
  });

  it("fills one step per level passed", () => {
    render(<SectionLevel level={3} levelCount={4} />);

    expect(screen.getByRole("img", { name: "Level 3 of 4" })).toBeInTheDocument();
  });

  it("says when the section hasn't been assessed", () => {
    render(<SectionLevel notAssessed />);

    expect(screen.getByText("Not assessed yet")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("says when not even level 1 is passed yet", () => {
    render(<SectionLevel level={0} levelCount={4} />);

    expect(screen.getByText("Level 1 not yet passed")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
