import { useEffect, useState } from "react";
import { Spinner } from "@/shared/components/Spinner";
import { SourceCard } from "../components/SourceCard";
import { getSources } from "../api";
import type { Source } from "../types";
import styles from "./SourcesPage.module.css";

export function SourcesPage() {
  const [sources, setSources] = useState<Source[] | null>(null);
  // Only one card expanded at a time: picking another collapses the current
  // one, and the newly picked card is what pushes the next row down.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    getSources()
      .then(setSources)
      .catch(() => setSources([]));
  }, []);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Available sources</h1>
      <p className={styles.subheading}>
        Courses and resources from partner institutions to help build your skills.
      </p>

      {sources === null ? (
        <Spinner />
      ) : sources.length === 0 ? (
        <p className={styles.empty}>No sources are available yet.</p>
      ) : (
        <div className={styles.grid}>
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              expanded={expandedId === source.id}
              onToggle={() => setExpandedId((id) => (id === source.id ? null : source.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
