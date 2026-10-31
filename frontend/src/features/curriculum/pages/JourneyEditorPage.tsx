import { useEffect, useId, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { getCurriculum, journeysApi } from "../api";
import { COVERAGE_INFO } from "../questionTypes";
import type { CoverageLevel, Curriculum, CurriculumJourney, JourneyInput } from "../types";
import styles from "./CurriculumPage.module.css";

type Step = JourneyInput["steps"][number] & { key: string };

const MAX_STEPS = 30;

/** A step's key while editing: its id, or a made-up one for a new step. */
let nextKey = 0;
const newKey = () => `new-${++nextKey}`;

/**
 * Adds or edits a learning journey: its name, description and Moodle link,
 * which sections it covers and how strongly (M / R / S), and its steps.
 * Coverage decides who it's recommended to and what assessing it asks about.
 */
export function JourneyEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const formId = useId();

  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [original, setOriginal] = useState<CurriculumJourney | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [moodleUrl, setMoodleUrl] = useState("");
  const [coverage, setCoverage] = useState<Record<string, CoverageLevel>>({});
  const [steps, setSteps] = useState<Step[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCurriculum()
      .then((loaded) => {
        const journey = id ? loaded.journeys.find((j) => j.id === id) : undefined;
        if (id && !journey) {
          setLoadFailed(true);
          return;
        }
        setCurriculum(loaded);
        if (!journey) return;
        setOriginal(journey);
        setName(journey.name);
        setDescription(journey.description ?? "");
        setMoodleUrl(journey.moodleUrl ?? "");
        setCoverage(
          Object.fromEntries(journey.sections.map((s) => [s.sectionId, s.coverageLevel])),
        );
        setSteps(journey.steps.map((s) => ({ ...s, key: s.id })));
      })
      .catch(() => setLoadFailed(true));
  }, [id]);

  if (loadFailed) {
    return (
      <div className={styles.page}>
        <p className={styles.error} role="alert">
          Could not load the journey. It may have been deleted.
        </p>
        <div>
          <Link to="/admin/curriculum">Back to the curriculum editor</Link>
        </div>
      </div>
    );
  }
  if (!curriculum) return <Spinner />;

  // Sections in use, plus any removed one this journey already covers.
  const sections = curriculum.sections.filter((s) => s.retiredAt === null || coverage[s.id]);

  function setLevel(sectionId: string, level: CoverageLevel | "") {
    setCoverage((prev) => {
      const next = { ...prev };
      if (level) next[sectionId] = level;
      else delete next[sectionId];
      return next;
    });
  }

  function updateStep(index: number, changes: Partial<Step>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...changes } : s)));
  }

  function moveStep(index: number, by: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const input: JourneyInput = {
      name,
      description: description.trim() || null,
      moodleUrl: moodleUrl.trim() || null,
      sections: Object.entries(coverage).map(([sectionId, coverageLevel]) => ({
        sectionId,
        coverageLevel,
      })),
      steps: steps.map(({ key: _key, ...step }) => step),
    };
    try {
      if (id) await journeysApi.update(id, input);
      else await journeysApi.create(input);
      navigate("/admin/curriculum", {
        state: { notice: id ? "Journey saved." : "Journey added.", tab: "journeys" },
      });
    } catch (err) {
      setError(
        isApiError(err) && err.status >= 400 && err.status < 500
          ? err.message
          : "Could not save the journey. Try again.",
      );
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.heading}>
          {id ? "Edit learning journey" : "Add a learning journey"}
        </h1>
        <Link className={styles.backLink} to="/admin/curriculum">
          Back to the curriculum editor
        </Link>
      </div>

      {original?.used && (
        <p className={styles.notice}>
          Learners have been recommended, assessed on or completed this journey. Changes apply from
          now on; their past advice, history and results keep what they were given.
        </p>
      )}

      <form
        id={formId}
        className={styles.card}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h2 className={styles.cardHeading}>About the journey</h2>
        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={191}
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Description (optional)</span>
          <span className={styles.hint}>
            Say who it&apos;s for: the AI advisor matches journeys to learners&apos; roles by it.
          </span>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={5000}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Link to its page in Moodle (optional)</span>
          <input
            type="url"
            className={styles.input}
            value={moodleUrl}
            onChange={(e) => setMoodleUrl(e.target.value)}
            maxLength={512}
            placeholder="https://moodle…"
          />
        </label>

        <h2 className={styles.cardHeading}>Sections it covers</h2>
        <p className={styles.hint}>
          {COVERAGE_INFO.map((c) => `${c.label} (${c.level}): ${c.hint}`).join(" ")} At least one
          section must be Main.
        </p>
        <ul className={styles.questionList}>
          {sections.map((section) => (
            <li key={section.id} className={styles.coverageEdit}>
              <span className={styles.prompt}>
                {`${section.code ?? ""} ${section.name}`.trim()}
                {section.retiredAt && <span className={styles.badge}>Removed</span>}
              </span>
              <select
                className={styles.select}
                value={coverage[section.id] ?? ""}
                onChange={(e) => setLevel(section.id, e.target.value as CoverageLevel | "")}
                aria-label={`Coverage of ${section.name}`}
              >
                <option value="">Not covered</option>
                {COVERAGE_INFO.map((c) => (
                  <option key={c.level} value={c.level}>
                    {c.label} ({c.level})
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>

        <h2 className={styles.cardHeading}>Steps</h2>
        <p className={styles.hint}>
          What a learner does, in order. Link a step to a learning resource when there is one.
        </p>
        {steps.length === 0 && <p className={styles.empty}>No steps yet.</p>}
        <ol className={styles.stepList}>
          {steps.map((step, index) => {
            const label = `Step ${index + 1}`;
            return (
              <li key={step.key} className={styles.subForm}>
                <div className={styles.moduleHeader}>
                  <span className={styles.label}>{label}</span>
                  <span className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => moveStep(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${label.toLowerCase()} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => moveStep(index, 1)}
                      disabled={index === steps.length - 1}
                      aria-label={`Move ${label.toLowerCase()} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => setSteps((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={`Remove ${label.toLowerCase()}`}
                    >
                      ×
                    </button>
                  </span>
                </div>
                <div className={styles.fields}>
                  <label className={styles.field}>
                    <span className={styles.label}>Title</span>
                    <input
                      className={styles.input}
                      value={step.title}
                      onChange={(e) => updateStep(index, { title: e.target.value })}
                      maxLength={191}
                      aria-label={`${label} title`}
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Learning resource (optional)</span>
                    <select
                      className={styles.select}
                      value={step.sourceId ?? ""}
                      onChange={(e) => updateStep(index, { sourceId: e.target.value || null })}
                      aria-label={`${label} learning resource`}
                    >
                      <option value="">None</option>
                      {curriculum.sources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.courseName} ({source.institution})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className={styles.field}>
                  <span className={styles.label}>Description (optional)</span>
                  <textarea
                    className={styles.textarea}
                    value={step.description ?? ""}
                    onChange={(e) => updateStep(index, { description: e.target.value || null })}
                    rows={2}
                    maxLength={5000}
                    aria-label={`${label} description`}
                  />
                </label>
              </li>
            );
          })}
        </ol>
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setSteps((prev) => [
                ...prev,
                { id: null, title: "", description: null, sourceId: null, key: newKey() },
              ])
            }
            disabled={steps.length >= MAX_STEPS}
          >
            Add step
          </Button>
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <span className={styles.spacer} />
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Saving…" : id ? "Save changes" : "Add journey"}
          </Button>
        </div>
      </form>
    </div>
  );
}
