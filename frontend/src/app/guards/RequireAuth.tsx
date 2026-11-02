import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import styles from "./RequireAuth.module.css";

/** How long the session check may take before the spinner says it's slow. */
export const SLOW_CHECK_MS = 10_000;

/**
 * The spinner while the saved session is checked. On a slow connection the
 * check can take up to a minute (a long request timeout, tried twice), so
 * after a while it says it's still trying rather than looking stuck.
 */
export function CheckingSession() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_CHECK_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className={styles.checking}>
      <Spinner />
      {slow && (
        <p role="status">
          This is taking longer than usual. The connection may be slow; still trying…
        </p>
      )}
    </div>
  );
}

/**
 * No session -> redirect to /login. A session that couldn't be checked (no
 * connection, a timeout) keeps the learner signed in, with a way to try again
 * or to sign out (which needs no connection).
 */
export function RequireAuth() {
  const { status, recheck, logout } = useAuth();

  if (status === "loading") return <CheckingSession />;
  if (status === "signedOut") return <Navigate to="/login" replace />;
  if (status === "unreachable") {
    return (
      <div className={styles.unreachable} role="alert">
        <p>
          Couldn&apos;t reach AIOS. The connection may be slow or down right now. You&apos;re still
          signed in.
        </p>
        <div className={styles.actions}>
          <Button onClick={recheck}>Try again</Button>
          <Button variant="secondary" onClick={logout}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }
  return <Outlet />;
}
