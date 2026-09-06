import { useEffect, useState } from "react";
import { Login } from "./Login";
import { QuestionPlayer } from "./QuestionPlayer";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

type Question = { id: string; prompt: string; questionType: string; competenceArea: { name: string } };
type Learner = { id: string; email: string; name: string };

export function App() {
  const [learner, setLearner] = useState<Learner | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("aios_token");
    if (!token) {
      setCheckingSession(false);
      return;
    }
    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid session");
        return res.json();
      })
      .then((loggedInLearner) => {
        setLearner(loggedInLearner);
        fetchQuestions(token);
      })
      .catch(() => {
        localStorage.removeItem("aios_token");
      })
      .finally(() => setCheckingSession(false));
  }, []);

  function fetchQuestions(token: string) {
    fetch(`${API_URL}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setQuestions);
  }

  function handleLogin(token: string, loggedInLearner: Learner) {
    setLearner(loggedInLearner);
    fetchQuestions(token);
  }

  function handleLogout() {
    localStorage.removeItem("aios_token");
    setLearner(null);
    setQuestions([]);
  }

  if (checkingSession) return null;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 640 }}>
      <h1>AIOS Question Bank</h1>
      {!learner ? (
<Login onLogin={handleLogin} />
      ) : (
        <>
          <p>Signed in as {learner.email} <button onClick={handleLogout}>Sign out</button></p>
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