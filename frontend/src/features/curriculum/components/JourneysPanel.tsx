import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/Button";
import { journeysApi } from "../api";
import { COVERAGE_INFO, plural } from "../questionTypes";
import type { CurriculumJourney, CurriculumSection } from "../types";
import { ChangeHistory } from "./ChangeHistory";
import styles from "../pages/CurriculumPage.module.css";

type Props = {
  journeys: CurriculumJourney[];
  sections: CurriculumSection[];
  /** Called after a change, with what to tell the admin, so the page reloads. */
  onChanged: (notice: string) => void;
};

function removeMessage(journey: CurriculumJourney): string {
  return journey.used
    ? "Learners have been recommended, assessed on or completed this journey, so it will be " +
        "retired: it's no longer listed or recommended, but their advice, history and results keep " +
        "it, and you can restore it later."
    : "Nothing refers to this journey yet, so it will be deleted for good, with its steps.";
}

/**
 * The learning journeys: what each covers (M / R / S per section), its steps
 * and Moodle link. Adding and editing happen on their own page
 * (JourneyEditorPage). Removing retires a journey anything refers to.
 */
export function JourneysPanel({ journeys, sections, onChanged }: Props) {
  const navigate = useNavigate();
  const [showRetired, setShowRetired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sectionLabel = new Map(sections.map((s) => [s.id, `${s.code ?? ""} ${s.name}`.trim()]));
  const retiredCount = journeys.filter((j) => j.retiredAt !== null).length;
  const shown = showRetired ? journeys : journeys.filter((j) => j.retiredAt === null);

  async function act(run: () => Promise<string>) {
    setError(null);
    try {
      onChanged(await run());
    } catch {
      setError("Could not make that change. Try again.");
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <p className={styles.hint}>
          A journey is recommended for the sections it covers: best for the ones it&apos;s centred
          on (M), then those it covers well (R) or touches (S). Assessing a journey asks about its M
          sections.
        </p>
        <div className={styles.toolbarActions}>
          {retiredCount > 0 && (
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={showRetired}
                onChange={(e) => setShowRetired(e.target.checked)}
              />
              Show removed journeys ({retiredCount})
            </label>
          )}
          <Button onClick={() => navigate("/admin/curriculum/journeys/new")}>Add journey</Button>
        </div>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {shown.length === 0 && <p className={styles.empty}>No learning journeys yet.</p>}

      {shown.map((journey) => {
        const retired = journey.retiredAt !== null;
        return (
          <section key={journey.id} className={styles.card} aria-label={journey.name}>
            <div className={styles.moduleHeader}>
              <div className={styles.questionText}>
                <h2 className={styles.cardHeading}>
                  {journey.name}
                  {retired && <span className={styles.badge}>Removed</span>}
                </h2>
                {journey.description && <p className={styles.meta}>{journey.description}</p>}
                <ChangeHistory history={journey.history} />
              </div>
              <div className={styles.rowActions}>
                {retired ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void act(async () => {
                        await journeysApi.restore(journey.id);
                        return "Journey restored.";
                      })
                    }
                    aria-label={`Restore ${journey.name}`}
                  >
                    Restore
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => navigate(`/admin/curriculum/journeys/${journey.id}`)}
                      aria-label={`Edit ${journey.name}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (!window.confirm(removeMessage(journey))) return;
                        void act(async () => {
                          const { result } = await journeysApi.remove(journey.id);
                          return result === "retired" ? "Journey retired." : "Journey deleted.";
                        });
                      }}
                      aria-label={`Remove ${journey.name}`}
                    >
                      Remove
                    </Button>
                  </>
                )}
              </div>
            </div>

            <dl className={styles.coverage}>
              {COVERAGE_INFO.map(({ level, label }) => {
                const covered = journey.sections.filter((s) => s.coverageLevel === level);
                if (covered.length === 0) return null;
                return (
                  <div key={level} className={styles.coverageRow}>
                    <dt>
                      {label} ({level})
                    </dt>
                    <dd>
                      {covered
                        .map((s) => sectionLabel.get(s.sectionId) ?? "Unknown section")
                        .join(", ")}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className={styles.meta}>
              {plural(journey.steps.length, "step")}
              {journey.moodleUrl && (
                <>
                  {" · "}
                  <a href={journey.moodleUrl} target="_blank" rel="noopener noreferrer">
                    Moodle page
                  </a>
                </>
              )}
            </p>
          </section>
        );
      })}
    </div>
  );
}
