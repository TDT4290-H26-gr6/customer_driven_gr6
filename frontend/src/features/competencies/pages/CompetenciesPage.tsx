import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { DATE_FORMAT } from "@/shared/lib/format";
import { getCompetencies } from "../api";
import type { BestResult, Competencies, CompetencyModule } from "../types";
import styles from "./CompetenciesPage.module.css";

/** Where a best result came from: "Self-assessment, 3 Oct 2026" or "LJ2 … assessment, 5 Oct 2026". */
function sourceOf(best: BestResult): string {
  const date = DATE_FORMAT.format(new Date(best.completedAt));
  return best.kind === "journey" && best.journeyName
    ? `${best.journeyName} assessment, ${date}`
    : `Self-assessment, ${date}`;
}

function Bar({ percent }: { percent: number }) {
  return (
    <span className={styles.bar} aria-hidden="true">
      <span className={styles.barFill} style={{ width: `${percent}%` }} />
    </span>
  );
}

function ModuleRow({ module }: { module: CompetencyModule }) {
  return (
    <li className={styles.module}>
      <span className={styles.moduleCode}>{module.code ?? "–"}</span>
      <div className={styles.moduleMain}>
        <span className={styles.moduleName}>{module.name}</span>
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
      </div>
      {module.best && (
        <span className={styles.modulePercent}>
          <strong>{module.best.percent}%</strong>
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
      <div className={styles.page}>
        <h1 className={styles.heading}>Competencies</h1>
        <p className={styles.note}>
          Couldn&apos;t load your competencies right now. Please try again.
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className={styles.page}>
        <Spinner />
      </div>
    );
  }

  const relevantModules = data.sections.flatMap((s) => s.modules.filter((m) => m.relevant));
  const anyResult = data.sections.some((s) => s.assessedModules > 0);

  return (
    <div className={styles.page}>
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
          <p className={styles.eyebrow}>Most relevant for you</p>
          <h2 id="relevant-heading" className={styles.cardHeading}>
            {data.recommendedJourney.name}
          </h2>
          <p className={styles.muted}>
            The modules this journey focuses on, recommended after your self-assessment.
          </p>
          <ul className={styles.modules}>
            {relevantModules.map((module) => (
              <ModuleRow key={module.id} module={module} />
            ))}
          </ul>
          <Button variant="secondary" onClick={() => navigate("/journeys")}>
            Assess this journey
          </Button>
        </section>
      )}

      {data.sections.map((section) => (
        <section key={section.id} className={styles.card} aria-labelledby={`section-${section.id}`}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionCode}>{section.code ?? "–"}</span>
            <h2 id={`section-${section.id}`} className={styles.cardHeading}>
              {section.name}
            </h2>
            <span className={styles.sectionPercent}>
              {section.percent === null ? "–" : `${section.percent}%`}
            </span>
          </div>
          {section.percent !== null && <Bar percent={section.percent} />}
          <p className={styles.muted}>
            {section.assessedModules} of {section.moduleCount} modules assessed
          </p>
          <ul className={styles.modules}>
            {section.modules.map((module) => (
              <ModuleRow key={module.id} module={module} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
