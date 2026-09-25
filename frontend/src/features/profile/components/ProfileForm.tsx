import { useEffect, useState } from "react";
import { Button } from "@/shared/components/Button";
import { getProfile, saveProfile } from "../api";
import styles from "./ProfileForm.module.css";

/**
 * Goals / background / years of experience (SAT23). Data collection only for
 * now — recommendJourney() doesn't read this yet, see CD-28.
 */
export function ProfileForm() {
  const [loaded, setLoaded] = useState(false);
  const [goals, setGoals] = useState("");
  const [background, setBackground] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getProfile()
      .then((profile) => {
        setGoals(profile?.goals ?? "");
        setBackground(profile?.background ?? "");
        setYearsOfExperience(profile?.yearsOfExperience?.toString() ?? "");
      })
      .catch(() => setError("Could not load your profile."))
      .finally(() => setLoaded(true));
  }, []);

  function submit() {
    setSaving(true);
    setError("");
    setSaved(false);
    saveProfile({
      goals: goals.trim() || null,
      background: background.trim() || null,
      yearsOfExperience: yearsOfExperience.trim() === "" ? null : Number(yearsOfExperience),
    })
      .then(() => setSaved(true))
      .catch(() => setError("Could not save your profile. Try again."))
      .finally(() => setSaving(false));
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.heading}>Your profile</h2>
      <p className={styles.hint}>
        Tell us a bit about yourself — this helps tailor what we recommend you next.
      </p>

      <label className={styles.field}>
        <span className={styles.label}>Goals</span>
        <textarea
          className={styles.textarea}
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          disabled={!loaded || saving}
          placeholder="What are you hoping to get out of this?"
          rows={3}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Background</span>
        <textarea
          className={styles.textarea}
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          disabled={!loaded || saving}
          placeholder="Your field, role, or area of study"
          rows={2}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Years of experience</span>
        <input
          className={styles.numberInput}
          type="number"
          min={0}
          max={80}
          value={yearsOfExperience}
          onChange={(e) => setYearsOfExperience(e.target.value)}
          disabled={!loaded || saving}
        />
      </label>

      <div className={styles.actions}>
        <Button onClick={submit} disabled={!loaded || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {saved && <p className={styles.confirmation}>Saved.</p>}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
