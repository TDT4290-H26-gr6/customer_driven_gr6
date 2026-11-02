import { useEffect, useState } from "react";
import { env } from "@/config/env";
import { isApiError, NETWORK_ERROR_STATUS } from "@/shared/api/client";
import { googleLogin } from "../api";
import type { Learner } from "../types";
import styles from "./GoogleLoginButton.module.css";

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
  const [unavailable, setUnavailable] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  // From Google handing back the credential until our server has answered,
  // which on a slow connection can take many seconds.
  const [signingIn, setSigningIn] = useState(false);
  const handlers: SignInHandlers = {
    onStart: () => {
      setSignInError(null);
      setSigningIn(true);
    },
    onLogin: (learner) => {
      setSigningIn(false);
      onLogin(learner);
    },
    onError: (message) => {
      setSigningIn(false);
      setSignInError(message);
    },
  };

  useEffect(() => {
    // Google's script loads async, so it can still be on its way when this
    // mounts (the production bundle is often faster): draw the button once
    // it has loaded. If it can't load (blocked by an extension, a network
    // filter or the page's own security policy), say so rather than leave
    // an empty slot.
    if (window.google) {
      drawButton(window.google, handlers);
      return;
    }
    const script = document.querySelector(GOOGLE_SCRIPT);
    // The page has finished loading (async scripts included) without it.
    if (!script || document.readyState === "complete") {
      setUnavailable(true);
      return;
    }
    const onLoad = () => {
      if (window.google) drawButton(window.google, handlers);
      else setUnavailable(true);
    };
    const onError = () => setUnavailable(true);
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    return () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
  }, []);

  return (
    <>
      <div id="google-signin-button"></div>
      {signingIn && (
        <p className={styles.signingIn} role="status">
          Signing in…
        </p>
      )}
      {signInError && (
        <p className={styles.unavailable} role="alert">
          {signInError}
        </p>
      )}
      {unavailable && (
        <p className={styles.unavailable} role="alert">
          Google sign-in couldn&apos;t load. Check your connection, or allow this site in any
          blocker, then reload the page.
        </p>
      )}
    </>
  );
}

/** Why signing in failed, in words the learner can act on. */
function signInFailure(err: unknown): string {
  if (isApiError(err) && err.status === NETWORK_ERROR_STATUS) {
    return "Couldn't reach AIOS to finish signing in. The connection may be slow right now. Please try again.";
  }
  return "Signing in with Google didn't work. Please try again.";
}

/** What the button reports while a sign-in runs. */
type SignInHandlers = {
  onStart: () => void;
  onLogin: (learner: Learner) => void;
  onError: (message: string) => void;
};

function drawButton(google: GoogleIdentityServices, { onStart, onLogin, onError }: SignInHandlers) {
  google.accounts.id.initialize({
    client_id: env.GOOGLE_CLIENT_ID,
    callback: async (response: { credential: string }) => {
      onStart();
      try {
        const { learner } = await googleLogin(response.credential);
        onLogin(learner);
      } catch (err) {
        // The button stays, so the learner can try again; say what went
        // wrong rather than nothing at all.
        onError(signInFailure(err));
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
