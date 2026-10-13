import { useCallback, useEffect, useState } from "react";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { SourceCard } from "../components/SourceCard";
import { getSources } from "../api";
import type { Source } from "../types";
import styles from "./SourcesPage.module.css";

export function SourcesPage() {
  const [sources, setSources] = useState<Source[] | null>(null);
  // Kept apart from an empty list: "couldn't load" and "there are none" are
  // different messages, and only the first is worth retrying.
  const [loadFailed, setLoadFailed] = useState(false);
  // Only one card expanded at a time: picking another collapses the current
  // one, and the newly picked card is what pushes the next row down.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadFailed(false);
    setSources(null);
    getSources()
      .then(setSources)
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Available sources</h1>
      <p className={styles.subheading}>
        Courses and resources from partner institutions to help build your skills.
      </p>

      {loadFailed ? (
        <div className={styles.failed}>
          <p className={styles.error} role="alert">
            Couldn&apos;t load the sources. Check your connection and try again.
          </p>
          <Button variant="secondary" onClick={load}>
            Try again
          </Button>
        </div>
      ) : sources === null ? (
        <Spinner />
      ) : sources.length === 0 ? (
        <p className={styles.empty}>No sources are available yet.</p>
      ) : (
        <div className={styles.grid}>
          {sources.map((source, index) => (
            <SourceCard
              key={source.id}
              source={source}
              index={index}
              expanded={expandedId === source.id}
              onToggle={() => setExpandedId((id) => (id === source.id ? null : source.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
