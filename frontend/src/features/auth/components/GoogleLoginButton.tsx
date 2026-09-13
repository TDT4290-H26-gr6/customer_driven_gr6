import { useEffect } from "react";
import { env } from "@/config/env";
import { useTheme } from "@/app/providers/ThemeProvider";
import { googleLogin } from "../api";
import type { Learner } from "../types";

declare global {
  interface Window {
    google: any;
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
    if (container) container.innerHTML = "";
    window.google.accounts.id.renderButton(container, {
      theme: resolvedTheme === "dark" ? "filled_black" : "outline",
      size: "large",
    });
  }, [resolvedTheme]);

  return <div id="google-signin-button"></div>;
}
