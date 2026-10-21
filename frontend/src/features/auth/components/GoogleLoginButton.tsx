import { useEffect, useRef } from "react";
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

/**
 * Google's widget can't be disabled, so while `accepted` (the information-letter
 * checkbox) is false the wrapper is dimmed and ignores pointer and keyboard
 * input. The callback reads the latest value through a ref because the widget
 * is only initialised again when the theme changes.
 */
export function GoogleLoginButton({
  onLogin,
  accepted,
}: {
  onLogin: (learner: Learner) => void;
  accepted: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const acceptedRef = useRef(accepted);
  acceptedRef.current = accepted;
  const containerRef = useRef<HTMLDivElement>(null);

  // `inert` (as in AppShell) also takes the widget out of the tab order.
  useEffect(() => {
    if (containerRef.current) containerRef.current.inert = !accepted;
  }, [accepted]);

  useEffect(() => {
    if (!window.google) return;

    window.google.accounts.id.initialize({
      client_id: env.GOOGLE_CLIENT_ID,
      callback: async (response: { credential: string }) => {
        if (!acceptedRef.current) return;
        try {
          const { learner } = await googleLogin(response.credential, true);
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

  return (
    <div
      ref={containerRef}
      id="google-signin-button"
      aria-disabled={!accepted}
      style={accepted ? undefined : { opacity: 0.5, pointerEvents: "none" }}
    ></div>
  );
}
