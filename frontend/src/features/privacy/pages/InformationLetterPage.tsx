import { useNavigate } from "react-router-dom";
import { LETTER_QUESTION, LETTER_TITLE, letterSections } from "../informationLetterContent";
import styles from "./InformationLetterPage.module.css";

/**
 * The project's information letter, in full. Public (outside the signed-in
 * shell) so the profile step's consent checkbox can link to it, and linked from
 * Settings for later review.
 */
export function InformationLetterPage() {
  const navigate = useNavigate();

  // Back to wherever the learner came from (e.g. the profile step, so nothing
  // they typed is lost); opened directly, there is nothing to go back to.
  function goBack() {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/", { replace: true });
  }

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={goBack}>
        &larr; Back
      </button>
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
