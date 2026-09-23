import { BookIcon } from "@/shared/components/icons";
import type { Course } from "../types";
import styles from "./CourseCard.module.css";

// Deterministic banner colour per course — a stand-in "picture" until real
// course artwork exists.
const PALETTE: [string, string][] = [
  ["#6366f1", "#8b5cf6"],
  ["#0ea5e9", "#06b6d4"],
  ["#f59e0b", "#f97316"],
  ["#10b981", "#14b8a6"],
  ["#ec4899", "#f43f5e"],
];

function bannerGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const [from, to] = PALETTE[hash % PALETTE.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

type Props = {
  course: Course;
  expanded: boolean;
  onToggle: () => void;
};

/** Controlled by the page so only one card expands at a time. */
export function CourseCard({ course, expanded, onToggle }: Props) {
  const topics = course.topics
    ? course.topics
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const isConfirmed = course.confidence?.toLowerCase().startsWith("confirmed") ?? false;

  return (
    <article className={styles.card}>
      <button type="button" className={styles.toggle} onClick={onToggle} aria-expanded={expanded}>
        <div
          className={styles.banner}
          style={{ backgroundImage: bannerGradient(course.institution) }}
        >
          <BookIcon className={styles.bannerIcon} width={32} height={32} />
        </div>

        <div className={styles.body}>
          <div className={styles.badgeRow}>
            <span className={styles.typeBadge}>{course.type}</span>
            {course.confidence && (
              <span className={isConfirmed ? styles.confirmedBadge : styles.unconfirmedBadge}>
                {isConfirmed ? "Confirmed" : "Unconfirmed"}
              </span>
            )}
          </div>

          <h3 className={styles.name}>{course.name}</h3>
          <p className={styles.institution}>
            {course.institution} · {course.country}
          </p>

          <dl className={styles.factRow}>
            {course.level && (
              <div className={styles.fact}>
                <dt>Level</dt>
                <dd>{course.level}</dd>
              </div>
            )}
            {course.credits && (
              <div className={styles.fact}>
                <dt>Credits</dt>
                <dd>{course.credits}</dd>
              </div>
            )}
          </dl>

          {expanded && (
            <div className={styles.details}>
              {course.description && <p className={styles.description}>{course.description}</p>}
              {course.degreeProgramme && (
                <p>
                  <strong>Programme:</strong> {course.degreeProgramme}
                </p>
              )}
              {course.instructor && (
                <p>
                  <strong>Instructor:</strong> {course.instructor}
                </p>
              )}
              {course.format && (
                <p>
                  <strong>Format:</strong> {course.format}
                </p>
              )}
              {course.language && (
                <p>
                  <strong>Language:</strong> {course.language}
                </p>
              )}
              {course.prerequisites && (
                <p>
                  <strong>Prerequisites:</strong> {course.prerequisites}
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
              {course.confidence && <p className={styles.confidenceNote}>{course.confidence}</p>}
            </div>
          )}

          <span className={styles.expandHint}>{expanded ? "Show less ▲" : "Read more ▼"}</span>
        </div>
      </button>

      {/* Always visible, independent of expand state and of the toggle button above. */}
      <div className={styles.footer}>
        <a
          href={course.sourceUrl}
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
