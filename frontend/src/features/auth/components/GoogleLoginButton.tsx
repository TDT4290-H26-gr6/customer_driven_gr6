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

/** The <script> tag in index.html that loads Google's sign-in client. */
const GOOGLE_SCRIPT = 'script[src^="https://accounts.google.com/gsi/client"]';

export function GoogleLoginButton({ onLogin }: { onLogin: (learner: Learner) => void }) {
  useEffect(() => {
    // Google's script loads async, so it can still be on its way when this
    // mounts (the production bundle is often faster): draw the button once
    // it has loaded. If it never does (blocked), the slot stays empty.
    if (window.google) {
      drawButton(window.google, onLogin);
      return;
    }
    const script = document.querySelector(GOOGLE_SCRIPT);
    const onLoad = () => {
      if (window.google) drawButton(window.google, onLogin);
    };
    script?.addEventListener("load", onLoad);
    return () => script?.removeEventListener("load", onLoad);
  }, []);

  return <div id="google-signin-button"></div>;
}

function drawButton(google: GoogleIdentityServices, onLogin: (learner: Learner) => void) {
  google.accounts.id.initialize({
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
  google.accounts.id.renderButton(container, {
    theme: "outline",
    size: "large",
  });
}
