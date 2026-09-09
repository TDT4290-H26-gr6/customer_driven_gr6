import { useEffect, useState } from "react";
import { GoogleLoginButton, getMe, getToken, clearToken } from "@/features/auth";
import type { Learner, Role } from "@/features/auth";
import { RoleSelect } from "@/features/onboarding";
import { PieQuestionPlayer, getQuestions } from "@/features/assessment";
import type { Question } from "@/features/assessment";

export function App() {
  const [learner, setLearner] = useState<Learner | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setCheckingSession(false);
      return;
    }
    getMe()
      .then((me) => {
        setLearner(me);
        loadQuestions();
      })
      .catch(() => clearToken())
      .finally(() => setCheckingSession(false));
  }, []);

  function loadQuestions() {
    getQuestions()
      .then(setQuestions)
      .catch(() => setQuestions([]));
  }

  function handleLogin(me: Learner) {
    setLearner(me);
    loadQuestions();
  }

  function handleLogout() {
    clearToken();
    setLearner(null);
    setQuestions([]);
  }

  if (checkingSession) return null;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 640 }}>
      <h1>AIOS Question Bank</h1>
      {!learner ? (
        <GoogleLoginButton onLogin={handleLogin} />
      ) : !learner.role ? (
        <>
          <p>
            Signed in as {learner.email}{" "}
            <button onClick={handleLogout}>Sign out</button>
          </p>
          <RoleSelect onDone={(role: Role) => setLearner({ ...learner, role })} />
        </>
      ) : (
        <>
          <p>
            Signed in as {learner.email} — {learner.role.name}{" "}
            <button onClick={handleLogout}>Sign out</button>
          </p>
          {questions.map((q) => (
            <div key={q.id} style={{ border: "1px solid #ccc", padding: "1rem", marginBottom: "1rem" }}>
              <strong>{q.competenceArea.name}</strong> ({q.questionType})
              <p>{q.prompt}</p>
            </div>
          ))}
          {questions[0] && <PieQuestionPlayer content={questions[0].content} />}
        </>
      )}
    </div>
  );
}
