import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionLevel } from "./SectionLevel";

describe("SectionLevel", () => {
  it("shows the level as a code like A2", () => {
    render(<SectionLevel code="A" level={2} levelCount={4} />);

    expect(screen.getByText("Your skill level")).toBeInTheDocument();
    expect(screen.getByText("A2")).toBeInTheDocument();
    expect(screen.getByText("Level 2 of 4")).toBeInTheDocument();
  });

  it("fills one step per level passed", () => {
    render(<SectionLevel code="A" level={3} levelCount={4} />);

    expect(screen.getByRole("img", { name: "Level 3 of 4" })).toBeInTheDocument();
  });

  it("says when the section hasn't been assessed", () => {
    render(<SectionLevel notAssessed={{ code: "C" }} />);

    expect(screen.getByText("Not assessed yet")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("says when not even level 1 is passed yet", () => {
    render(<SectionLevel code="A" level={0} levelCount={4} />);

    expect(screen.getByText("Not yet at A1")).toBeInTheDocument();
    expect(screen.queryByText("A0")).not.toBeInTheDocument();
  });
});
