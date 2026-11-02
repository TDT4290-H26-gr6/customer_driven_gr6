import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { Spinner } from "@/shared/components/Spinner";
import { orcidLogin } from "../api";
import { consumeOrcidState } from "../orcid";
import styles from "./LoginPage.module.css";

/** Where ORCID sends the learner back to, with `?code=…&state=…` (or `?error=…`). */
export function OrcidCallbackPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [failed, setFailed] = useState(false);
  // An authorization code works once, and React's dev StrictMode runs
  // effects twice — so the exchange must only be started the first time.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = params.get("code");
    if (!code || !consumeOrcidState(params.get("state"))) {
      setFailed(true);
      return;
    }
    orcidLogin(code)
      .then(({ learner }) => {
        login(learner);
        navigate("/", { replace: true });
      })
      .catch(() => setFailed(true));
  }, [params, login, navigate]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {failed ? (
          <>
            <p className={styles.tagline} role="alert">
              ORCID sign-in didn&rsquo;t work. Please try again.
            </p>
            <Link to="/login">Back to sign in</Link>
          </>
        ) : (
          <Spinner />
        )}
      </div>
    </div>
  );
}
