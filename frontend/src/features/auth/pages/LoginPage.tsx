import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { Logo } from "@/shared/components/Logo";
import { GoogleLoginButton } from "../components/GoogleLoginButton";
import { GreetingBot } from "../components/GreetingBot";
import type { Learner } from "../types";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);

  // Only reachable while signed out; a direct visit while already signed in
  // just bounces back through the normal "/" redirect.
  useEffect(() => {
    if (status === "signedIn") navigate("/", { replace: true });
  }, [status, navigate]);

  function handleLogin(learner: Learner) {
    login(learner);
    navigate("/", { replace: true });
  }

  return (
    <div className={styles.page}>
      {/* To the left of the card on desktop; left out on mobile. */}
      <GreetingBot />
      <div className={styles.card}>
        <Logo className={styles.logo} />
        <p className={styles.tagline}>Assess and grow your AI &amp; open-science skills.</p>
        <div className={styles.googleButton}>
          <GoogleLoginButton onLogin={handleLogin} accepted={accepted} />
        </div>
        <label className={styles.consent}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>
            By checking this box, you acknowledge that you have read and understood the{" "}
            <Link to="/information-letter" target="_blank">
              information letter
            </Link>{" "}
            and consent to participate.
          </span>
        </label>
        <p className={styles.note}>
          We use your profile details and assessment answers to show your results, recommend
          learning journeys and research the AIOS curriculum. You can request deletion of your
          account and personal data at any time from the settings page. We will process the request
          within 30 days.
        </p>
      </div>
    </div>
  );
}
