import { useState } from "react";

/** Like useState, but persisted to sessionStorage under `key`, cleared when the tab/session ends. */
export function useSessionStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  function set(next: T | ((prev: T) => T)) {
    setValue((prev) => {
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
      try {
        sessionStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        /* storage unavailable, value just won't persist */
      }
      return resolved;
    });
  }

  return [value, set] as const;
}
