import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useLocalStorage } from "@/shared/hooks/useLocalStorage";

export type AccentColor = "purple" | "blue" | "olive";

/** The three accent colors of the AIOS logo. `hex` is for the picker swatch only —
 *  the app itself is themed through `data-accent` (see styles/globals.css). */
export const ACCENTS: { value: AccentColor; label: string; hex: string }[] = [
  { value: "purple", label: "Purple", hex: "#7b3d8d" },
  { value: "blue", label: "Blue", hex: "#3386a7" },
  { value: "olive", label: "Olive", hex: "#aab627" },
];

type AccentContextValue = {
  accent: AccentColor;
  setAccent: (accent: AccentColor) => void;
};

const AccentContext = createContext<AccentContextValue | null>(null);

const STORAGE_KEY = "aios.accentColor";
const DEFAULT_ACCENT: AccentColor = "purple";

/**
 * The learner's accent color, applied as a `data-accent` attribute on <html>
 * — the same mechanism as ThemeProvider's `data-theme`. index.html has a
 * pre-React script with the same storage key to avoid a flash of the wrong color.
 */
export function AccentProvider({ children }: { children: ReactNode }) {
  const [stored, setAccent] = useLocalStorage<AccentColor>(STORAGE_KEY, DEFAULT_ACCENT);
  // A stale or hand-edited stored value falls back to the default.
  const accent = ACCENTS.some((a) => a.value === stored) ? stored : DEFAULT_ACCENT;

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accent);
  }, [accent]);

  return <AccentContext.Provider value={{ accent, setAccent }}>{children}</AccentContext.Provider>;
}

export function useAccent(): AccentContextValue {
  const ctx = useContext(AccentContext);
  if (!ctx) throw new Error("useAccent must be used within an AccentProvider");
  return ctx;
}
