import { useId, useMemo, useState } from "react";
import { FAQ, type FaqCategory } from "../faqContent";
import styles from "./FaqPage.module.css";

/** The categories with only the entries whose question or answer contains every word typed. */
export function filterFaq(categories: FaqCategory[], query: string): FaqCategory[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return categories;
  return categories
    .map((category) => ({
      ...category,
      entries: category.entries.filter((entry) => {
        const text = `${entry.question} ${entry.answer.join(" ")}`.toLowerCase();
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((category) => category.entries.length > 0);
}

/**
 * Frequently asked questions, grouped by topic, with a search box. Each
 * question is a native <details> disclosure (keyboard- and screen-reader
 * friendly without extra code). The content lives in faqContent.ts.
 */
export function FaqPage() {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterFaq(FAQ, query), [query]);
  const searching = query.trim() !== "";

  return (
    <div className={styles.page} data-backdrop="logo">
      <h1 className={styles.heading}>Frequently asked questions</h1>
      <p className={styles.subheading}>
        Answers to common questions about AIOS. Can&apos;t find what you&apos;re looking for? Use
        the Feedback button to ask us.
      </p>

      <label htmlFor={searchId} className={styles.searchLabel}>
        Search the questions
      </label>
      <input
        id={searchId}
        type="search"
        className={styles.search}
        placeholder="e.g. retake, Moodle, delete account"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {shown.length === 0 ? (
        <p className={styles.empty} role="status">
          No questions match &quot;{query.trim()}&quot;.
        </p>
      ) : (
        shown.map((category) => (
          <section
            key={category.id}
            className={styles.category}
            aria-labelledby={`faq-${category.id}`}
          >
            <h2 id={`faq-${category.id}`} className={styles.categoryHeading}>
              {category.title}
            </h2>
            {category.entries.map((entry) => (
              // While searching, matching answers are opened so the hit is visible.
              <details key={entry.question} className={styles.entry} open={searching || undefined}>
                <summary className={styles.question}>{entry.question}</summary>
                <div className={styles.answer}>
                  {entry.answer.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </details>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
