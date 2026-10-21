import { Link } from "react-router-dom";
import { LETTER_QUESTION, LETTER_TITLE, letterSections } from "../informationLetterContent";
import styles from "./InformationLetterPage.module.css";

/**
 * The project's information letter, in full. Public (outside the signed-in
 * shell) so the profile step's consent checkbox can link to it, and linked from
 * Settings for later review.
 */
export function InformationLetterPage() {
  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>
        &larr; Back
      </Link>
      <h1 className={styles.heading}>{LETTER_TITLE}</h1>
      <p className={styles.question}>{LETTER_QUESTION}</p>

      <div className={styles.card}>
        {letterSections.map((section) => (
          <section key={section.heading} className={styles.section}>
            <h2 className={styles.sectionHeading}>{section.heading}</h2>
            {section.paragraphs?.map((text) => (
              <p key={text}>{text}</p>
            ))}
            {section.bullets && (
              <ul>
                {section.bullets.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            )}
            {section.link && (
              <p>
                <a href={section.link} target="_blank" rel="noreferrer">
                  {section.link}
                </a>
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
