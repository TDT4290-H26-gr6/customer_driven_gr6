import { afterEach, describe, expect, it, vi } from "vitest";

// Each test imports a fresh loadPlacementOrdering (it remembers its first
// load) with its own stand-in package, the same pattern as loadPiePlayer's
// tests, except here the loader itself calls customElements.define, since
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

describe("loadMatch", () => {
  afterEach(() => {
    vi.doUnmock("@pie-element/match/delivery");
  });

  it("registers @pie-element/match under its own aios- tag", async () => {
    class StubMatchElement extends HTMLElement {}
    vi.resetModules();
    vi.doMock("@pie-element/match/delivery", () => ({ default: StubMatchElement }));
    const { loadMatch } = await import("./loadNativeElement");
    await expect(loadMatch()).resolves.toBeUndefined();
    expect(customElements.get("aios-match")).toBe(StubMatchElement);
  });
});

describe("buildPlacementOrderingModel", () => {
  afterEach(() => {
    vi.doUnmock("@pie-element/placement-ordering/controller");
  });

  it("builds the element's model with the package's own controller, for a learner answering", async () => {
    const built = { choices: [], config: { orientation: "vertical" } };
    const model = vi.fn().mockResolvedValue(built);
    vi.resetModules();
    vi.doMock("@pie-element/placement-ordering/controller", () => ({ model }));
    const { buildPlacementOrderingModel } = await import("./loadNativeElement");
    const stored = { id: "1", choices: [{ id: "a" }, { id: "b" }] };

    await expect(buildPlacementOrderingModel(stored)).resolves.toEqual({
      ...built,
      completeLength: 2,
    });
    expect(model).toHaveBeenCalledWith(stored, undefined, { mode: "gather", role: "student" });
  });

  it("builds the real model the element needs to draw, from what a learner is sent: no correct order", async () => {
    vi.resetModules();
    const { buildPlacementOrderingModel } = await import("./loadNativeElement");
    const built = await buildPlacementOrderingModel({
      id: "1",
      element: "aios-placement-ordering",
      prompt: "<p>Order them</p>",
      choices: [
        { id: "b", label: "Second" },
        { id: "a", label: "First" },
      ],
      orientation: "vertical",
      partialScoring: true,
    });
    expect(built).toMatchObject({
      completeLength: 2,
      choices: [{ id: "b" }, { id: "a" }],
      config: { orientation: "vertical" },
      disabled: false,
    });
    expect(built).not.toHaveProperty("correctResponse");
  });
});
