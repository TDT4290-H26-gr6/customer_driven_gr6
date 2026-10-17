import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { DATE_FORMAT } from "@/shared/lib/format";
import { getCompetencies } from "../api";
import { BAND_LABEL, scoreBand } from "../scoreBand";
import type { BestResult, Competencies, CompetencyModule } from "../types";
import styles from "./CompetenciesPage.module.css";

/** Where a best result came from: "Self-assessment, 3 Oct 2026" or "LJ2 … assessment, 5 Oct 2026". */
function sourceOf(best: BestResult): string {
  const date = DATE_FORMAT.format(new Date(best.completedAt));
  return best.kind === "journey" && best.journeyName
    ? `${best.journeyName} assessment, ${date}`
    : `Self-assessment, ${date}`;
}

/** Each section's own colour (A–E), from the AIOS logo palette; see the CSS. */
function hueClass(code: string | null | undefined): string {
  const letter = code?.[0]?.toUpperCase();
  return letter && "ABCDE".includes(letter) ? styles[`hue${letter}`] : "";
}

function Bar({ percent }: { percent: number }) {
  return (
    <span className={`${styles.bar} ${styles[scoreBand(percent)]}`} aria-hidden="true">
      <span className={styles.barFill} style={{ width: `${percent}%` }} />
    </span>
  );
}

/** A section's percentage as a ring, in its score colour. */
function Ring({ percent }: { percent: number | null }) {
  if (percent === null) {
    return (
      <span className={styles.ring} role="img" aria-label="Not assessed yet">
        <span className={styles.ringValue}>-</span>
      </span>
    );
  }
  const band = scoreBand(percent);
  return (
    <span
      className={`${styles.ring} ${styles[band]}`}
      style={{ "--p": percent } as CSSProperties}
      role="img"
      aria-label={`${percent}%, ${BAND_LABEL[band].toLowerCase()}`}
    >
      <span className={styles.ringValue}>{percent}%</span>
    </span>
  );
}

function ModuleRow({ module }: { module: CompetencyModule }) {
  return (
    <li className={styles.module}>
      <span className={`${styles.moduleCode} ${hueClass(module.code)}`}>{module.code ?? "-"}</span>
      <div className={styles.moduleMain}>
        <span className={styles.moduleName}>{module.name}</span>
        {/* Status and Moodle link share a row (wrapping when narrow) to keep rows short. */}
        <span className={styles.moduleMeta}>
          {module.best ? (
            <span className={styles.muted}>Best: {sourceOf(module.best)}</span>
          ) : (
            <span className={styles.muted}>Not assessed yet</span>
          )}
          {module.moodleUrl && (
            <a
              className={styles.moodleLink}
              href={module.moodleUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Moodle ↗
            </a>
          )}
        </span>
      </div>
      {module.best && (
        <span className={`${styles.modulePercent} ${styles[scoreBand(module.best.percent)]}`}>
          <strong className={styles.scoreValue}>{module.best.percent}%</strong>
          <span className={styles.bandLabel}>{BAND_LABEL[scoreBand(module.best.percent)]}</span>
          <Bar percent={module.best.percent} />
        </span>
      )}
    </li>
  );
}

/**
 * How competent the learner is, module by module: each module's best result
 * over ALL their assessments — the self-assessment and any journey
 * assessments — and a percentage per section (the average of its modules'
 * best results). The main self-assessment's own results are never changed
 * by this. The modules of the journey recommended after the self-assessment
 * come first, in their own card, so the most relevant ones are on top.
 */
export function CompetenciesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Competencies | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    getCompetencies()
      .then(setData)
      .catch(() => setLoadFailed(true));
  }, []);

  if (loadFailed) {
    return (
      <div className={styles.page} data-backdrop="logo">
        <h1 className={styles.heading}>Competencies</h1>
        <p className={styles.note}>
          Couldn&apos;t load your competencies right now. Please try again.
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className={styles.page} data-backdrop="logo">
        <Spinner />
      </div>
    );
  }

  const relevantModules = data.sections.flatMap((s) => s.modules.filter((m) => m.relevant));
  const anyResult = data.sections.some((s) => s.assessedModules > 0);

  return (
    <div className={styles.page} data-backdrop="logo">
      <h1 className={styles.heading}>Competencies</h1>
      <p className={styles.subheading}>
        Your best result in each module, across the self-assessment and any journeys you&apos;ve
        assessed.
      </p>

      {!anyResult && (
        <p className={styles.note}>
          No results yet. Take the self-assessment, or assess a learning journey, to see your
          competencies here.
        </p>
      )}

      {data.recommendedJourney && relevantModules.length > 0 && (
        <section className={styles.relevantCard} aria-labelledby="relevant-heading">
          <div className={styles.relevantHeader}>
            <div className={styles.relevantIntro}>
              <p className={styles.eyebrow}>Most relevant for you</p>
              <h2 id="relevant-heading" className={styles.cardHeading}>
                {data.recommendedJourney.name}
              </h2>
              <p className={styles.muted}>
                The modules this journey focuses on, recommended after your self-assessment.
              </p>
            </div>
            <Button variant="secondary" onClick={() => navigate("/journeys")}>
              Assess this journey
            </Button>
          </div>
          {/* Two or three columns, as many as fit; each module is its own tile. */}
          <ul className={`${styles.modules} ${styles.relevantModules}`}>
            {relevantModules.map((module) => (
              <ModuleRow key={module.id} module={module} />
            ))}
          </ul>
        </section>
      )}

      <div className={styles.sections}>
        {data.sections.map((section) => (
          <section
            key={section.id}
            className={`${styles.card} ${styles.sectionCard} ${hueClass(section.code)}`}
            aria-labelledby={`section-${section.id}`}
          >
            <div className={styles.sectionHeader}>
              <span className={styles.sectionCode}>{section.code ?? "-"}</span>
              <div className={styles.sectionTitle}>
                <h2 id={`section-${section.id}`} className={styles.cardHeading}>
                  {section.name}
                </h2>
                <p className={styles.muted}>
                  {section.assessedModules} of {section.moduleCount} modules assessed
                </p>
              </div>
              <Ring percent={section.percent} />
            </div>
            <ul className={styles.modules}>
              {section.modules.map((module) => (
                <ModuleRow key={module.id} module={module} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
