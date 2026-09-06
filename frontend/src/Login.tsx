import { useEffect } from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

declare global {
  interface Window { google: any; }
}

export function Login({ onLogin }: { onLogin: (token: string, learner: any) => void }) {
  useEffect(() => {
    if (!window.google) return;
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: async (response: { credential: string }) => {
        const res = await fetch(`${API_URL}/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential }),
        });
        const data = await res.json();
        if (data.token) {
          localStorage.setItem("aios_token", data.token);
          onLogin(data.token, data.learner);
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