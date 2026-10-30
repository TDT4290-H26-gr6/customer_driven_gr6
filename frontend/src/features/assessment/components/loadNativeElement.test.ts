import { afterEach, describe, expect, it, vi } from "vitest";

// Each test imports a fresh loadPlacementOrdering (it remembers its first
// load) with its own stand-in package, the same pattern as loadPiePlayer's
// tests — except here the loader itself calls customElements.define, since
// (unlike pie-fixed-player-static) these packages don't self-register.
async function freshLoader(packageFactory: () => object) {
  vi.resetModules();
  vi.doMock("@pie-element/placement-ordering/delivery", packageFactory);
  return (await import("./loadNativeElement")).loadPlacementOrdering;
}

class StubOrderingElement extends HTMLElement {}
const definesOrdering = () => ({ default: StubOrderingElement });

afterEach(() => {
  vi.doUnmock("@pie-element/placement-ordering/delivery");
});

describe("loadPlacementOrdering", () => {
  it("registers the package's default export under the aios- tag", async () => {
    const loadPlacementOrdering = await freshLoader(definesOrdering);
    await expect(loadPlacementOrdering()).resolves.toBeUndefined();
    expect(customElements.get("aios-placement-ordering")).toBe(StubOrderingElement);
  });

  it("loads it only once, however many questions ask", async () => {
    const packageLoaded = vi.fn(definesOrdering);
    const loadPlacementOrdering = await freshLoader(packageLoaded);

    const first = loadPlacementOrdering();
    expect(loadPlacementOrdering()).toBe(first);
    await first;
    await loadPlacementOrdering();

    expect(packageLoaded).toHaveBeenCalledTimes(1);
  });

  it("tries again on the next call after a failed load", async () => {
    const loadPlacementOrdering = await freshLoader(() => {
      throw new Error("chunk failed to load");
    });

    const failed = loadPlacementOrdering();
    await expect(failed).rejects.toThrow();

    const retry = loadPlacementOrdering();
    expect(retry).not.toBe(failed);
    await expect(retry).rejects.toThrow();
  });

  it("doesn't re-register (and throw) when the tag is already defined", async () => {
    if (!customElements.get("aios-placement-ordering")) {
      customElements.define("aios-placement-ordering", class extends HTMLElement {});
    }
    const loadPlacementOrdering = await freshLoader(definesOrdering);
    await expect(loadPlacementOrdering()).resolves.toBeUndefined();
  });
});
