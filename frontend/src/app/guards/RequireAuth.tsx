import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import styles from "./RequireAuth.module.css";

/**
 * No session -> redirect to /login. A session that couldn't be checked (no
 * connection, a timeout) keeps the learner signed in, with a way to try again.
 */
export function RequireAuth() {
  const { status, recheck } = useAuth();

  if (status === "loading") return <Spinner />;
  if (status === "signedOut") return <Navigate to="/login" replace />;
  if (status === "unreachable") {
    return (
      <div className={styles.unreachable} role="alert">
        <p>
          Couldn&apos;t reach AIOS. The connection may be slow or down right now. You&apos;re still
          signed in.
        </p>
        <Button onClick={recheck}>Try again</Button>
      </div>
    );
  }
  return <Outlet />;
}
