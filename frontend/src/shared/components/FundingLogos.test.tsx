import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FundingLogos } from "./FundingLogos";

describe("FundingLogos", () => {
  it("shows both funders' logos with alt text", () => {
    render(<FundingLogos />);
    expect(
      screen.getByRole("img", { name: /Co-funded by the European Union/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /IKY/ })).toBeInTheDocument();
  });

  it("names the Erasmus+ project in the EU logo's label", () => {
    render(<FundingLogos />);
    expect(
      screen.getByRole("img", { name: /Erasmus\+ KA220-HED 2025-1-EL01-KA220-HED-000359135/ }),
    ).toBeInTheDocument();
  });

  it("adds the caller's class to its own", () => {
    const { container } = render(<FundingLogos className="extra" />);
    expect(container.firstElementChild?.getAttribute("class")).toMatch(/\bextra\b/);
  });
});
