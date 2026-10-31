import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChangeHistory } from "./ChangeHistory";

const at = "2026-10-31T13:05:00.000Z";

describe("ChangeHistory", () => {
  it("says who added an item and who changed it last", () => {
    const { container } = render(
      <ChangeHistory
        history={{
          created: { at: "2026-10-30T09:15:00.000Z", by: "Ada Admin" },
          lastChange: { at, by: "bo@ntnu.no", action: "retired" },
        }}
      />,
    );
    // Times are local, so only the dates are checked. Retiring is "removing"
    // everywhere in the editor.
    const line = container.querySelector("p")!;
    expect(line).toHaveTextContent(
      /^Added by Ada Admin, 30 Oct 2026, \d\d:\d\d · Removed by bo@ntnu.no, 31 Oct 2026, \d\d:\d\d$/,
    );
    expect(line.querySelectorAll("time")[1]).toHaveAttribute("dateTime", at);
  });

  it("shows only the latest change for an item loaded from the dataset", () => {
    render(
      <ChangeHistory
        history={{ created: null, lastChange: { at, by: "Ada", action: "restored" } }}
      />,
    );
    expect(screen.getByText(/Restored by Ada/)).not.toHaveTextContent("Added");
  });

  it("shows nothing for an item nobody has changed", () => {
    const { container } = render(<ChangeHistory history={{ created: null, lastChange: null }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
