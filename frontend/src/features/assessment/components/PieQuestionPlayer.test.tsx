import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NativeElementContent, PieContent } from "../types";
import { PieQuestionPlayer } from "./PieQuestionPlayer";
import { IDK_VALUE } from "./idkSession";
import { loadPlacementOrdering } from "./loadNativeElement";
import { loadPiePlayer } from "./loadPiePlayer";

// The real players are web components (placement-ordering's own React tree
// included) that jsdom can't run.
vi.mock("./loadPiePlayer", () => ({ loadPiePlayer: vi.fn() }));
vi.mock("./loadNativeElement", () => ({ loadPlacementOrdering: vi.fn() }));

const content = { id: "q1" } as unknown as PieContent;

function playerElement(container: HTMLElement) {
  return container.querySelector("pie-fixed-player") as HTMLElement & {
    config?: unknown;
    session?: unknown;
  };
}

describe("PieQuestionPlayer", () => {
  beforeEach(() => {
    vi.mocked(loadPiePlayer).mockReset();
    vi.mocked(loadPlacementOrdering).mockReset();
  });

  it("hands the item and saved answer to the player only once it has loaded", async () => {
    let finishLoading!: () => void;
    vi.mocked(loadPiePlayer).mockReturnValue(new Promise<void>((r) => (finishLoading = r)));

    const { container } = render(
      <PieQuestionPlayer content={content} answer={{ session: { id: "s" }, complete: true }} />,
    );
    const player = playerElement(container);
    expect(player.config).toBeUndefined();

    finishLoading();
    await vi.waitFor(() => expect(player.config).toBe(content));
    expect(player.session).toEqual({ id: "s" });
  });

  it("still renders, empty, when the player fails to load", async () => {
    vi.mocked(loadPiePlayer).mockRejectedValue(new Error("offline"));
    const { container } = render(<PieQuestionPlayer content={content} />);
    await Promise.resolve();
    expect(playerElement(container).config).toBeUndefined();
  });

  describe("answers", () => {
    /** Ticks choices the way the player does: sets .session, then fires session-changed. */
    function answer(player: HTMLElement & { session?: unknown }, value: string[], complete = true) {
      player.session = { id: "s", data: [{ id: "1", value }] };
      player.dispatchEvent(new CustomEvent("session-changed", { detail: { complete } }));
    }

    it("reports each change with the player's own session and completeness", () => {
      vi.mocked(loadPiePlayer).mockReturnValue(new Promise(() => {}));
      const onAnswerChange = vi.fn();
      const { container } = render(
        <PieQuestionPlayer content={content} onAnswerChange={onAnswerChange} />,
      );

      answer(playerElement(container), ["a"], false);

      expect(onAnswerChange).toHaveBeenCalledWith({
        session: { id: "s", data: [{ id: "1", value: ["a"] }] },
        complete: false,
      });
    });

    it("unticks the other choices when I don't know is ticked", () => {
      vi.mocked(loadPiePlayer).mockReturnValue(new Promise(() => {}));
      const onAnswerChange = vi.fn();
      const { container } = render(
        <PieQuestionPlayer content={content} onAnswerChange={onAnswerChange} />,
      );
      const player = playerElement(container);

      answer(player, ["a", IDK_VALUE]);

      const idkOnly = { id: "s", data: [{ id: "1", value: [IDK_VALUE] }] };
      expect(player.session).toEqual(idkOnly);
      expect(onAnswerChange).toHaveBeenCalledWith({ session: idkOnly, complete: true });
    });

    it("blocks clicks on other checkboxes while I don't know is ticked", () => {
      vi.mocked(loadPiePlayer).mockReturnValue(new Promise(() => {}));
      const { container } = render(<PieQuestionPlayer content={content} />);
      const canvas = container.firstElementChild as HTMLElement;
      canvas.innerHTML = `
        <label><input type="checkbox" value="a" /> A</label>
        <label><input type="checkbox" value="${IDK_VALUE}" /> I don't know</label>`;
      const [other, idk] = canvas.querySelectorAll("input");

      // Not ticked yet: other choices can be clicked.
      expect(fireEvent.click(other)).toBe(true);

      idk.checked = true;
      // fireEvent.click returns false when the click was cancelled.
      expect(fireEvent.click(other)).toBe(false);
      // The I don't know box itself can still be unticked.
      expect(fireEvent.click(idk)).toBe(true);
    });
  });

  describe("native elements (e.g. ordering)", () => {
    const nativeContent = {
      element: "aios-placement-ordering",
      model: { id: "1", choices: [{ id: "a", label: "First" }] },
    } as NativeElementContent;

    function nativeElement(container: HTMLElement) {
      return container.querySelector("aios-placement-ordering") as HTMLElement & {
        model?: unknown;
        session?: unknown;
      };
    }

    it("routes to the element named in content.element instead of <pie-fixed-player>, setting .model not .config", async () => {
      let finishLoading!: () => void;
      vi.mocked(loadPlacementOrdering).mockReturnValue(new Promise<void>((r) => (finishLoading = r)));

      const { container } = render(
        <PieQuestionPlayer
          content={nativeContent}
          answer={{ session: { value: ["a"] }, complete: true }}
        />,
      );
      expect(container.querySelector("pie-fixed-player")).toBeNull();
      const element = nativeElement(container);
      expect(element.model).toBeUndefined();

      finishLoading();
      await vi.waitFor(() => expect(element.model).toBe(nativeContent.model));
      expect(element.session).toEqual({ value: ["a"] });
      expect(loadPiePlayer).not.toHaveBeenCalled();
    });

    it("reports the element's own session on session-changed, same as the fixed player", () => {
      vi.mocked(loadPlacementOrdering).mockReturnValue(new Promise(() => {}));
      const onAnswerChange = vi.fn();
      const { container } = render(
        <PieQuestionPlayer content={nativeContent} onAnswerChange={onAnswerChange} />,
      );
      const element = nativeElement(container);

      element.session = { id: "s", element: "aios-placement-ordering", value: ["a", null] };
      element.dispatchEvent(new CustomEvent("session-changed", { detail: { complete: false } }));

      expect(onAnswerChange).toHaveBeenCalledWith({
        session: { id: "s", element: "aios-placement-ordering", value: ["a", null] },
        complete: false,
      });
    });

    it("still renders, empty, when a native element has no registered loader", async () => {
      const unknownContent = { element: "aios-not-registered", model: {} } as NativeElementContent;
      const { container } = render(<PieQuestionPlayer content={unknownContent} />);
      await Promise.resolve();

      expect(loadPlacementOrdering).not.toHaveBeenCalled();
      expect(container.querySelector("aios-not-registered")).not.toBeNull();
    });
  });
});
