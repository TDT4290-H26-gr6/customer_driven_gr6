import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PieContent } from "../types";
import { PieQuestionPlayer } from "./PieQuestionPlayer";
import { IDK_VALUE } from "./idkSession";
import { loadPiePlayer } from "./loadPiePlayer";

// The real player is a 1.6 MB web component that jsdom can't run.
vi.mock("./loadPiePlayer", () => ({ loadPiePlayer: vi.fn() }));

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
});
