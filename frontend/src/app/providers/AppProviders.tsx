import type { ReactNode } from "react";
import { FeedbackProvider } from "@/features/feedback";
import { AccentProvider } from "./AccentProvider";
import { AuthProvider } from "./AuthProvider";
import { ThemeProvider } from "./ThemeProvider";
import { ToastProvider } from "./ToastProvider";

/** Composes every context provider the app needs. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AccentProvider>
        <AuthProvider>
          <FeedbackProvider>
            <ToastProvider>{children}</ToastProvider>
          </FeedbackProvider>
        </AuthProvider>
      </AccentProvider>
    </ThemeProvider>
  );
}
