import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { listJourneys, type LearningJourney } from "@/features/learningJourney";
import { isApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { getAssessableSections, startReassessment, type AssessableSection } from "../api";
import styles from "./ReassessPage.module.css";

type Options = { journeys: LearningJourney[]; sections: AssessableSection[] };

/**
 * Asked before a reassessment (the dashboard's "Retake assessment" button). No
 * journey completed: a normal retake of every section. A journey completed:
 * the learner picks it, the sections it covers come pre-ticked — they can add or remove any — and the
 * reassessment only asks those sections' questions. POST /assessment/start
 * records both, and History shows them.
 */
export function ReassessPage() {
  const { learner } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"ask" | "details">("ask");
  const [options, setOptions] = useState<Options | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [journeyId, setJourneyId] = useState("");
  const [sectionIds, setSectionIds] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  // Only a retake can be limited; the first assessment covers everything.
  if (!learner?.hasCompletedInitialAssessment) return <Navigate to="/assessment" replace />;

  function loadOptions() {
    setLoadFailed(false);
    setOptions(null);
    Promise.all([listJourneys(), getAssessableSections()]).then(
      ([journeys, sections]) => setOptions({ journeys, sections }),
      () => setLoadFailed(true),
    );
  }

  function answerYes() {
    setStep("details");
    if (!options) loadOptions();
  }

  function chooseJourney(id: string) {
    setJourneyId(id);
    const journey = options?.journeys.find((j) => j.id === id);
    const assessable = new Set(options?.sections.map((s) => s.id));
    setSectionIds(
      new Set((journey?.sections ?? []).map((s) => s.sectionId).filter((s) => assessable.has(s))),
    );
  }

  function toggleSection(id: string) {
    setSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function start(e: FormEvent) {
    e.preventDefault();
    if (!journeyId || sectionIds.size === 0) return;
    setStarting(true);
    setError("");
    startReassessment(journeyId, [...sectionIds])
      .then(() => navigate("/assessment", { replace: true }))
      .catch((err) => {
        // One already in progress (e.g. started in another tab): resume it.
        if (isApiError(err) && err.status === 409) {
          navigate("/assessment", { replace: true });
          return;
        }
        setError("Couldn't start the reassessment. Please try again.");
        setStarting(false);
      });
  }

  if (step === "ask") {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.heading}>Before you retake the assessment</h1>
          <p className={styles.question}>
            Have you completed a learning journey since your last assessment?
          </p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => navigate("/assessment")}>
              No
            </Button>
            <Button onClick={answerYes}>Yes</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={start}>
        <h1 className={styles.heading}>Which journey did you complete?</h1>
        <p className={styles.hint}>
          The reassessment will only include questions from the sections you tick.
        </p>

        {loadFailed ? (
          <div className={styles.loadError}>
            <p className={styles.error} role="alert">
              Couldn&apos;t load the learning journeys.
            </p>
            <Button type="button" variant="secondary" onClick={loadOptions}>
              Try again
            </Button>
          </div>
        ) : !options ? (
          <Spinner />
        ) : options.journeys.length === 0 ? (
          <div className={styles.loadError}>
            <p className={styles.hint}>There are no learning journeys to pick from yet.</p>
            <Button type="button" onClick={() => navigate("/assessment")}>
              Reassess everything instead
            </Button>
          </div>
        ) : (
          <>
            <label className={styles.field}>
              <span className={styles.label}>Learning journey</span>
              <select
                className={styles.select}
                value={journeyId}
                onChange={(e) => chooseJourney(e.target.value)}
                disabled={starting}
              >
                <option value="" disabled>
                  Select the journey you completed
                </option>
                {options.journeys.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </label>

            {journeyId && (
              <fieldset className={styles.sections} disabled={starting}>
                <legend className={styles.label}>Sections to reassess</legend>
                {options.sections.map((s) => (
                  <label key={s.id} className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={sectionIds.has(s.id)}
                      onChange={() => toggleSection(s.id)}
                    />
                    <span>{s.name}</span>
                  </label>
                ))}
              </fieldset>
            )}
          </>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={() => setStep("ask")}>
            Back
          </Button>
          <Button type="submit" disabled={!journeyId || sectionIds.size === 0 || starting}>
            {starting ? "Starting…" : "Start assessment"}
          </Button>
        </div>
      </form>
    </div>
  );
}
