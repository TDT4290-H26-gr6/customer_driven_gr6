import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { acceptPrivacyNotice } from "@/features/auth";
import { Button } from "@/shared/components/Button";
import { getProfile, saveProfile } from "../api";
import {
  ACADEMIC_DEGREE_OPTIONS,
  INDUSTRY_OPTIONS,
  type AcademicDegree,
  type Industry,
} from "../types";
import styles from "./ProfileForm.module.css";

/** Unsaved first-time fields, kept per tab so reading the information letter doesn't wipe them. */
const DRAFT_KEY = "aios.profileDraft";

type Draft = Partial<{
  name: string;
  industry: Industry | "";
  academicDegree: AcademicDegree | "";
  background: string;
  yearsOfExperience: string;
  goals: string;
}>;

function readDraft(): Draft {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "{}") as Draft;
  } catch {
    return {};
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage blocked: the draft just isn't kept.
  }
}

type Props = {
  /** Called after a successful save — ProfilePage uses it to go on to the dashboard. */
  onSaved?: () => void;
  /** The submit button's text. */
  submitLabel?: string;
  /**
   * The first-time profile step: shows the information-letter checkbox under
   * the fields, which must be ticked before the profile can be saved (unless
   * the learner has already accepted). Settings leaves this off.
   */
  requireConsent?: boolean;
};

/**
 * The learner's profile (SAT23). Every field is required, and the profile
 * must be complete before the assessment (RequireProfile sends learners to
 * ProfilePage to fill it in). Also editable in Settings. The name starts
 * as the one from Google and is saved onto the learner; the rest is fed to
 * the AI advice. Saving refreshes the session's learner, so the header's
 * name and hasCompletedProfile update right away.
 */
export function ProfileForm({ onSaved, submitLabel = "Save", requireConsent = false }: Props) {
  const { learner, updateLearner } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState(learner?.name ?? "");
  const [industry, setIndustry] = useState<Industry | "">("");
  const [academicDegree, setAcademicDegree] = useState<AcademicDegree | "">("");
  const [background, setBackground] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [goals, setGoals] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [consent, setConsent] = useState(false);
  const needsConsent = requireConsent && !learner?.hasAcceptedPrivacyNotice;

  useEffect(() => {
    getProfile()
      .then((profile) => {
        // On the first-time step, a draft from before the learner went to read
        // the information letter wins over what was saved.
        const draft = requireConsent ? readDraft() : {};
        setName(draft.name ?? learner?.name ?? "");
        setIndustry(draft.industry ?? profile?.industry ?? "");
        setAcademicDegree(draft.academicDegree ?? profile?.academicDegree ?? "");
        setBackground(draft.background ?? profile?.background ?? "");
        setYearsOfExperience(
          draft.yearsOfExperience ?? profile?.yearsOfExperience?.toString() ?? "",
        );
        setGoals(draft.goals ?? profile?.goals ?? "");
      })
      .catch(() => setError("Could not load your profile."))
      .finally(() => setLoaded(true));
    // Only the first load: later changes to `learner` mustn't reset the fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the first-time fields while the learner reads the letter.
  useEffect(() => {
    if (!requireConsent || !loaded) return;
    writeDraft({ name, industry, academicDegree, background, yearsOfExperience, goals });
  }, [
    requireConsent,
    loaded,
    name,
    industry,
    academicDegree,
    background,
    yearsOfExperience,
    goals,
  ]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);

    const years = Number(yearsOfExperience);
    if (
      !name.trim() ||
      !industry ||
      !academicDegree ||
      !background.trim() ||
      yearsOfExperience.trim() === ""
    ) {
      setError("Please fill in every field.");
      return;
    }
    if (!Number.isInteger(years) || years < 0 || years > 80) {
      setError("Years of experience must be a whole number between 0 and 80.");
      return;
    }

    if (needsConsent && !consent) {
      setError("Please confirm that you have read the information letter.");
      return;
    }

    setSaving(true);
    // Record the consent first; the profile save below returns the learner
    // that goes into the session, so it carries the acceptance too.
    (needsConsent ? acceptPrivacyNotice() : Promise.resolve())
      .then(() =>
        saveProfile({
          name: name.trim(),
          industry,
          academicDegree,
          background: background.trim(),
          yearsOfExperience: years,
          goals: goals.trim() || null,
        }),
      )
      .then((updated) => {
        writeDraft(null);
        updateLearner(updated);
        setSaved(true);
        onSaved?.();
      })
      .catch(() => setError("Could not save your profile. Try again."))
      .finally(() => setSaving(false));
  }

  const disabled = !loaded || saving;

  return (
    <form className={styles.wrap} onSubmit={submit} noValidate>
      <h2 className={styles.heading}>Your profile</h2>
      <p className={styles.hint}>
        Tell us a bit about yourself, it helps tailor what we recommend you next. Everything but
        goals is required before you can take the assessment.
      </p>

      <label className={styles.field}>
        <span className={styles.label}>Name</span>
        <input
          className={styles.input}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={disabled}
          maxLength={100}
          autoComplete="name"
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Industry</span>
        <select
          className={styles.select}
          value={industry}
          onChange={(e) => setIndustry(e.target.value as Industry | "")}
          disabled={disabled}
          required
        >
          <option value="" disabled>
            Select your industry
          </option>
          {INDUSTRY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Academic degree</span>
        <select
          className={styles.select}
          value={academicDegree}
          onChange={(e) => setAcademicDegree(e.target.value as AcademicDegree | "")}
          disabled={disabled}
          required
        >
          <option value="" disabled>
            Select your highest degree
          </option>
          {ACADEMIC_DEGREE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Describe your occupation/role</span>
        <textarea
          className={styles.textarea}
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          disabled={disabled}
          maxLength={2000}
          placeholder="E.g. PhD candidate in marine biology, working with large sensor datasets"
          rows={3}
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Years of experience in AI or Open Science</span>
        <input
          className={styles.numberInput}
          type="number"
          min={0}
          max={80}
          step={1}
          inputMode="numeric"
          value={yearsOfExperience}
          onChange={(e) => setYearsOfExperience(e.target.value)}
          disabled={disabled}
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>
          Goals <span className={styles.optional}>(optional)</span>
        </span>
        <textarea
          className={styles.textarea}
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          disabled={disabled}
          maxLength={2000}
          placeholder="What are you hoping to learn?"
          rows={3}
        />
      </label>

      {needsConsent && (
        <div className={styles.consent}>
          <label className={styles.consentLabel}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={disabled}
            />
            <span>
              By checking this box, you acknowledge that you have read and understood the{" "}
              <Link to="/information-letter">information letter</Link> and consent to participate.
            </span>
          </label>
          <p className={styles.consentNote}>
            We use your profile details and assessment answers to show your results, recommend
            learning journeys and research the AIOS curriculum. You can request deletion of your
            account and personal data at any time from the settings page. We will process the
            request within 30 days.
          </p>
        </div>
      )}

      <div className={styles.actions}>
        <Button type="submit" disabled={disabled || (needsConsent && !consent)}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>

      {saved && <p className={styles.confirmation}>Saved.</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
