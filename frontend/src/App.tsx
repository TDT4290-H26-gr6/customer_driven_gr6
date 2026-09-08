import { useEffect, useState } from "react";
import { Login } from "./Login";
import { QuestionPlayer } from "./QuestionPlayer";
import { RoleSelect } from "./RoleSelect";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

type Question = {
  id: string;
  prompt: string;
  questionType: string;
  competenceArea: { name: string };
  content: any;
};
type Role = { id: string; name: string };
type Learner = { id: string; email: string; name: string; role?: Role | null };

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [learner, setLearner] = useState<Learner | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("aios_token");
    if (!stored) {
      setCheckingSession(false);
      return;
    }
    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid session");
        return res.json();
      })
      .then((loggedInLearner) => {
        setToken(stored);
        setLearner(loggedInLearner);
        fetchQuestions(stored);
      })
      .catch(() => {
        localStorage.removeItem("aios_token");
      })
      .finally(() => setCheckingSession(false));
  }, []);

  function fetchQuestions(authToken: string) {
    fetch(`${API_URL}/questions`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => res.json())
      .then(setQuestions);
  }

  function handleLogin(newToken: string, loggedInLearner: Learner) {
    setToken(newToken);
    setLearner(loggedInLearner);
    fetchQuestions(newToken);
  }

  function handleLogout() {
    localStorage.removeItem("aios_token");
    setToken(null);
    setLearner(null);
    setQuestions([]);
  }

  if (checkingSession) return null;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 640 }}>
      <h1>AIOS Question Bank</h1>
      {!learner || !token ? (
        <Login onLogin={handleLogin} />
      ) : !learner.role ? (
        <>
          <p>
            Signed in as {learner.email}{" "}
            <button onClick={handleLogout}>Sign out</button>
          </p>
          <RoleSelect
            token={token}
            onDone={(role) => setLearner({ ...learner, role })}
          />
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
          {questions[0] && <QuestionPlayer content={questions[0].content} />}
        </>
      )}
    </div>
  );
}
