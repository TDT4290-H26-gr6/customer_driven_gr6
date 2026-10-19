import type { Advice } from "../types";
import styles from "./AdviceCard.module.css";

/** What the dashboard knows about the advice so far. */
export type AdviceState =
  { status: "loading" } | { status: "ready"; advice: Advice } | { status: "unavailable" };

const KIND_LABEL = {
  moodle_module: "Module in Moodle",
  module: "Journey step",
  source: "Learning resource",
} as const;

/**
 * "Personalised advice" — the AI's explanation of the learner's results and
 * the steps it suggests, shown under the score-based journey
 * recommendation. Always labelled as AI-generated.
 */
export function AdviceCard({ state }: { state: AdviceState }) {
  return (
    <section
      className={styles.card}
      aria-labelledby="advice-heading"
      aria-busy={state.status === "loading"}
    >
      <p className={styles.eyebrow}>AI advisor</p>
      <h2 id="advice-heading" className={styles.heading}>
        Personalised advice
      </h2>

      {state.status === "loading" && (
        <p className={styles.muted} role="status">
          Reading your results and preparing advice… this can take a few seconds.
        </p>
      )}

      {state.status === "unavailable" && (
        <p className={styles.muted}>
          Personalised advice isn&apos;t available right now. Your recommended journey above is
          still up to date. Try again later.
        </p>
      )}

      {state.status === "ready" && (
        <>
          <p className={styles.summary}>{state.advice.summary}</p>

          {state.advice.steps.length > 0 && (
            <ol className={styles.steps}>
              {state.advice.steps.map((step, i) => (
                <li key={`${step.kind}-${step.title}-${i}`} className={styles.step}>
                  <span className={styles.kind}>{KIND_LABEL[step.kind]}</span>
                  {step.url ? (
                    <a
                      className={styles.title}
                      href={step.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {step.title}
                    </a>
                  ) : (
                    <span className={styles.title}>{step.title}</span>
                  )}
                  <span className={styles.reason}>{step.reason}</span>
                </li>
              ))}
            </ol>
          )}

          <p className={styles.disclaimer}>
            Written by an AI model hosted by NTNU, based on your latest self-assessment. It can make
            mistakes, so use it as a starting point.
          </p>
        </>
      )}
    </section>
  );
}
