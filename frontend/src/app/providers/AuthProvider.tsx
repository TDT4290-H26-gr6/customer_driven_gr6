import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe, getToken, clearToken } from "@/features/auth";
import type { Learner, Role } from "@/features/auth";

type Status = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  learner: Learner | null;
  status: Status;
  login: (learner: Learner) => void;
  logout: () => void;
  setRole: (role: Role) => void;
  markInitialAssessmentComplete: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Session/auth state: current learner, token, login/logout/setRole. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [learner, setLearner] = useState<Learner | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!getToken()) {
      setStatus("signedOut");
      return;
    }
    getMe()
      .then((me) => {
        setLearner(me);
        setStatus("signedIn");
      })
      .catch(() => {
        clearToken();
        setStatus("signedOut");
      });
  }, []);

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

  return (
    <AuthContext.Provider
      value={{ learner, status, login, logout, setRole, markInitialAssessmentComplete }}
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
