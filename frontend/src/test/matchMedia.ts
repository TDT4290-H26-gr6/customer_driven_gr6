import { vi } from "vitest";

/**
 * jsdom has no window.matchMedia. Installs one where `matches(query)` decides
 * each query's answer; `change(...)` updates it and notifies listeners, like
 * the OS switching to dark mode. Undo with vi.unstubAllGlobals().
 */
export function stubMatchMedia(matches: (query: string) => boolean) {
  let current = matches;
  const listeners = new Map<string, Set<(e: MediaQueryListEvent) => void>>();

  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      get matches() {
        return current(query);
      },
      media: query,
      addEventListener: (_type: string, listener: (e: MediaQueryListEvent) => void) => {
        if (!listeners.has(query)) listeners.set(query, new Set());
        listeners.get(query)!.add(listener);
      },
      removeEventListener: (_type: string, listener: (e: MediaQueryListEvent) => void) => {
        listeners.get(query)?.delete(listener);
      },
    })),
  );

  return {
    change(next: (query: string) => boolean) {
      current = next;
      for (const [query, set] of listeners) {
        for (const listener of set)
          listener({ matches: next(query), media: query } as MediaQueryListEvent);
      }
    },
  };
}
