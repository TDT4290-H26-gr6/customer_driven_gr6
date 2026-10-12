import { RouteIcon } from "@/shared/components/icons";
import type { LearningJourney } from "../types";
import styles from "./JourneyCard.module.css";

// Laid out like the Sources page's SourceCard (the customer asked for the
// journeys to be listed the same way): a banner, badges, title, a short fact
// row, "Read more" for the details, and the actions in a footer.

// Deterministic banner colours per journey, from the AIOS logo palette
// (purple, blue, olive) and two neighbours — a stand-in "picture" until real
// artwork exists, like SourceCard's.
const PALETTE: [string, string][] = [
  ["#7b3d8d", "#3386a7"],
  ["#3386a7", "#2a8576"],
  ["#8a9420", "#3386a7"],
  ["#a8466b", "#7b3d8d"],
  ["#2a8576", "#8a9420"],
  ["#3386a7", "#7b3d8d"],
];

function bannerGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const [from, to] = PALETTE[hash % PALETTE.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

const COVERAGE_LABEL = { M: "Core", R: "Recommended", S: "Selective" } as const;
const COVERAGE_ORDER = { M: 0, R: 1, S: 2 } as const;

/** "LJ2 — Research Data …" → code "LJ2" and title "Research Data …"; otherwise just a title. */
function splitName(name: string): { code: string | null; title: string } {
  const match = name.match(/^(LJ\d+)\s+[—-]\s+(.+)$/);
  return match ? { code: match[1], title: match[2] } : { code: null, title: name };
}

/** The sections the journey covers, core (M) first, then A–E. */
function sortedSections(journey: LearningJourney) {
  return [...(journey.sections ?? [])]
    .filter((s) => s.coverageLevel)
    .sort(
      (a, b) =>
        COVERAGE_ORDER[a.coverageLevel!] - COVERAGE_ORDER[b.coverageLevel!] ||
        (a.section?.code ?? "").localeCompare(b.section?.code ?? ""),
    );
}

type Props = {
  journey: LearningJourney;
  expanded: boolean;
  onToggle: () => void;
  /** Starts a journey assessment — on its core (M) sections. */
  onAssess: () => void;
  /** This card's assessment is starting. */
  starting: boolean;
  /** Any card's assessment is starting, or there's nothing to assess. */
  assessDisabled: boolean;
};

/** One journey, controlled by the page so only one card expands at a time. */
export function JourneyCard({
  journey,
  expanded,
  onToggle,
  onAssess,
  starting,
  assessDisabled,
}: Props) {
  const { code, title } = splitName(journey.name);
  const sections = sortedSections(journey);
  const core = sections
    .filter((s) => s.coverageLevel === "M")
    .map((s) => s.section?.code ?? s.section?.name ?? "")
    .filter(Boolean)
    .sort();

  return (
    <article className={styles.card}>
      <button type="button" className={styles.toggle} onClick={onToggle} aria-expanded={expanded}>
        <div className={styles.banner} style={{ backgroundImage: bannerGradient(journey.name) }}>
          <RouteIcon className={styles.bannerIcon} width={32} height={32} />
        </div>

        <div className={styles.body}>
          <div className={styles.badgeRow}>
            {code && <span className={styles.codeBadge}>{code}</span>}
            <span className={styles.typeBadge}>Learning journey</span>
          </div>

          <h3 className={styles.name}>{title}</h3>
          {journey.description && <p className={styles.subtitle}>{journey.description}</p>}

          <dl className={styles.factRow}>
            <div className={styles.fact}>
              <dt>Core sections</dt>
              <dd>{core.length > 0 ? core.join(", ") : "–"}</dd>
            </div>
            {sections.length > 0 && (
              <div className={styles.fact}>
                <dt>Sections covered</dt>
                <dd>{sections.length}</dd>
              </div>
            )}
            {journey.modules.length > 0 && (
              <div className={styles.fact}>
                <dt>Steps</dt>
                <dd>{journey.modules.length}</dd>
              </div>
            )}
          </dl>

          {expanded && (
            <div className={styles.details}>
              {sections.length > 0 && (
                <>
                  <p className={styles.detailHeading}>What it covers</p>
                  <ul className={styles.coverage}>
                    {sections.map((s) => (
                      <li key={s.sectionId} className={styles.coverageRow}>
                        <span className={styles.sectionCode}>{s.section?.code ?? "–"}</span>
                        <span className={styles.sectionName}>{s.section?.name}</span>
                        <span className={styles[`coverage${s.coverageLevel}`]}>
                          {COVERAGE_LABEL[s.coverageLevel!]}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className={styles.hint}>
                    Assessing this journey asks the questions in its core sections.
                  </p>
                </>
              )}
              {journey.modules.length > 0 && (
                <>
                  <p className={styles.detailHeading}>Steps</p>
                  <ol className={styles.steps}>
                    {journey.modules.map((module) => (
                      <li key={module.id}>
                        <strong>{module.title}</strong>
                        {module.description && (
                          <span className={styles.stepDescription}> — {module.description}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          )}

          <span className={styles.expandHint}>{expanded ? "Show less ▲" : "Read more ▼"}</span>
        </div>
      </button>

      {/* Always visible, independent of expand state and of the toggle button above. */}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.assessButton}
          onClick={onAssess}
          disabled={assessDisabled}
        >
          {starting ? "Starting…" : "Assess this journey"}
        </button>
        {journey.moodleUrl && (
          <a
            href={journey.moodleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.externalLink}
          >
            Open in Moodle ↗
          </a>
        )}
      </div>
    </article>
  );
}
