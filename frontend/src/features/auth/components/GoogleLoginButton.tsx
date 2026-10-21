import { useEffect } from "react";
import { env } from "@/config/env";
import { useTheme } from "@/app/providers/ThemeProvider";
import { googleLogin } from "../api";
import type { Learner } from "../types";

// Minimal shape of the Google Identity Services client (loaded via the
// <script> tag in index.html) — just the bits this component calls. No
// official types package is installed for it, so this stays hand-rolled
// rather than falling back to `any`.
type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }): void;
      renderButton(parent: HTMLElement, options: { theme: string; size: string }): void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

export function GoogleLoginButton({ onLogin }: { onLogin: (learner: Learner) => void }) {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!window.google) return;

    window.google.accounts.id.initialize({
      client_id: env.GOOGLE_CLIENT_ID,
      callback: async (response: { credential: string }) => {
        try {
          const { learner } = await googleLogin(response.credential);
          onLogin(learner);
        } catch {
          // Leave the button in place; the next session check will show state.
        }
      },
    });

    // Google's widget doesn't read our CSS variables, so hand it a matching
    // theme directly whenever the resolved (system-aware) theme changes.
    const container = document.getElementById("google-signin-button");
    if (!container) return;
    container.innerHTML = "";
    window.google.accounts.id.renderButton(container, {
      theme: resolvedTheme === "dark" ? "filled_black" : "outline",
      size: "large",
    });
  }, [resolvedTheme]);

  return <div id="google-signin-button"></div>;
}
