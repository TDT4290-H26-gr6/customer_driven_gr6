import { isWebLink } from "@/shared/lib/webLink";
import styles from "../pages/CurriculumPage.module.css";

/**
 * A module's or journey's Moodle link in its summary line: the link, or, for
 * one that isn't a web address (learners aren't shown it, see isWebLink), a
 * warning, so an admin sees the problem and can fix it in the form. Nothing
 * when there's no link.
 */
export function MoodleLinkNote({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <>
      {" · "}
      {isWebLink(url) ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          Moodle page
        </a>
      ) : (
        <span className={styles.linkWarning}>
          The Moodle link isn&apos;t a web address (https://…), so learners don&apos;t see it
        </span>
      )}
    </>
  );
}
