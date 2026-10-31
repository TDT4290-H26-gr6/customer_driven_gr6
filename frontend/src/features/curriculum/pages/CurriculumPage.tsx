import { useEffect, useId, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { getCurriculum, removeQuestion, restoreQuestion } from "../api";
import { CompetencesPanel } from "../components/CompetencesPanel";
import { JourneysPanel } from "../components/JourneysPanel";
import { StructurePanel } from "../components/StructurePanel";
import { moduleLabel, QUESTION_TYPE_INFO, questionTypeLabel } from "../questionTypes";
import type { Curriculum, QuestionSummary, QuestionType } from "../types";
import styles from "./CurriculumPage.module.css";

type Tab = "questions" | "structure" | "journeys" | "competences";

/** The confirmation for removing a question: what will actually happen to it. */
function removeMessage(question: QuestionSummary): string {
  return question.answerCount > 0
    ? `Learners have answered this question ${question.answerCount} times, so it will be ` +
        "retired: it won't be asked any more, but past results keep it. You can restore it later."
    : "Nobody has answered this question, so it will be deleted for good.";
}

/**
 * The curriculum editor (admin): every question, grouped by section and
 * module, with filters; the sections and modules themselves; the learning
 * journeys; and the competences questions assess. Kept apart from the
 * assessment itself: adding and editing happen on their own page
 * (QuestionEditorPage). Removing a question someone answered retires it
 * instead of deleting it, so past results stay intact.
 */
export function CurriculumPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const tabsId = useId();
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // A save on another page (e.g. the journey editor) can send the admin back to its tab.
  const [tab, setTab] = useState<Tab>((location.state as { tab?: Tab } | null)?.tab ?? "questions");
  const [sectionId, setSectionId] = useState("");
  const [type, setType] = useState<QuestionType | "">("");
  const [search, setSearch] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  function load() {
    getCurriculum()
      .then(setCurriculum)
      .catch(() => setLoadFailed(true));
  }

  useEffect(load, []);

  const competenceName = useMemo(
    () => new Map(curriculum?.competences.map((c) => [c.id, c.name])),
    [curriculum],
  );

  if (loadFailed) {
    return (
      <div className={styles.page}>
        <p className={styles.error} role="alert">
          Could not load the curriculum.
        </p>
      </div>
    );
  }
  if (!curriculum) return <Spinner />;

  // A question is effectively removed when it, its module or its section is retired.
  const moduleRetired = new Map(
    curriculum.sections.flatMap((s) =>
      s.modules.map((m) => [m.id, s.retiredAt !== null || m.retiredAt !== null] as const),
    ),
  );
  const removed = (q: QuestionSummary) =>
    q.retiredAt !== null || moduleRetired.get(q.sectionModuleId) === true;

  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const filtering = type !== "" || words.length > 0;
  const shown = (q: QuestionSummary) =>
    (showRetired || !removed(q)) &&
    (type === "" || q.questionType === type) &&
    words.every((w) => q.prompt.toLowerCase().includes(w));

  const sections = curriculum.sections
    .filter((s) => sectionId === "" || s.id === sectionId)
    .filter((s) => showRetired || s.retiredAt === null)
    .map((section) => ({
      ...section,
      modules: section.modules
        .filter((m) => showRetired || m.retiredAt === null)
        .map((module) => ({
          ...module,
          questions: curriculum.questions.filter(
            (q) => q.sectionModuleId === module.id && shown(q),
          ),
        }))
        // While filtering, only modules with a match; otherwise every module, so empty ones show.
        .filter((module) => !filtering || module.questions.length > 0),
    }))
    .filter((section) => section.modules.length > 0);

  const inUse = curriculum.questions.filter((q) => !removed(q)).length;
  const retired = curriculum.questions.length - inUse;

  async function remove(question: QuestionSummary) {
    if (!window.confirm(removeMessage(question))) return;
    setBusyId(question.id);
    setError(null);
    try {
      const { result } = await removeQuestion(question.id);
      setNotice(result === "retired" ? "Question retired." : "Question deleted.");
      load();
    } catch {
      setError("Could not remove the question. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function restore(question: QuestionSummary) {
    setBusyId(question.id);
    setError(null);
    try {
      await restoreQuestion(question.id);
      setNotice("Question restored.");
      load();
    } catch {
      setError("Could not restore the question. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.heading}>Curriculum editor</h1>
        <Button variant="secondary" onClick={() => navigate("/admin")}>
          Back to admin mode
        </Button>
      </div>
      <p className={styles.subheading}>
        Add, change and remove what learners are assessed on and recommended: questions, sections
        and modules, learning journeys and competences. Changes take effect for learners straight
        away.
      </p>

      {notice && (
        <p className={styles.success} role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.tabs} role="tablist" aria-label="Curriculum">
        {(
          [
            ["questions", `Questions (${inUse})`],
            [
              "structure",
              `Sections & modules (${curriculum.sections.filter((s) => s.retiredAt === null).length})`,
            ],
            [
              "journeys",
              `Learning journeys (${curriculum.journeys.filter((j) => j.retiredAt === null).length})`,
            ],
            ["competences", `Competences (${curriculum.competences.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`${tabsId}-${value}`}
            aria-selected={tab === value}
            aria-controls={`${tabsId}-${value}-panel`}
            className={tab === value ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "structure" ? (
        <div
          role="tabpanel"
          id={`${tabsId}-structure-panel`}
          aria-labelledby={`${tabsId}-structure`}
        >
          <StructurePanel
            sections={curriculum.sections}
            competences={curriculum.competences}
            onChanged={(message) => {
              setNotice(message);
              load();
            }}
          />
        </div>
      ) : tab === "journeys" ? (
        <div role="tabpanel" id={`${tabsId}-journeys-panel`} aria-labelledby={`${tabsId}-journeys`}>
          <JourneysPanel
            journeys={curriculum.journeys}
            sections={curriculum.sections}
            onChanged={(message) => {
              setNotice(message);
              load();
            }}
          />
        </div>
      ) : tab === "competences" ? (
        <div
          role="tabpanel"
          id={`${tabsId}-competences-panel`}
          aria-labelledby={`${tabsId}-competences`}
        >
          <CompetencesPanel competences={curriculum.competences} onChanged={load} />
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`${tabsId}-questions-panel`}
          aria-labelledby={`${tabsId}-questions`}
          className={styles.panel}
        >
          <div className={styles.toolbar}>
            <div className={styles.filters}>
              <label className={styles.field}>
                <span className={styles.label}>Section</span>
                <select
                  className={styles.select}
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                >
                  <option value="">All sections</option>
                  {curriculum.sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {`${s.code ?? ""} ${s.name}`.trim()}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Question type</span>
                <select
                  className={styles.select}
                  value={type}
                  onChange={(e) => setType(e.target.value as QuestionType | "")}
                >
                  <option value="">All types</option>
                  {QUESTION_TYPE_INFO.map((info) => (
                    <option key={info.type} value={info.type}>
                      {info.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.label}>Search</span>
                <input
                  type="search"
                  className={styles.input}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Words in the question"
                />
              </label>
            </div>
            <div className={styles.toolbarActions}>
              {retired > 0 && (
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={showRetired}
                    onChange={(e) => setShowRetired(e.target.checked)}
                  />
                  Show removed questions ({retired})
                </label>
              )}
              <Button onClick={() => navigate("/admin/curriculum/questions/new")}>
                Add question
              </Button>
            </div>
          </div>

          {sections.length === 0 && <p className={styles.empty}>No questions match.</p>}

          {sections.map((section) => (
            <section key={section.id} className={styles.card} aria-label={section.name}>
              <h2 className={styles.cardHeading}>
                {`${section.code ?? ""} ${section.name}`.trim()}
              </h2>
              {section.modules.map((module) => (
                <div key={module.id} className={styles.module}>
                  <div className={styles.moduleHeader}>
                    <h3 className={styles.moduleName}>{moduleLabel(section.code, module)}</h3>
                    <Link
                      className={styles.textLink}
                      to={`/admin/curriculum/questions/new?module=${encodeURIComponent(module.id)}`}
                    >
                      + Add a question here
                    </Link>
                  </div>
                  {module.questions.length === 0 ? (
                    <p className={styles.empty}>No questions yet.</p>
                  ) : (
                    <ul className={styles.questionList}>
                      {module.questions.map((question) => (
                        <li
                          key={question.id}
                          className={
                            question.retiredAt
                              ? `${styles.question} ${styles.questionRetired}`
                              : styles.question
                          }
                        >
                          <div className={styles.questionText}>
                            <p className={styles.prompt}>{question.prompt}</p>
                            <p className={styles.meta}>
                              {questionTypeLabel(question.questionType)} ·{" "}
                              {competenceName.get(question.competenceId) ?? "Unknown competence"} ·{" "}
                              {question.answerCount === 0
                                ? "Not answered yet"
                                : `Answered ${question.answerCount} times`}
                              {removed(question) && (
                                <span className={styles.badge}>
                                  {question.retiredAt ? "Removed" : "In a removed module"}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className={styles.rowActions}>
                            {question.retiredAt ? (
                              <Button
                                variant="secondary"
                                onClick={() => void restore(question)}
                                disabled={busyId === question.id}
                              >
                                Restore
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="secondary"
                                  onClick={() =>
                                    navigate(`/admin/curriculum/questions/${question.id}`)
                                  }
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="danger"
                                  onClick={() => void remove(question)}
                                  disabled={busyId === question.id}
                                  aria-label={`Remove: ${question.prompt}`}
                                >
                                  Remove
                                </Button>
                              </>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
