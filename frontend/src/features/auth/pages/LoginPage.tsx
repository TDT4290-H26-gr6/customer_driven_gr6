import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { Logo } from "@/shared/components/Logo";
import { GoogleLoginButton } from "../components/GoogleLoginButton";
import { GreetingBot } from "../components/GreetingBot";
import type { Learner } from "../types";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();

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
        <GoogleLoginButton onLogin={handleLogin} />
      </div>
    </div>
  );
}
