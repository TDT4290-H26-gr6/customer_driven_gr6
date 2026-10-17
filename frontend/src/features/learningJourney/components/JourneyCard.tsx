import { RouteIcon } from "@/shared/components/icons";
import type { LearningJourney } from "../types";
import { bannerGradient, coreSectionCodes, sortedSections, splitName } from "./journeyDisplay";
import { JourneyDetailsDialog } from "./JourneyDetailsDialog";
import styles from "./JourneyCard.module.css";

// A summary card: banner, badges, title, a short fact row and "Read more",
// which opens the full details in a popup (JourneyDetailsDialog), and the
// actions in a footer.

type Props = {
  journey: LearningJourney;
  /** The card's position in the list — picks its banner colour. */
  index: number;
  /** The details popup is open. */
  expanded: boolean;
  /** Opens the popup, or closes it when it is open. */
  onToggle: () => void;
  /** Starts a journey assessment — on its core (M) sections. */
  onAssess: () => void;
  /** This card's assessment is starting. */
  starting: boolean;
  /** Any card's assessment is starting, or there's nothing to assess. */
  assessDisabled: boolean;
};

/** One journey, controlled by the page so only one popup is open at a time. */
export function JourneyCard({
  journey,
  index,
  expanded,
  onToggle,
  onAssess,
  starting,
  assessDisabled,
}: Props) {
  const { code, title } = splitName(journey.name);
  const sections = sortedSections(journey);
  const core = coreSectionCodes(journey);

  return (
    <article className={styles.card}>
      <button
        type="button"
        className={styles.toggle}
        onClick={onToggle}
        aria-haspopup="dialog"
        aria-expanded={expanded}
      >
        <div className={styles.banner} style={{ backgroundImage: bannerGradient(index) }}>
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
              <dd>{core.length > 0 ? core.join(", ") : "-"}</dd>
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

          <span className={styles.expandHint}>Read more</span>
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

      {expanded && (
        <JourneyDetailsDialog
          journey={journey}
          index={index}
          onClose={onToggle}
          onAssess={onAssess}
          starting={starting}
          assessDisabled={assessDisabled}
        />
      )}
    </article>
  );
}
