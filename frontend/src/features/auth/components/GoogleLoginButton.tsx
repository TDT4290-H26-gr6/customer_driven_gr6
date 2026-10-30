import { useEffect } from "react";
import { env } from "@/config/env";
import { googleLogin } from "../api";
import type { Learner } from "../types";

// Minimal shape of the Google Identity Services client (loaded via the
// <script> tag in index.html), just the bits this component calls. No
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

    // Always Google's white "outline" button, in dark mode too: the black
    // one blends into the dark login card.
    const container = document.getElementById("google-signin-button");
    if (!container) return;
    container.innerHTML = "";
    window.google.accounts.id.renderButton(container, {
      theme: "outline",
      size: "large",
    });
  }, []);

  return <div id="google-signin-button"></div>;
}
