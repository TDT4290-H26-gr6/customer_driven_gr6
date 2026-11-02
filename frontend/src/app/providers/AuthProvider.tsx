import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe, getToken, clearToken } from "@/features/auth";
import { isApiError, onUnauthorized } from "@/shared/api/client";
import { withRetry } from "@/shared/api/retry";
import type { Learner, Role } from "@/features/auth";

/**
 * "unreachable": there's a saved session, but checking it failed for a reason
 * that says nothing about the session (no connection, a timeout, a server
 * error). The learner stays signed in and can try again.
 */
type Status = "loading" | "signedOut" | "signedIn" | "unreachable";

type AuthContextValue = {
  learner: Learner | null;
  status: Status;
  login: (learner: Learner) => void;
  logout: () => void;
  setRole: (role: Role) => void;
  markInitialAssessmentComplete: () => void;
  /** Replaces the session's learner with a fresh copy from the backend (e.g. after saving the profile). */
  updateLearner: (learner: Learner) => void;
  /** Checks the saved session again, after it was "unreachable". */
  recheck: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Session/auth state: current learner, token, login/logout/setRole. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [learner, setLearner] = useState<Learner | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  // Only the backend refusing the session (any 4xx: an expired token, an
  // account that's gone) signs the learner out. No answer at all, or a server
  // error, says nothing about the session (the proxy in front of the server
  // can take many seconds to connect): dropping the token then would sign
  // everyone out whenever the network is slow.
  function checkSession() {
    if (!getToken()) {
      setStatus("signedOut");
      return;
    }
    setStatus("loading");
    withRetry(getMe, { attempts: 2 })
      .then((me) => {
        setLearner(me);
        setStatus("signedIn");
      })
      .catch((err: unknown) => {
        if (isApiError(err) && err.status >= 400 && err.status < 500) {
          clearToken();
          setStatus("signedOut");
        } else {
          setStatus("unreachable");
        }
      });
  }

  // On load; recheck() runs it again when the learner asks.
  useEffect(checkSession, []);

  // Any request that comes back 401 means the session is dead (expired
  // token, deleted account). apiFetch already dropped the token; this signs
  // the app out too, so RequireAuth sends the learner to /login instead of
  // leaving them on a page where every request keeps failing.
  useEffect(
    () =>
      onUnauthorized(() => {
        setLearner(null);
        setStatus("signedOut");
      }),
    [],
  );

  function login(me: Learner) {
    setLearner(me);
    setStatus("signedIn");
  }

  function logout() {
    clearToken();
    setLearner(null);
    setStatus("signedOut");
  }

  function setRole(role: Role) {
    setLearner((prev) => (prev ? { ...prev, role } : prev));
  }

  function markInitialAssessmentComplete() {
    setLearner((prev) => (prev ? { ...prev, hasCompletedInitialAssessment: true } : prev));
  }

  function updateLearner(updated: Learner) {
    setLearner(updated);
  }

  return (
    <AuthContext.Provider
      value={{
        learner,
        status,
        login,
        logout,
        setRole,
        markInitialAssessmentComplete,
        recheck: checkSession,
        updateLearner,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
