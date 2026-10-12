import { BookIcon } from "@/shared/components/icons";
import type { Source } from "../types";
import styles from "./SourceCard.module.css";

// Deterministic banner colour per source — a stand-in "picture" until real
// artwork exists. The gradients themselves are the --banner-gradient-* tokens
// in styles/globals.css; keep this count in sync with them.
const BANNER_GRADIENT_COUNT = 5;

/** At or above this confidence a source is shown as "confirmed"; below it, as a warning. */
const CONFIRMED_CONFIDENCE = 0.9;

function bannerGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return `var(--banner-gradient-${(hash % BANNER_GRADIENT_COUNT) + 1})`;
}

type Props = {
  source: Source;
  expanded: boolean;
  onToggle: () => void;
};

/** Controlled by the page so only one card expands at a time. */
export function SourceCard({ source, expanded, onToggle }: Props) {
  const topics = source.topics
    ? source.topics
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const hasConfidence = source.confidence !== null;
  const isConfirmed = (source.confidence ?? 0) >= CONFIRMED_CONFIDENCE;

  return (
    <article className={styles.card}>
      <button type="button" className={styles.toggle} onClick={onToggle} aria-expanded={expanded}>
        <div
          className={styles.banner}
          style={{ backgroundImage: bannerGradient(source.institution) }}
        >
          <BookIcon className={styles.bannerIcon} width={32} height={32} />
        </div>

        <div className={styles.body}>
          <div className={styles.badgeRow}>
            <span className={styles.typeBadge}>{source.type}</span>
            {hasConfidence && (
              <span className={isConfirmed ? styles.confirmedBadge : styles.unconfirmedBadge}>
                {Math.round((source.confidence ?? 0) * 100)}% confidence
              </span>
            )}
          </div>

          <h3 className={styles.name}>{source.courseName}</h3>
          <p className={styles.institution}>
            {source.institution} · {source.country}
          </p>

          <dl className={styles.factRow}>
            {source.level && (
              <div className={styles.fact}>
                <dt>Level</dt>
                <dd>{source.level}</dd>
              </div>
            )}
            {source.credits && (
              <div className={styles.fact}>
                <dt>Credits</dt>
                <dd>{Number(source.credits)}</dd>
              </div>
            )}
          </dl>

          {expanded && (
            <div className={styles.details}>
              {source.description && <p className={styles.description}>{source.description}</p>}
              {source.degreeProgramme && (
                <p>
                  <strong>Programme:</strong> {source.degreeProgramme}
                </p>
              )}
              {source.instructor && (
                <p>
                  <strong>Instructor:</strong> {source.instructor}
                </p>
              )}
              {source.format && (
                <p>
                  <strong>Format:</strong> {source.format}
                </p>
              )}
              {source.language && (
                <p>
                  <strong>Language:</strong> {source.language}
                </p>
              )}
              {source.prerequisites && (
                <p>
                  <strong>Prerequisites:</strong> {source.prerequisites}
                </p>
              )}
              {topics.length > 0 && (
                <div className={styles.topics}>
                  {topics.map((topic) => (
                    <span key={topic} className={styles.topicChip}>
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <span className={styles.expandHint}>{expanded ? "Show less ▲" : "Read more ▼"}</span>
        </div>
      </button>

      {/* Always visible, independent of expand state and of the toggle button above. */}
      <div className={styles.footer}>
        <a
          href={source.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.externalLink}
        >
          View source page ↗
        </a>
      </div>
    </article>
  );
}
