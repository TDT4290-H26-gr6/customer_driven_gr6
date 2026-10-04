import type { ReactNode } from "react";
import { AccentProvider } from "./AccentProvider";
import { AuthProvider } from "./AuthProvider";
import { ThemeProvider } from "./ThemeProvider";

/** Composes every context provider the app needs. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AccentProvider>
        <AuthProvider>{children}</AuthProvider>
      </AccentProvider>
    </ThemeProvider>
  );
}
