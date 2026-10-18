import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/Button";
import { SectionDetailsView } from "../components/SectionDetailsView";
import styles from "./SectionDetailsPage.module.css";

/**
 * Standalone drill-down page at /results/details: page chrome (a back button
 * and heading) around SectionDetailsView, which holds the actual content.
 * Also embedded directly as ResultsPage's "Detailed view" tab, with no
 * chrome of its own there.
 */
export function SectionDetailsPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <Button variant="secondary" onClick={() => navigate("/dashboard")}>
        ← Back to overview
      </Button>
      <h1 className={styles.heading}>Detailed view</h1>
      <p className={styles.subheading}>How you did in each module, section by section.</p>

      <SectionDetailsView />
    </div>
  );
}
