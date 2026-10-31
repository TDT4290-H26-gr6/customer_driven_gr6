import { useEffect, useId, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PieQuestionPlayer } from "@/features/assessment";
import { isApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import {
  createCompetence,
  createQuestion,
  getCurriculum,
  getQuestion,
  previewQuestion,
  updateQuestion,
} from "../api";
import { LikertEditor } from "../components/LikertEditor";
import { OptionsEditor } from "../components/OptionsEditor";
import { convertContent, emptyContent, moduleLabel, QUESTION_TYPE_INFO } from "../questionTypes";
import type {
  AuthoredContent,
  Curriculum,
  PreviewContent,
  QuestionDetail,
  QuestionInput,
  QuestionType,
} from "../types";
import styles from "./CurriculumPage.module.css";

const DEFAULT_TYPE: QuestionType = "single_choice";

/** The message to show for a failed request: the server's own, when it gave one. */
function messageOf(err: unknown, fallback: string): string {
  return isApiError(err) && err.status >= 400 && err.status < 500 ? err.message : fallback;
}

/**
 * Adds or edits one question, of any question type, with a preview built
 * exactly as learners will see it. A question learners have answered keeps its
 * type (their answers are in that shape), and answers already saved keep their
 * score; the page says so. `?module=<id>` preselects the module for a new one.
 */
export function QuestionEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const formId = useId();

  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [original, setOriginal] = useState<QuestionDetail | null>(null);
  const [form, setForm] = useState<QuestionInput | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ content: PreviewContent; key: number } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [newCompetence, setNewCompetence] = useState<{ name: string; description: string } | null>(
    null,
  );
  const [competenceError, setCompetenceError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getCurriculum(), id ? getQuestion(id) : Promise.resolve(null)])
      .then(([loaded, question]) => {
        setCurriculum(loaded);
        setOriginal(question);
        if (question) {
          setForm({
            questionType: question.questionType,
            prompt: question.prompt,
            sectionModuleId: question.sectionModuleId,
            competenceId: question.competenceId,
            content: question.authoredContent ?? emptyContent(question.questionType),
          });
          return;
        }
        const modules = loaded.sections
          .filter((s) => s.retiredAt === null)
          .flatMap((s) => s.modules.filter((m) => m.retiredAt === null));
        const module = modules.find((m) => m.id === searchParams.get("module")) ?? modules[0];
        setForm({
          questionType: DEFAULT_TYPE,
          prompt: "",
          sectionModuleId: module?.id ?? "",
          competenceId: module?.mainCompetenceId ?? "",
          content: emptyContent(DEFAULT_TYPE),
        });
      })
      .catch(() => setLoadFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loadFailed) {
    return (
      <div className={styles.page}>
        <p className={styles.error} role="alert">
          Could not load the question. It may have been deleted.
        </p>
        <div>
          <Link to="/admin/curriculum">Back to the curriculum editor</Link>
        </div>
      </div>
    );
  }
  if (!curriculum || !form) return <Spinner />;

  const answered = (original?.answerCount ?? 0) > 0;
  const modules = curriculum.sections.flatMap((s) => s.modules);
  const typeInfo = QUESTION_TYPE_INFO.find((t) => t.type === form.questionType);

  function update(changes: Partial<QuestionInput>) {
    setForm((prev) => (prev ? { ...prev, ...changes } : prev));
    setPreview(null);
  }

  function setContent(content: AuthoredContent) {
    update({ content });
  }

  function changeModule(moduleId: string) {
    const previous = modules.find((m) => m.id === form?.sectionModuleId);
    const next = modules.find((m) => m.id === moduleId);
    // Follow the module's main competence, unless one was picked on purpose.
    const followsModule = !form?.competenceId || form.competenceId === previous?.mainCompetenceId;
    update({
      sectionModuleId: moduleId,
      ...(followsModule && next ? { competenceId: next.mainCompetenceId } : {}),
    });
  }

  function changeType(questionType: QuestionType) {
    if (!form) return;
    update({ questionType, content: convertContent(form.content, questionType) });
  }

  async function addCompetence() {
    if (!newCompetence) return;
    setCompetenceError(null);
    try {
      const created = await createCompetence({
        name: newCompetence.name,
        description: newCompetence.description.trim() || null,
      });
      setCurriculum((prev) =>
        prev
          ? {
              ...prev,
              competences: [...prev.competences, { ...created, questionCount: 0, moduleCount: 0 }],
            }
          : prev,
      );
      update({ competenceId: created.id });
      setNewCompetence(null);
    } catch (err) {
      setCompetenceError(messageOf(err, "Could not add the competence. Try again."));
    }
  }

  async function showPreview() {
    if (!form) return;
    setPreviewError(null);
    try {
      const { content } = await previewQuestion(form);
      setPreview((prev) => ({ content, key: (prev?.key ?? 0) + 1 }));
    } catch (err) {
      setPreview(null);
      setPreviewError(messageOf(err, "Could not build the preview. Try again."));
    }
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      if (id) await updateQuestion(id, form);
      else await createQuestion(form);
      navigate("/admin/curriculum", {
        state: { notice: id ? "Changes saved." : "Question added." },
      });
    } catch (err) {
      setError(messageOf(err, "Could not save the question. Try again."));
      setSaving(false);
    }
  }

  const content = form.content;
  const options = content.options ?? [];
  const correctIds = content.correctOptionIds ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.heading}>{id ? "Edit question" : "Add a question"}</h1>
        <Link className={styles.backLink} to="/admin/curriculum">
          Back to the curriculum editor
        </Link>
      </div>

      {original?.retiredAt && (
        <p className={styles.notice}>
          This question is removed: learners aren&apos;t asked it. Restore it from the list to use
          it again.
        </p>
      )}
      {answered && (
        <p className={styles.notice}>
          Learners have answered this question {original?.answerCount} times. Changes apply to new
          answers; answers already saved keep their score. Its type can&apos;t change: to ask
          something different, remove it and add a new question.
        </p>
      )}
      {original && !original.editable && (
        <p className={styles.error} role="alert">
          This question was loaded before the editor existed and has no editable form yet. Restart
          the app (db-init fills it in), then try again.
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
        <h2 className={styles.cardHeading}>Where it belongs</h2>
        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.label}>Section and module</span>
            <select
              className={styles.select}
              value={form.sectionModuleId}
              onChange={(e) => changeModule(e.target.value)}
              required
            >
              {/* Only modules in use, plus the question's own if it's been removed. */}
              {curriculum.sections.map((section) => {
                const usable = section.modules.filter(
                  (m) =>
                    (m.retiredAt === null && section.retiredAt === null) ||
                    m.id === original?.sectionModuleId,
                );
                if (usable.length === 0) return null;
                return (
                  <optgroup key={section.id} label={`${section.code ?? ""} ${section.name}`.trim()}>
                    {usable.map((module) => (
                      <option key={module.id} value={module.id}>
                        {moduleLabel(section.code, module)}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Competence it assesses</span>
            <select
              className={styles.select}
              value={form.competenceId}
              onChange={(e) => update({ competenceId: e.target.value })}
              required
            >
              {curriculum.competences.map((competence) => (
                <option key={competence.id} value={competence.id}>
                  {competence.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {newCompetence ? (
          <div className={styles.subForm}>
            <label className={styles.field}>
              <span className={styles.label}>New competence name</span>
              <input
                className={styles.input}
                value={newCompetence.name}
                onChange={(e) => setNewCompetence({ ...newCompetence, name: e.target.value })}
                maxLength={191}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Description (optional)</span>
              <input
                className={styles.input}
                value={newCompetence.description}
                onChange={(e) =>
                  setNewCompetence({ ...newCompetence, description: e.target.value })
                }
                maxLength={2000}
              />
            </label>
            {competenceError && (
              <p className={styles.error} role="alert">
                {competenceError}
              </p>
            )}
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={() => setNewCompetence(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void addCompetence()}
                disabled={!newCompetence.name.trim()}
              >
                Add competence
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => setNewCompetence({ name: "", description: "" })}
            >
              + New competence
            </button>
          </div>
        )}

        <h2 className={styles.cardHeading}>The question</h2>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${formId}-type`}>
            Question type
          </label>
          <select
            id={`${formId}-type`}
            className={styles.select}
            value={form.questionType}
            onChange={(e) => changeType(e.target.value as QuestionType)}
            disabled={answered}
            aria-describedby={`${formId}-type-hint`}
          >
            {QUESTION_TYPE_INFO.map((info) => (
              <option key={info.type} value={info.type}>
                {info.label}
              </option>
            ))}
          </select>
          {typeInfo && (
            <span id={`${formId}-type-hint`} className={styles.hint}>
              {typeInfo.hint}
            </span>
          )}
        </div>
        <label className={styles.field}>
          <span className={styles.label}>Question</span>
          <textarea
            className={styles.textarea}
            value={form.prompt}
            onChange={(e) => update({ prompt: e.target.value })}
            rows={3}
            maxLength={2000}
            required
          />
        </label>

        {form.questionType === "criteria_check" && (
          <label className={styles.field}>
            <span className={styles.label}>The example the learner judges</span>
            <textarea
              className={`${styles.textarea} ${styles.mono}`}
              value={content.exhibit ?? ""}
              onChange={(e) => setContent({ ...content, exhibit: e.target.value })}
              rows={6}
              maxLength={5000}
              placeholder={"e.g. a README:\nREADME.md\nLicence: CC BY 4.0"}
            />
          </label>
        )}

        {form.questionType === "likert" ? (
          <LikertEditor
            scale={content.scale ?? { min: 1, max: 5 }}
            onChange={(scale) => setContent({ scale })}
          />
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>
              {form.questionType === "ordering"
                ? "Items, in the correct order"
                : form.questionType === "criteria_check"
                  ? "Criteria"
                  : "Options"}
            </span>
            <OptionsEditor
              options={options}
              correctIds={correctIds}
              mode={
                form.questionType === "ordering"
                  ? "order"
                  : form.questionType === "multi_choice" || form.questionType === "criteria_check"
                    ? "multi"
                    : "single"
              }
              fixed={form.questionType === "true_false"}
              noun={
                form.questionType === "criteria_check"
                  ? "Criterion"
                  : form.questionType === "ordering"
                    ? "Item"
                    : "Option"
              }
              onChange={(nextOptions, nextCorrect) =>
                setContent(
                  form.questionType === "ordering"
                    ? { options: nextOptions }
                    : { ...content, options: nextOptions, correctOptionIds: nextCorrect },
                )
              }
            />
          </div>
        )}
        {form.questionType !== "ordering" && (
          <p className={styles.hint}>
            Every question also gets an &quot;I don&apos;t know&quot; option automatically.
          </p>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={() => void showPreview()}>
            Preview
          </Button>
          <span className={styles.spacer} />
          <Button type="submit" disabled={saving || (original !== null && !original.editable)}>
            {saving ? "Saving…" : id ? "Save changes" : "Add question"}
          </Button>
        </div>
      </form>

      {(preview || previewError) && (
        <section className={styles.card} aria-labelledby={`${formId}-preview`}>
          <h2 id={`${formId}-preview`} className={styles.cardHeading}>
            Preview: what learners see
          </h2>
          {previewError ? (
            <p className={styles.error} role="alert">
              {previewError}
            </p>
          ) : (
            preview && <PieQuestionPlayer key={preview.key} content={preview.content} />
          )}
        </section>
      )}
    </div>
  );
}
