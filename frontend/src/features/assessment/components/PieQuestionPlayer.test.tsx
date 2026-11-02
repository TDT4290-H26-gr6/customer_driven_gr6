import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NativeElementContent, PieContent } from "../types";
import { PieQuestionPlayer } from "./PieQuestionPlayer";
import { IDK_VALUE } from "./idkSession";
import {
  buildMatchModel,
  buildPlacementOrderingModel,
  loadMatch,
  loadPlacementOrdering,
} from "./loadNativeElement";
import { loadPiePlayer } from "./loadPiePlayer";

// The real players are web components (placement-ordering's own React tree
// included) that jsdom can't run.
vi.mock("./loadPiePlayer", () => ({ loadPiePlayer: vi.fn() }));
vi.mock("./loadNativeElement", () => ({
  loadPlacementOrdering: vi.fn(),
  buildPlacementOrderingModel: vi.fn(),
  buildMatchModel: vi.fn(),
  loadMatch: vi.fn(),
}));

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
    vi.mocked(loadMatch).mockReset();
    vi.mocked(buildPlacementOrderingModel).mockReset();
    // Passes the matrix model through unless a test says otherwise.
    vi.mocked(buildMatchModel)
      .mockReset()
      .mockImplementation(async (model) => model);
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

    // What placement-ordering's controller builds out of the stored model.
    const builtModel = { choices: [{ id: "a", label: "First" }], completeLength: 1 };

    it("routes to the element named in content.element instead of <pie-fixed-player>, setting .model not .config", async () => {
      let finishLoading!: () => void;
      vi.mocked(loadPlacementOrdering).mockReturnValue(
        new Promise<void>((r) => (finishLoading = r)),
      );
      vi.mocked(buildPlacementOrderingModel).mockResolvedValue(builtModel);

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
      await vi.waitFor(() => expect(element.model).toBe(builtModel));
      expect(buildPlacementOrderingModel).toHaveBeenCalledWith(nativeContent.model);
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

    it("starts a matrix question from an empty session, which it needs to draw anything", async () => {
      vi.mocked(loadMatch).mockResolvedValue();
      const matrix = {
        element: "aios-match",
        model: { id: "1", rows: [] },
      } as NativeElementContent;
      const { container } = render(<PieQuestionPlayer content={matrix} />);
      const element = container.querySelector("aios-match") as HTMLElement & {
        model?: unknown;
        session?: unknown;
      };
      await vi.waitFor(() => expect(element.model).toBe(matrix.model));
      expect(element.session).toEqual({ id: "1", element: "aios-match" });
      expect(loadPlacementOrdering).not.toHaveBeenCalled();
    });

    it("gives a matrix the model built for it, with wrappable headers", async () => {
      vi.mocked(loadMatch).mockResolvedValue();
      const built = { id: "1", headers: ["", "a/<wbr>b"] };
      vi.mocked(buildMatchModel).mockResolvedValue(built);
      const matrix = {
        element: "aios-match",
        model: { id: "1", headers: ["", "a/b"] },
      } as NativeElementContent;
      const { container } = render(<PieQuestionPlayer content={matrix} />);
      const element = container.querySelector("aios-match") as HTMLElement & { model?: unknown };
      await vi.waitFor(() => expect(element.model).toBe(built));
      expect(buildMatchModel).toHaveBeenCalledWith(matrix.model);
    });

    it("restores a matrix question's saved answer instead", async () => {
      vi.mocked(loadMatch).mockResolvedValue();
      const matrix = { element: "aios-match", model: { id: "1" } } as NativeElementContent;
      const saved = { id: "1", answers: { r1: [true, false, false] } };
      const { container } = render(
        <PieQuestionPlayer content={matrix} answer={{ session: saved, complete: true }} />,
      );
      const element = container.querySelector("aios-match") as HTMLElement & { session?: unknown };
      await vi.waitFor(() => expect(element.session).toBe(saved));
    });

    it("starts an unanswered ordering question from an empty session, from its controller's model", async () => {
      vi.mocked(loadPlacementOrdering).mockResolvedValue();
      vi.mocked(buildPlacementOrderingModel).mockResolvedValue(builtModel);
      const { container } = render(<PieQuestionPlayer content={nativeContent} />);
      const element = nativeElement(container);
      await vi.waitFor(() => expect(element.model).toBe(builtModel));
      expect(element.session).toEqual({ id: "1", element: "aios-placement-ordering" });
    });

    describe("an ordering answer", () => {
      const ordering = {
        element: "aios-placement-ordering",
        model: { id: "1", choices: [{ id: "b" }, { id: "a" }], correctResponse: ["a", "b"] },
      } as NativeElementContent;

      function reportedFor(value: string[]) {
        vi.mocked(loadPlacementOrdering).mockReturnValue(new Promise(() => {}));
        const onAnswerChange = vi.fn();
        const { container } = render(
          <PieQuestionPlayer content={ordering} onAnswerChange={onAnswerChange} />,
        );
        const element = nativeElement(container);
        element.session = { id: "1", element: "aios-placement-ordering", value };
        element.dispatchEvent(new CustomEvent("session-changed", { detail: { complete: true } }));
        return onAnswerChange.mock.calls[0][0];
      }

      it("isn't complete while the items are still in the order they started in", () => {
        expect(reportedFor(["b", "a"])).toMatchObject({ complete: false });
      });

      it("is complete once the learner has moved one", () => {
        expect(reportedFor(["a", "b"])).toEqual({
          session: { id: "1", element: "aios-placement-ordering", value: ["a", "b"] },
          complete: true,
        });
      });

      it("stays complete when the learner moves an item back to where it started", () => {
        vi.mocked(loadPlacementOrdering).mockReturnValue(new Promise(() => {}));
        const onAnswerChange = vi.fn();
        const { container } = render(
          <PieQuestionPlayer content={ordering} onAnswerChange={onAnswerChange} />,
        );
        const element = nativeElement(container);
        const report = (value: string[]) => {
          element.session = { id: "1", element: "aios-placement-ordering", value };
          element.dispatchEvent(new CustomEvent("session-changed", { detail: { complete: true } }));
        };

        report(["b", "a"]); // shown: not an answer yet
        report(["a", "b"]); // moved
        report(["b", "a"]); // moved back: saved too, so the server has what's on screen

        expect(onAnswerChange.mock.calls.map(([a]) => a.complete)).toEqual([false, true, true]);
        expect(onAnswerChange.mock.lastCall![0].session).toMatchObject({ value: ["b", "a"] });
      });

      it("counts a saved answer in the starting order, which the learner chose", () => {
        vi.mocked(loadPlacementOrdering).mockReturnValue(new Promise(() => {}));
        const onAnswerChange = vi.fn();
        const saved = { id: "1", element: "aios-placement-ordering", value: ["b", "a"] };
        const { container } = render(
          <PieQuestionPlayer
            content={ordering}
            answer={{ session: saved, complete: true }}
            onAnswerChange={onAnswerChange}
          />,
        );
        const element = nativeElement(container);
        element.session = saved;
        element.dispatchEvent(new CustomEvent("session-changed", { detail: { complete: true } }));
        expect(onAnswerChange).toHaveBeenLastCalledWith({ session: saved, complete: true });
      });

      it("says how to answer under the items", () => {
        vi.mocked(loadPlacementOrdering).mockReturnValue(new Promise(() => {}));
        const { getByText } = render(<PieQuestionPlayer content={ordering} />);
        expect(getByText("Drag the items into the right order.")).toBeTruthy();
      });
    });

    it("says nothing extra under a matrix question", () => {
      vi.mocked(loadMatch).mockReturnValue(new Promise(() => {}));
      const matrix = { element: "aios-match", model: { id: "1" } } as NativeElementContent;
      const { queryByText } = render(<PieQuestionPlayer content={matrix} />);
      expect(queryByText("Drag the items into the right order.")).toBeNull();
    });

    it("leaves an ordering question empty when its controller fails", async () => {
      vi.mocked(loadPlacementOrdering).mockResolvedValue();
      vi.mocked(buildPlacementOrderingModel).mockRejectedValue(new Error("offline"));
      const { container } = render(<PieQuestionPlayer content={nativeContent} />);
      const element = nativeElement(container);
      await vi.waitFor(() => expect(buildPlacementOrderingModel).toHaveBeenCalled());
      await Promise.resolve();
      expect(element.model).toBeUndefined();
      expect(element.session).toBeUndefined();
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
