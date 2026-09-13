import type { ReactNode } from "react";
import { AuthProvider } from "./AuthProvider";

/** Composes every context provider the app needs. */
export function AppProviders({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
