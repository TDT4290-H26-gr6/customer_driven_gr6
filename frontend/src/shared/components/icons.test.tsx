import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as icons from "./icons";
import { Logo } from "./Logo";

describe("icons", () => {
  it.each(Object.entries(icons))("%s draws an SVG that takes the caller's props", (_name, Icon) => {
    const { container } = render(<Icon aria-hidden="true" width={32} className="x" />);
    const svg = container.querySelector("svg")!;

    expect(svg).toHaveAttribute("width", "32");
    expect(svg).toHaveAttribute("class", "x");
    // Drawn in the text color, so icons follow the theme.
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg.childElementCount).toBeGreaterThan(0);
  });
});

describe("Logo", () => {
  it("is a labelled image screen readers can announce", () => {
    const { getByRole } = render(<Logo />);
    expect(getByRole("img", { name: /AIOS/ })).toBeInTheDocument();
  });

  it("adds the caller's class to its own", () => {
    const { getByRole } = render(<Logo className="big" />);
    expect(getByRole("img").getAttribute("class")).toMatch(/\bbig\b/);
  });
});
