import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { isApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { getAssessableSections, startReassessment, type AssessableSection } from "../api";
import styles from "./ReassessPage.module.css";

/**
 * Asked before a reassessment (the dashboard's "Retake assessment" button).
 * "Full assessment" (the default) is a normal retake of every section. "A
 * single section" reveals a dropdown, and the reassessment only asks that
 * section's questions: POST /assessment/start records it, and History shows it.
 */
export function ReassessPage() {
  const { learner } = useAuth();
  const navigate = useNavigate();
  const [sections, setSections] = useState<AssessableSection[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [mode, setMode] = useState<"full" | "section">("full");
  const [sectionId, setSectionId] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const canRetake = Boolean(learner?.hasCompletedInitialAssessment);

  function loadSections() {
    setLoadFailed(false);
    setSections(null);
    getAssessableSections().then(setSections, () => setLoadFailed(true));
  }

  // Loaded up front so the dropdown is ready when "A single section" is picked.
  useEffect(() => {
    if (canRetake) loadSections();
  }, [canRetake]);

  // Only a retake can be limited; the first assessment covers everything.
  if (!canRetake) return <Navigate to="/assessment" replace />;

  function start(e: FormEvent) {
    e.preventDefault();
    if (mode === "full") {
      navigate("/assessment");
      return;
    }
    if (!sectionId) return;
    setStarting(true);
    setError("");
    startReassessment([sectionId])
      .then(() => navigate("/assessment", { replace: true }))
      .catch((err) => {
        // One already in progress (e.g. started in another tab): resume it.
        if (isApiError(err) && err.status === 409) {
          navigate("/assessment", { replace: true });
          return;
        }
        setError("Couldn't start the assessment. Please try again.");
        setStarting(false);
      });
  }

  return (
    <div className={styles.page} data-backdrop="logo">
      <form className={styles.card} onSubmit={start}>
        <h1 className={styles.heading}>What would you like to retake?</h1>

        <fieldset className={styles.sections} disabled={starting}>
          <legend className={styles.label}>Assessment to retake</legend>
          <label className={styles.checkboxRow}>
            <input
              type="radio"
              name="mode"
              checked={mode === "full"}
              onChange={() => setMode("full")}
            />
            <span>Full assessment</span>
          </label>
          <label className={styles.checkboxRow}>
            <input
              type="radio"
              name="mode"
              checked={mode === "section"}
              onChange={() => setMode("section")}
            />
            <span>A single section</span>
          </label>

          {mode === "section" && (
            <div className={styles.sectionPicker}>
              {loadFailed ? (
                <div className={styles.loadError}>
                  <p className={styles.error} role="alert">
                    Couldn&apos;t load the sections.
                  </p>
                  <Button type="button" variant="secondary" onClick={loadSections}>
                    Try again
                  </Button>
                </div>
              ) : !sections ? (
                <Spinner />
              ) : sections.length === 0 ? (
                <p className={styles.hint}>There are no sections to pick from yet.</p>
              ) : (
                <>
                  <label className={styles.label} htmlFor="reassess-section">
                    Section
                  </label>
                  <select
                    id="reassess-section"
                    className={styles.select}
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                  >
                    <option value="" disabled>
                      Choose a section…
                    </option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <p className={styles.hint}>
                    You&apos;ll only get questions from the section you choose.
                  </p>
                </>
              )}
            </div>
          )}
        </fieldset>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={starting || (mode === "section" && !sectionId)}>
            {starting ? "Starting…" : "Start assessment"}
          </Button>
        </div>
      </form>
    </div>
  );
}
