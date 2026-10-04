import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionLevel } from "./SectionLevel";
import type { SkillLevel } from "../types";

function skill(level: number): SkillLevel {
  return { section: { id: "sec-a", code: "A", name: "Knife Skills" }, level, levelCount: 4 };
}

describe("SectionLevel", () => {
  it("shows the level as a code like A2", () => {
    render(<SectionLevel skill={skill(2)} />);

    expect(screen.getByText("Your skill level")).toBeInTheDocument();
    expect(screen.getByText("A2")).toBeInTheDocument();
    expect(screen.getByText("Level 2 of 4")).toBeInTheDocument();
  });

  it("fills one step per level passed", () => {
    render(<SectionLevel skill={skill(3)} />);

    expect(screen.getByRole("img", { name: "Level 3 of 4" })).toBeInTheDocument();
  });

  it("says when the section hasn't been assessed yet", () => {
    render(<SectionLevel notAssessed={{ code: "C" }} />);

    expect(screen.getByText("Not assessed yet")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("says when not even level 1 is passed yet", () => {
    render(<SectionLevel skill={skill(0)} />);

    expect(screen.getByText("Not yet at A1")).toBeInTheDocument();
    expect(screen.queryByText("A0")).not.toBeInTheDocument();
  });
});
