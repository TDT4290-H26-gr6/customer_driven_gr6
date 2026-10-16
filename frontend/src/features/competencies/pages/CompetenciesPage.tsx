import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/Button";
import { ChevronIcon } from "@/shared/components/icons";
import { Spinner } from "@/shared/components/Spinner";
import { DATE_FORMAT } from "@/shared/lib/format";
import { getCompetencies } from "../api";
import { BAND_LABEL, scoreBand } from "../scoreBand";
import type { BestResult, Competencies, CompetencyModule, CompetencySection } from "../types";
import styles from "./CompetenciesPage.module.css";

const VISIBLE_SECTIONS = 3;

/** "Self-assessment, 3 Oct 2026" or "LJ2 assessment, 5 Oct 2026". */
function sourceOf(best: BestResult): string {
  const date = DATE_FORMAT.format(new Date(best.completedAt));
  return best.kind === "journey" && best.journeyName
    ? `${best.journeyName} assessment, ${date}`
    : `Self-assessment, ${date}`;
}

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

function Ring({ percent }: { percent: number | null }) {
  if (percent === null) {
    return (
      <span className={styles.ring} role="img" aria-label="Not assessed yet">
        <span className={styles.ringValue}>–</span>
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
      <span className={`${styles.moduleCode} ${hueClass(module.code)}`}>{module.code ?? "–"}</span>
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
        <span className={`${styles.modulePercent} ${styles[scoreBand(module.best.percent)]}`}>
          <strong className={styles.scoreValue}>{module.best.percent}%</strong>
          <span className={styles.bandLabel}>{BAND_LABEL[scoreBand(module.best.percent)]}</span>
          <Bar percent={module.best.percent} />
        </span>
      )}
    </li>
  );
}

function SectionCard({ section }: { section: CompetencySection }) {
  return (
    <section
      className={`${styles.card} ${styles.sectionCard} ${hueClass(section.code)}`}
      aria-labelledby={`section-${section.id}`}
    >
      <div className={styles.sectionHeader}>
        <span className={styles.sectionCode}>{section.code ?? "–"}</span>
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
  );
}

/**
 * Shows 3 section cards at a time. The arrows step one section at a time
 * and stop at the ends, not a loop: Next is disabled once the last section
 * is in view, Previous once the first is. The full set is always rendered
 * in the track; only the CSS transform (and the transition on it) moves
 * with `start`, so stepping either way just animates smoothly, no track
 * content to swap around.
 */
function SectionCarousel({ sections }: { sections: CompetencySection[] }) {
  const [start, setStart] = useState(0);
  const windowSize = Math.min(VISIBLE_SECTIONS, sections.length);
  const maxStart = Math.max(0, sections.length - windowSize);
  const canScroll = sections.length > windowSize;

  return (
    <div className={styles.carousel}>
      {canScroll && (
        <button
          type="button"
          className={styles.navButton}
          onClick={() => setStart((s) => Math.max(s - 1, 0))}
          disabled={start === 0}
          aria-label="Previous section"
        >
          <ChevronIcon className={styles.navIconBack} />
        </button>
      )}
      <div className={styles.carouselViewport}>
        <div
          className={styles.carouselTrack}
          style={{
            transform: `translateX(calc(${-start} * (var(--card-width) + var(--card-gap))))`,
          }}
        >
          {sections.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))}
        </div>
      </div>
      {canScroll && (
        <button
          type="button"
          className={styles.navButton}
          onClick={() => setStart((s) => Math.min(s + 1, maxStart))}
          disabled={start === maxStart}
          aria-label="Next section"
        >
          <ChevronIcon />
        </button>
      )}
    </div>
  );
}

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

      <SectionCarousel sections={data.sections} />
    </div>
  );
}
