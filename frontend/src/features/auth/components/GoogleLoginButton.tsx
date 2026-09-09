import { useEffect } from "react";
import { env } from "@/config/env";
import { googleLogin } from "../api";
import type { Learner } from "../types";

declare global {
  interface Window {
    google: any;
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

    window.google.accounts.id.renderButton(
      document.getElementById("google-signin-button"),
      { theme: "outline", size: "large" }
    );
  }, []);

  return <div id="google-signin-button"></div>;
}
