import { afterEach, describe, expect, it, vi } from "vitest";

// The real package is 1.6 MB of web components. Each test imports a fresh
// loadPiePlayer (it remembers its first load) with its own stand-in package.
async function freshLoader(packageFactory: () => object) {
  vi.resetModules();
  vi.doMock("@pie-framework/pie-fixed-player-static", packageFactory);
  return (await import("./loadPiePlayer")).loadPiePlayer;
}

/** A stand-in package that, like the real one, defines <pie-fixed-player>. */
function definesPlayer() {
  if (!customElements.get("pie-fixed-player")) {
    customElements.define("pie-fixed-player", class extends HTMLElement {});
  }
  return {};
}

afterEach(() => {
  vi.doUnmock("@pie-framework/pie-fixed-player-static");
});

describe("loadPiePlayer", () => {
  it("loads the player and waits until <pie-fixed-player> is defined", async () => {
    const loadPiePlayer = await freshLoader(definesPlayer);
    await expect(loadPiePlayer()).resolves.toBeUndefined();
    expect(customElements.get("pie-fixed-player")).toBeDefined();
  });

  it("loads it only once, however many questions ask", async () => {
    const packageLoaded = vi.fn(definesPlayer);
    const loadPiePlayer = await freshLoader(packageLoaded);

    const first = loadPiePlayer();
    expect(loadPiePlayer()).toBe(first);
    await first;
    await loadPiePlayer();

    expect(packageLoaded).toHaveBeenCalledTimes(1);
  });

  it("tries again on the next call after a failed load", async () => {
    const loadPiePlayer = await freshLoader(() => {
      throw new Error("chunk failed to load");
    });

    const failed = loadPiePlayer();
    await expect(failed).rejects.toThrow();

    const retry = loadPiePlayer();
    expect(retry).not.toBe(failed);
    await expect(retry).rejects.toThrow();
  });
});
