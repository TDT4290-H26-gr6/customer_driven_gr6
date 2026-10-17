import { useEffect, useState } from "react";
import { Button } from "@/shared/components/Button";
import { useSessionStorage } from "@/shared/hooks/useSessionStorage";
import styles from "./WelcomeScreen.module.css";

type Props = {
  name?: string;
  /** The learner started the assessment and left before finishing it. */
  hasOngoing?: boolean;
  onStart: () => void;
};

const SEEN_KEY = "aios.welcomeSeen";

/**
 * Shown instead of the results dashboard when the learner hasn't completed
 * an assessment yet. Plays a one-time entrance animation the first time it's
 * shown in a session (sessionStorage, not localStorage — it should replay
 * next time the learner signs in), then stays static on later visits.
 */
export function WelcomeScreen({ name, hasOngoing = false, onStart }: Props) {
  const [hasSeen, setHasSeen] = useSessionStorage(SEEN_KEY, false);
  const [animate] = useState(() => !hasSeen);

  useEffect(() => {
    if (!hasSeen) setHasSeen(true);
  }, [hasSeen, setHasSeen]);

  return (
    // data-backdrop: the decorative logo-color background behind the card (AppShell.module.css).
    <div className={styles.page} data-backdrop="logo">
      <div className={`${styles.card} ${animate ? styles.enter : ""}`}>
        <p className={styles.eyebrow}>Welcome{name ? `, ${name}` : ""}</p>
        <h1 className={styles.heading}>Let&apos;s find out where you stand.</h1>
        <p className={styles.subheading}>
          {hasOngoing
            ? "You've started the self-assessment — your answers are saved, so you can pick up where you left off."
            : "You haven't taken the self-assessment yet — it only takes a few minutes and gives you a personal breakdown of your skills."}
        </p>
        <Button className={styles.cta} onClick={onStart}>
          {hasOngoing ? "Continue assessment" : "Take self assessment"}
        </Button>
      </div>
    </div>
  );
}
