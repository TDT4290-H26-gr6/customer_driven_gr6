import { RouteIcon } from "@/shared/components/icons";
import type { LearningJourney } from "../types";
import { bannerGradient, coreSectionCodes, sortedSections, splitName } from "./journeyDisplay";
import styles from "./JourneyCard.module.css";

// A card with a banner, badges, title, a short fact row and the actions in a
// footer. Clicking the card opens the journey's details in a modal
// (JourneyModal), so the page only has to show the summaries.

type Props = {
  journey: LearningJourney;
  /** The card's position in the list: picks its banner colour. */
  index: number;
  /** Opens the details modal. */
  onOpen: () => void;
  /** Starts a journey assessment, on its core (M) sections. */
  onAssess: () => void;
  /** This card's assessment is starting. */
  starting: boolean;
  /** Any card's assessment is starting, or there's nothing to assess. */
  assessDisabled: boolean;
};

/** One journey's summary. The page owns which one's modal is open. */
export function JourneyCard({ journey, index, onOpen, onAssess, starting, assessDisabled }: Props) {
  const { code, title } = splitName(journey.name);
  const sections = sortedSections(journey);
  const core = coreSectionCodes(journey);

  return (
    <article className={styles.card}>
      <button type="button" className={styles.toggle} onClick={onOpen} aria-haspopup="dialog">
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

          <span className={styles.expandHint}>View details</span>
        </div>
      </button>

      {/* Always available, independent of the details button above. */}
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
