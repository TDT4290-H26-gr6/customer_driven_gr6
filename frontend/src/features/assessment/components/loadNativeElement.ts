// Standalone PIE elements, used directly as custom elements instead of going
// through <pie-fixed-player>, no published pie-fixed-player-static bundle
// includes placement-ordering, match or match-list (see PieQuestionPlayer.tsx
// for how a question picks between the two). Each is registered under an
// "aios-" tag of its own so it can't collide with a tag name PIE itself (or
// a future pie-fixed-player-static bundle) might use.

const loading = new Map<string, Promise<void>>();

/**
 * Loads and registers one native element's custom element on first use. Each
 * is loaded once; a failed load is retried on the next call for that tag.
 */
function loadNativeElement(
  tag: string,
  load: () => Promise<{ default: CustomElementConstructor }>,
) {
  return function (): Promise<void> {
    let promise = loading.get(tag);
    if (!promise) {
      promise = load()
        .then(({ default: ElementClass }) => {
          if (!customElements.get(tag)) customElements.define(tag, ElementClass);
        })
        .catch((error: unknown) => {
          loading.delete(tag);
          throw error;
        });
      loading.set(tag, promise);
    }
    return promise;
  };
}

export const loadPlacementOrdering = loadNativeElement(
  "aios-placement-ordering",
  () => import("@pie-element/placement-ordering/delivery"),
);

/**
 * placement-ordering draws from the model its own controller builds out of
 * the stored one (the layout config, ...), not from the stored one itself,
 * which it can't render. The controller is what a PIE player would run
 * first; here that's this. It counts an answer as complete once it has as
 * many items as the correct order, which a learner isn't sent (the backend
 * strips it, see assessment.redact.ts); every item is part of that order
 * (see pie.ts's orderingContent), so that's every item.
 */
export async function buildPlacementOrderingModel(
  model: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const controller = await import("@pie-element/placement-ordering/controller");
  const built = await controller.model(model as never, undefined, {
    mode: "gather",
    role: "student",
  });
  const choices = Array.isArray(model.choices) ? model.choices : [];
  return { ...built, completeLength: choices.length };
}

/** The matrix question types: true/false statements, classification, matching. */
export const loadMatch = loadNativeElement(
  "aios-match",
  () => import("@pie-element/match/delivery"),
);

/**
 * match's model as stored, with a line-break opportunity after each "/" in
 * the column headers, so a header like "information/resource support" can
 * wrap and the table fits the card instead of scrolling sideways. Headers are
 * HTML the builder has already escaped (see pie.ts), so `<wbr>` is the only
 * markup added.
 */
export async function buildMatchModel(
  model: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!Array.isArray(model.headers)) return model;
  return {
    ...model,
    headers: model.headers.map((h: unknown) =>
      typeof h === "string" ? h.replace(/\//g, "/<wbr>") : h,
    ),
  };
}
