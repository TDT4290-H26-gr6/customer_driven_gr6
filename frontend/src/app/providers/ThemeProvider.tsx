import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocalStorage } from "@/shared/hooks/useLocalStorage";

export type ThemePreference = "default" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  /** What "default" actually resolves to right now — useful for anything
   *  that can't read CSS variables (e.g. the Google Sign-In button). */
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "aios.themePreference";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Three-way "visuals" setting, the same shape as Claude's own theme picker:
 * Default (follows the OS), Light, or Dark. Applied via a `data-theme`
 * attribute on <html> — see styles/globals.css for the token contract this
 * relies on, and index.html for the pre-React script that avoids a flash of
 * the wrong theme on first paint.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useLocalStorage<ThemePreference>(STORAGE_KEY, "default");
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (preference === "default") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", preference);
    }
  }, [preference]);

  const resolvedTheme: ResolvedTheme = preference === "default" ? (systemDark ? "dark" : "light") : preference;

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
