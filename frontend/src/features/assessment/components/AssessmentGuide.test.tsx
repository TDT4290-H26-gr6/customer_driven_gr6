import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GuideStep } from "../assessmentGuide";
import { AssessmentGuide } from "./AssessmentGuide";

const STEPS: GuideStep[] = [
  { target: null, title: "Welcome", body: "Intro text", rules: ["Rule one", "Rule two"] },
  { target: "next", title: "Moving on", body: "Press Next" },
  { target: "help", title: "Need this again?", body: "Press ?" },
];

function renderGuide({ withTargets = true } = {}) {
  const onClose = vi.fn();
  render(
    <>
      {withTargets && (
        <>
          <button data-guide="next">Next question</button>
          <button data-guide="help">?</button>
        </>
      )}
      <AssessmentGuide steps={STEPS} onClose={onClose} />
    </>,
  );
  return { onClose };
}

const dialog = () => screen.getByRole("dialog");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AssessmentGuide", () => {
  it("starts with a centred welcome card listing the rules", () => {
    renderGuide();
    expect(dialog()).toHaveAccessibleName("Welcome");
    expect(dialog()).toHaveAccessibleDescription("Intro text");
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Rule one",
      "Rule two",
    ]);
    expect(screen.queryByTestId("guide-spotlight")).not.toBeInTheDocument();
    // Nothing to go back to on the first step.
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
  });

  it("starts on Next, so Enter moves forward", () => {
    renderGuide();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
  });

  it("highlights each step's control, and steps back and forth", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 100,
      left: 200,
      width: 80,
      height: 40,
      bottom: 140,
      right: 280,
      x: 200,
      y: 100,
      toJSON: () => ({}),
    });
    renderGuide();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(dialog()).toHaveAccessibleName("Moving on");
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    // The spotlight surrounds the target with a little padding.
    expect(screen.getByTestId("guide-spotlight")).toHaveStyle({
      top: "92px",
      left: "192px",
      width: "96px",
      height: "56px",
    });

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(dialog()).toHaveAccessibleName("Welcome");
  });

  it("shows a step as a centred card when its control isn't on the page", async () => {
    renderGuide({ withTargets: false });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(dialog()).toHaveAccessibleName("Moving on");
    expect(screen.queryByTestId("guide-spotlight")).not.toBeInTheDocument();
  });

  it("finishes on the last step", async () => {
    const { onClose } = renderGuide();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    // No Skip on the last step: finishing is the only way forward.
    expect(screen.queryByRole("button", { name: "Skip guide" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start answering" }));
    expect(onClose).toHaveBeenCalledWith("done");
  });

  it("can be skipped with the Skip button or Escape", async () => {
    const { onClose } = renderGuide();
    await userEvent.click(screen.getByRole("button", { name: "Skip guide" }));
    expect(onClose).toHaveBeenCalledWith("skipped");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps Tab inside the box", async () => {
    renderGuide();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    const [skip, , next] = [
      screen.getByRole("button", { name: "Skip guide" }),
      screen.getByRole("button", { name: "Previous" }),
      screen.getByRole("button", { name: "Next" }),
    ];

    next.focus();
    await userEvent.tab();
    expect(skip).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(next).toHaveFocus();
  });
});
