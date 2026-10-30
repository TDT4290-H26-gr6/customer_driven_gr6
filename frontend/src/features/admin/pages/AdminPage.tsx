import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { downloadQuestionsCsv, downloadTestsCsv, getDropoff, getVisibility } from "../api";
import { DropoffChart } from "../components/DropoffChart";
import { DropoffTable } from "../components/DropoffTable";
import type { DropoffData, DropoffType, Grantable } from "../types";
import styles from "./AdminPage.module.css";

const DEFAULT_INACTIVE_DAYS = 7;
const MAX_INACTIVE_DAYS = 3650;

/**
 * Admin mode, the admins' main page: at which question do learners abandon
 * the assessment? A run is "abandoned" when it isn't completed and its last
 * activity is older than the chosen number of days; runs still within that
 * window are "in progress" and left out of the rates. Aggregates only ,
 * nobody is identifiable here. The title row also links to the tester
 * feedback and holds the two CSV exports. (The old role-visibility screen is
 * parked in ./legacy.)
 */
export function AdminPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<DropoffType>("initial");
  const [sectionId, setSectionId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [inactiveInput, setInactiveInput] = useState(String(DEFAULT_INACTIVE_DAYS));
  const [sections, setSections] = useState<Grantable[]>([]);
  const [data, setData] = useState<DropoffData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [downloading, setDownloading] = useState<"tests" | "questions" | null>(null);
  const [downloadError, setDownloadError] = useState("");

  const inactiveDays = /^\d+$/.test(inactiveInput) ? Number(inactiveInput) : 0;
  const inactiveValid = inactiveDays >= 1 && inactiveDays <= MAX_INACTIVE_DAYS;

  useEffect(() => {
    getVisibility()
      .then((matrix) => setSections(matrix.sections))
      .catch(() => setSections([])); // the section filter just stays empty
  }, []);

  useEffect(() => {
    if (!inactiveValid) return;
    let stale = false;
    setData(null);
    setLoadFailed(false);
    getDropoff({ type, sectionId, from, to, inactiveDays })
      .then((loaded) => {
        if (!stale) setData(loaded);
      })
      .catch(() => {
        if (!stale) setLoadFailed(true);
      });
    return () => {
      stale = true;
    };
  }, [type, sectionId, from, to, inactiveDays, inactiveValid]);

  async function handleDownload(kind: "tests" | "questions") {
    setDownloading(kind);
    setDownloadError("");
    try {
      await (kind === "tests" ? downloadTestsCsv() : downloadQuestionsCsv());
    } catch {
      setDownloadError("Could not download that file. Try again.");
    } finally {
      setDownloading(null);
    }
  }

  const cards = data
    ? [
        { label: "Started", value: data.summary.started },
        { label: "Completed", value: data.summary.completed },
        { label: "Abandoned", value: data.summary.abandoned },
        { label: "In progress", value: data.summary.inProgress },
      ]
    : [];

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.heading}>Admin mode</h1>
        <div className={styles.titleActions}>
          <Button variant="secondary" onClick={() => navigate("/admin/feedback")}>
            View tester feedback
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handleDownload("tests")}
            disabled={downloading !== null}
          >
            {downloading === "tests" ? "Downloading…" : "Download test stats (CSV)"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handleDownload("questions")}
            disabled={downloading !== null}
          >
            {downloading === "questions" ? "Downloading…" : "Download question stats (CSV)"}
          </Button>
          <Button variant="secondary" onClick={() => navigate("/dashboard")}>
            Exit admin mode
          </Button>
        </div>
      </div>

      {downloadError && (
        <p className={styles.error} role="alert">
          {downloadError}
        </p>
      )}

      <h2 className={styles.sectionHeading}>Question drop-off</h2>
      <p className={styles.subheading}>
        Where learners stop. &quot;Stopped here&quot; means this was the last question an abandoned
        run was shown, whether or not it was answered; the rate is that count divided by how many
        runs were shown the question. A run counts as abandoned when it isn&apos;t completed and its
        last activity is older than the number of days below; newer unfinished runs are in progress
        and excluded from the rates.
      </p>

      <div className={styles.filters}>
        <label className={styles.field}>
          <span className={styles.label}>Assessment</span>
          <select
            className={styles.control}
            value={type}
            onChange={(e) => setType(e.target.value as DropoffType)}
          >
            <option value="initial">Initial</option>
            <option value="targeted_reevaluation">Targeted reevaluation</option>
          </select>
        </label>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.label}>Section</span>
          <select
            className={styles.control}
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            <option value="">All sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Started from</span>
          <input
            className={styles.control}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Started until</span>
          <input
            className={styles.control}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        {(from || to) && (
          <Button
            variant="secondary"
            className={styles.clearDates}
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            Clear dates
          </Button>
        )}
        <label className={styles.field}>
          <span className={styles.label}>Inactive after (days)</span>
          <input
            className={styles.control}
            type="number"
            min={1}
            max={MAX_INACTIVE_DAYS}
            inputMode="numeric"
            value={inactiveInput}
            aria-invalid={!inactiveValid}
            onChange={(e) => setInactiveInput(e.target.value)}
          />
        </label>
      </div>

      {!inactiveValid ? (
        <p className={styles.error} role="alert">
          Enter a whole number of days, 1 or more.
        </p>
      ) : loadFailed ? (
        <p className={styles.error} role="alert">
          Could not load the drop-off data.
        </p>
      ) : !data ? (
        <Spinner />
      ) : (
        <>
          <ul className={styles.cards}>
            {cards.map((card) => (
              <li key={card.label} className={styles.card}>
                <span className={styles.cardValue}>{card.value}</span>
                <span className={styles.cardLabel}>{card.label}</span>
              </li>
            ))}
          </ul>

          {data.summary.abandoned === 0 || data.questions.length === 0 ? (
            <p className={styles.empty}>No abandoned instances in this period.</p>
          ) : (
            <>
              <DropoffChart questions={data.questions} />
              <DropoffTable questions={data.questions} />
            </>
          )}
        </>
      )}
    </div>
  );
}
