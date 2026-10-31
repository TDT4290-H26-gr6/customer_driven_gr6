import { useState } from "react";
import { isApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { modulesApi, sectionsApi } from "../api";
import { moduleLabel, plural } from "../questionTypes";
import type {
  CurriculumCompetence,
  CurriculumModule,
  CurriculumSection,
  ModuleInput,
  SectionInput,
} from "../types";
import { ModuleForm } from "./ModuleForm";
import { SectionForm } from "./SectionForm";
import styles from "../pages/CurriculumPage.module.css";

type Props = {
  sections: CurriculumSection[];
  competences: CurriculumCompetence[];
  /** Called after a change, with what to tell the admin, so the page reloads. */
  onChanged: (notice: string) => void;
};

type Editing =
  | { kind: "newSection" }
  | { kind: "section"; id: string }
  | { kind: "newModule"; sectionId: string }
  | { kind: "module"; id: string };

/** A section can only be deleted when nothing points at it; otherwise it's retired. */
function sectionIsEmpty(section: CurriculumSection) {
  return section.modules.length === 0 && section.journeyCount === 0 && !section.usedInAssessments;
}

function removeSectionMessage(section: CurriculumSection): string {
  if (sectionIsEmpty(section)) return "This section is empty, so it will be deleted for good.";
  const journeys =
    section.journeyCount > 0
      ? ` ${section.journeyCount} learning ${section.journeyCount === 1 ? "journey covers" : "journeys cover"} it.`
      : "";
  return (
    "This section will be retired: its modules and questions are no longer asked or " +
    `recommended, but past results keep them, and you can restore it later.${journeys}`
  );
}

function removeModuleMessage(module: CurriculumModule): string {
  return module.questionCount === 0
    ? "This module has no questions, so it will be deleted for good."
    : `This module will be retired: its ${plural(module.questionCount, "question")} are no longer asked, ` +
        "but past results keep them, and you can restore it later.";
}

function errorMessage(err: unknown): string {
  return isApiError(err) && err.status >= 400 && err.status < 500
    ? err.message
    : "Could not save. Try again.";
}

/**
 * The curriculum's structure: sections and the modules in them. Add, edit,
 * move, remove and restore both. Removing deletes only what's empty; anything
 * in use is retired, so past results keep it.
 */
export function StructurePanel({ sections, competences, onChanged }: Props) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showRetired, setShowRetired] = useState(false);

  const inUseSections = sections.filter((s) => s.retiredAt === null);
  const retiredCount =
    sections.filter((s) => s.retiredAt !== null).length +
    sections.flatMap((s) => s.modules).filter((m) => m.retiredAt !== null).length;
  const shownSections = showRetired ? sections : inUseSections;

  function startEditing(next: Editing) {
    setEditing(next);
    setFormError(null);
  }

  async function save(run: () => Promise<unknown>, notice: string) {
    setSaving(true);
    setFormError(null);
    try {
      await run();
      setEditing(null);
      onChanged(notice);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  /** Runs a remove or restore; `run` returns what to tell the admin. */
  async function act(run: () => Promise<string>) {
    setActionError(null);
    try {
      onChanged(await run());
    } catch {
      setActionError("Could not make that change. Try again.");
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <p className={styles.hint}>
          Sections hold modules, and modules hold the questions. A module&apos;s level decides when
          the adaptive assessment asks it. Changes take effect for learners straight away.
        </p>
        <div className={styles.toolbarActions}>
          {retiredCount > 0 && (
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={showRetired}
                onChange={(e) => setShowRetired(e.target.checked)}
              />
              Show removed sections and modules ({retiredCount})
            </label>
          )}
          <Button onClick={() => startEditing({ kind: "newSection" })}>Add section</Button>
        </div>
      </div>

      {actionError && (
        <p className={styles.error} role="alert">
          {actionError}
        </p>
      )}

      {editing?.kind === "newSection" && (
        <SectionForm
          heading="New section"
          error={formError}
          saving={saving}
          onCancel={() => setEditing(null)}
          onSave={(input: SectionInput) =>
            void save(() => sectionsApi.create(input), "Section added.")
          }
        />
      )}

      {shownSections.map((section) => {
        const retired = section.retiredAt !== null;
        const modules = showRetired
          ? section.modules
          : section.modules.filter((m) => m.retiredAt === null);
        return (
          <section key={section.id} className={styles.card} aria-label={section.name}>
            {editing?.kind === "section" && editing.id === section.id ? (
              <SectionForm
                heading={`Edit ${section.name}`}
                initial={{
                  code: section.code,
                  name: section.name,
                  description: section.description,
                }}
                error={formError}
                saving={saving}
                onCancel={() => setEditing(null)}
                onSave={(input) =>
                  void save(() => sectionsApi.update(section.id, input), "Section saved.")
                }
              />
            ) : (
              <div className={styles.moduleHeader}>
                <div className={styles.questionText}>
                  <h2 className={styles.cardHeading}>
                    {`${section.code ?? ""} ${section.name}`.trim()}
                    {retired && <span className={styles.badge}>Removed</span>}
                  </h2>
                  {section.description && <p className={styles.meta}>{section.description}</p>}
                </div>
                <div className={styles.rowActions}>
                  {retired ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void act(async () => {
                          await sectionsApi.restore(section.id);
                          return "Section restored.";
                        })
                      }
                      aria-label={`Restore ${section.name}`}
                    >
                      Restore
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => startEditing({ kind: "section", id: section.id })}
                        aria-label={`Edit ${section.name}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (!window.confirm(removeSectionMessage(section))) return;
                          void act(async () => {
                            const { result } = await sectionsApi.remove(section.id);
                            return result === "retired" ? "Section retired." : "Section deleted.";
                          });
                        }}
                        aria-label={`Remove ${section.name}`}
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {modules.length === 0 && <p className={styles.empty}>No modules yet.</p>}
            {modules.length > 0 && (
              <ul className={styles.questionList}>
                {modules.map((module) => {
                  const moduleRetired = module.retiredAt !== null;
                  if (editing?.kind === "module" && editing.id === module.id) {
                    return (
                      <li key={module.id}>
                        <ModuleForm
                          heading={`Edit ${module.name}`}
                          initial={{
                            name: module.name,
                            description: module.description,
                            sectionId: section.id,
                            level: module.level,
                            mainCompetenceId: module.mainCompetenceId,
                            secondaryCompetenceIds: module.secondaryCompetenceIds,
                            moodleUrl: module.moodleUrl,
                          }}
                          questionCount={module.questionCount}
                          sections={inUseSections}
                          competences={competences}
                          error={formError}
                          saving={saving}
                          onCancel={() => setEditing(null)}
                          onSave={(input: ModuleInput) =>
                            void save(() => modulesApi.update(module.id, input), "Module saved.")
                          }
                        />
                      </li>
                    );
                  }
                  const competence = competences.find((c) => c.id === module.mainCompetenceId);
                  return (
                    <li
                      key={module.id}
                      className={
                        moduleRetired
                          ? `${styles.question} ${styles.questionRetired}`
                          : styles.question
                      }
                    >
                      <div className={styles.questionText}>
                        <p className={styles.prompt}>{moduleLabel(section.code, module)}</p>
                        <p className={styles.meta}>
                          {competence?.name ?? "Unknown competence"}
                          {module.secondaryCompetenceIds.length > 0 &&
                            ` (+${module.secondaryCompetenceIds.length} secondary)`}{" "}
                          · {plural(module.questionCount, "question")}
                          {module.moodleUrl && (
                            <>
                              {" · "}
                              <a href={module.moodleUrl} target="_blank" rel="noopener noreferrer">
                                Moodle page
                              </a>
                            </>
                          )}
                          {moduleRetired && <span className={styles.badge}>Removed</span>}
                        </p>
                      </div>
                      <div className={styles.rowActions}>
                        {moduleRetired ? (
                          <Button
                            variant="secondary"
                            onClick={() =>
                              void act(async () => {
                                await modulesApi.restore(module.id);
                                return "Module restored.";
                              })
                            }
                            aria-label={`Restore ${module.name}`}
                          >
                            Restore
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="secondary"
                              onClick={() => startEditing({ kind: "module", id: module.id })}
                              aria-label={`Edit ${module.name}`}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => {
                                if (!window.confirm(removeModuleMessage(module))) return;
                                void act(async () => {
                                  const { result } = await modulesApi.remove(module.id);
                                  return result === "retired"
                                    ? "Module retired."
                                    : "Module deleted.";
                                });
                              }}
                              aria-label={`Remove ${module.name}`}
                            >
                              Remove
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {!retired &&
              (editing?.kind === "newModule" && editing.sectionId === section.id ? (
                <ModuleForm
                  isNew
                  heading={`New module in ${section.name}`}
                  initial={{
                    name: "",
                    description: null,
                    sectionId: section.id,
                    // The next level after the section's highest.
                    level: Math.max(0, ...section.modules.map((m) => m.level ?? 0)) + 1,
                    mainCompetenceId: competences[0]?.id ?? "",
                    secondaryCompetenceIds: [],
                    moodleUrl: null,
                  }}
                  sections={inUseSections}
                  competences={competences}
                  error={formError}
                  saving={saving}
                  onCancel={() => setEditing(null)}
                  onSave={(input) => void save(() => modulesApi.create(input), "Module added.")}
                />
              ) : (
                <div>
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => startEditing({ kind: "newModule", sectionId: section.id })}
                  >
                    + Add a module to {section.name}
                  </button>
                </div>
              ))}
          </section>
        );
      })}
    </div>
  );
}
