import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { APP_LOCALE } from "@/shared/lib/format";
import { getAllFeedback } from "../api";
import type { Feedback } from "../types";
import styles from "./FeedbackAdminPage.module.css";

const dateFormat = new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: "medium", timeStyle: "short" });

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
    <div className={styles.page} data-backdrop="logo">
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
          <p className={styles.count}>
            {feedback.length} {feedback.length === 1 ? "response" : "responses"}
          </p>
          <ul className={styles.list}>
            {feedback.map((item) => (
              <li key={item.id} className={styles.card}>
                <div className={styles.meta}>
                  <span className={styles.sender}>{item.learner.name || item.learner.email}</span>
                  {item.learner.name && <span>{item.learner.email}</span>}
                  <time dateTime={item.createdAt}>
                    {dateFormat.format(new Date(item.createdAt))}
                  </time>
                  {item.page && <code className={styles.page}>{item.page}</code>}
                </div>
                <p className={styles.label}>What should be improved</p>
                <p className={styles.text}>{item.message}</p>
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
