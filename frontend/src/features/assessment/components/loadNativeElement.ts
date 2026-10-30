// Standalone PIE elements, used directly as custom elements instead of going
// through <pie-fixed-player> — no published pie-fixed-player-static bundle
// includes placement-ordering, match or match-list (see PieQuestionPlayer.tsx
// for how a question picks between the two). Each is registered under an
// "aios-" tag of its own so it can't collide with a tag name PIE itself (or
// a future pie-fixed-player-static bundle) might use.

const loading = new Map<string, Promise<void>>();

/**
 * Loads and registers one native element's custom element on first use. Each
 * is loaded once; a failed load is retried on the next call for that tag.
 */
function loadNativeElement(tag: string, load: () => Promise<{ default: CustomElementConstructor }>) {
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
