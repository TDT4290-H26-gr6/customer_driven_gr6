import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { AuthoredContent } from "../types";
import { LikertEditor } from "./LikertEditor";

type Scale = NonNullable<AuthoredContent["scale"]>;

let latest: Scale | undefined;
function Harness({ initial }: { initial: Scale }) {
  const [scale, setScale] = useState(initial);
  return (
    <LikertEditor
      scale={scale}
      onChange={(next) => {
        latest = next;
        setScale(next);
      }}
    />
  );
}

describe("LikertEditor", () => {
  it("labels the two ends by default", async () => {
    render(<Harness initial={{ min: 1, max: 5, minLabel: "", maxLabel: "" }} />);
    expect(screen.getByRole("radio", { name: "Label the two ends" })).toBeChecked();
    await userEvent.type(screen.getByRole("textbox", { name: "Label for 1 (optional)" }), "Low");
    await userEvent.type(screen.getByRole("textbox", { name: "Label for 5 (optional)" }), "High");
    expect(latest).toEqual({ min: 1, max: 5, minLabel: "Low", maxLabel: "High" });
  });

  it("changes where the scale starts and ends", () => {
    render(<Harness initial={{ min: 1, max: 5 }} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Scale starts at" }), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Scale ends at" }), {
      target: { value: "10" },
    });
    expect(latest).toMatchObject({ min: 0, max: 10 });
  });

  it("labels every step, and keeps the labels in line with the scale", async () => {
    render(<Harness initial={{ min: 1, max: 3 }} />);
    await userEvent.click(screen.getByRole("radio", { name: "Label every step" }));
    expect(screen.getAllByRole("textbox")).toHaveLength(3);

    await userEvent.type(screen.getByRole("textbox", { name: "Label for 2" }), "Sometimes");
    expect(latest).toEqual({ min: 1, max: 3, labels: ["", "Sometimes", ""] });

    fireEvent.change(screen.getByRole("spinbutton", { name: "Scale ends at" }), {
      target: { value: "4" },
    });
    expect(latest).toEqual({ min: 1, max: 4, labels: ["", "Sometimes", "", ""] });

    await userEvent.click(screen.getByRole("radio", { name: "Label the two ends" }));
    expect(latest).toEqual({ min: 1, max: 4, minLabel: "", maxLabel: "" });
  });
});
