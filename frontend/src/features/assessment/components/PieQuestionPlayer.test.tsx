import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PieContent } from "../types";
import { PieQuestionPlayer } from "./PieQuestionPlayer";
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
});
