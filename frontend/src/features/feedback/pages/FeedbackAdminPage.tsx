import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { APP_LOCALE } from "@/shared/lib/format";
import { getAllFeedback } from "../api";
import { medianRating, ratingCounts, ratingInfo } from "../ratings";
import type { Feedback } from "../types";
import styles from "./FeedbackAdminPage.module.css";

const dateFormat = new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: "medium", timeStyle: "short" });
const MEDIAN_FORMAT = new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 1 });

/**
 * Overall satisfaction across every rating given: the median as a face (two
 * faces when it lands between them), how many ratings it's based on, and
 * how many chose each face.
 */
function SatisfactionSummary({ ratings }: { ratings: number[] }) {
  const median = medianRating(ratings);
  if (median === null) {
    return <p className={styles.count}>No satisfaction ratings yet.</p>;
  }
  const faces = [Math.floor(median), Math.ceil(median)]
    .filter((v, i, all) => all.indexOf(v) === i)
    .map((v) => ratingInfo(v)!);
  const counts = ratingCounts(ratings);
  const most = Math.max(...counts.map((c) => c.count));

  return (
    <section className={styles.summary} aria-label="Overall satisfaction">
      <p className={styles.median}>
        <span className={styles.medianFace} aria-hidden="true">
          {faces.map((f) => f.face).join("")}
        </span>
        <span className={styles.medianText}>
          <span className={styles.medianLabel}>
            Median: {faces.map((f) => f.label).join(" to ")} ({MEDIAN_FORMAT.format(median)} of 5)
          </span>
          <span className={styles.medianCount}>
            from {ratings.length} {ratings.length === 1 ? "rating" : "ratings"}
          </span>
        </span>
      </p>
      <ul className={styles.spread}>
        {[...counts].reverse().map((c) => (
          <li key={c.value} className={styles.spreadRow}>
            <span aria-hidden="true">{c.face}</span>
            <span className={styles.spreadBar} aria-hidden="true">
              <span
                className={styles.spreadFill}
                style={{ width: most > 0 ? `${(c.count / most) * 100}%` : "0%" }}
              />
            </span>
            <span className={styles.spreadCount}>
              <span className={styles.srOnly}>{c.label}: </span>
              {c.count}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Admin mode: everything testers have sent through the Feedback button, newest first. */
export function FeedbackAdminPage() {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<Feedback[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    getAllFeedback()
      .then(setFeedback)
      .catch(() => setLoadFailed(true));
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.heading}>Tester feedback</h1>
        <Button variant="secondary" onClick={() => navigate("/admin")}>
          Back to admin mode
        </Button>
      </div>

      {loadFailed ? (
        <p className={styles.error}>Could not load the feedback.</p>
      ) : !feedback ? (
        <Spinner />
      ) : feedback.length === 0 ? (
        <p className={styles.empty}>No feedback yet.</p>
      ) : (
        <>
          <SatisfactionSummary
            ratings={feedback.flatMap((f) => (f.rating === null ? [] : [f.rating]))}
          />
          <p className={styles.count}>
            {feedback.length} {feedback.length === 1 ? "response" : "responses"}
          </p>
          <ul className={styles.list} aria-label="Feedback">
            {feedback.map((item) => (
              <li key={item.id} className={styles.card}>
                <div className={styles.meta}>
                  <span className={styles.sender}>
                    {item.learner.name || item.learner.email || "Deleted account"}
                  </span>
                  {item.learner.name && <span>{item.learner.email}</span>}
                  <time dateTime={item.createdAt}>
                    {dateFormat.format(new Date(item.createdAt))}
                  </time>
                  {item.page && <code className={styles.pagePath}>{item.page}</code>}
                  {item.rating !== null && ratingInfo(item.rating) && (
                    <span className={styles.cardRating}>
                      <span aria-hidden="true">{ratingInfo(item.rating)!.face} </span>
                      {ratingInfo(item.rating)!.label}
                    </span>
                  )}
                </div>
                {item.message && (
                  <>
                    <p className={styles.label}>What should be improved</p>
                    <p className={styles.text}>{item.message}</p>
                  </>
                )}
                {item.suggestion && (
                  <>
                    <p className={styles.label}>How to improve it</p>
                    <p className={styles.text}>{item.suggestion}</p>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
