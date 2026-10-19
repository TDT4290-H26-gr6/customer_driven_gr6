import { useState } from "react";
import { ACCENTS, useAccent } from "@/app/providers/AccentProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { useTheme, type ThemePreference } from "@/app/providers/ThemeProvider";
import { MonitorIcon, MoonIcon, SunIcon } from "@/shared/components/icons";
import { RoleSelect } from "@/features/onboarding";
import type { Role } from "@/features/onboarding";
import { ProfileForm } from "@/features/profile";
import { ROLE_SELECTION_ENABLED } from "@/shared/lib/features";
import { DeleteAccountSection } from "../components/DeleteAccountSection";
import styles from "./SettingsPage.module.css";

const VISUAL_OPTIONS: { value: ThemePreference; label: string; Icon: typeof MonitorIcon }[] = [
  { value: "default", label: "Default", Icon: MonitorIcon },
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
];

/**
 * Account settings: visuals, profile, role and account deletion. The role
 * card is hidden while role selection is temporarily off
 * (shared/lib/features.ts).
 */
export function SettingsPage() {
  const { learner, setRole } = useAuth();
  const { preference, setPreference } = useTheme();
  const { accent, setAccent } = useAccent();
  const [saved, setSaved] = useState<Role | null>(null);

  function handleRoleChange(role: Role) {
    setRole(role);
    setSaved(role);
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Settings</h1>

      <div className={styles.card}>
        <h2 className={styles.cardHeading}>Choose your visuals</h2>
        <p className={styles.cardHint}>
          &quot;Default&quot; follows your system&apos;s light/dark setting.
        </p>
        <div className={styles.visualOptions} role="radiogroup" aria-label="Visuals">
          {VISUAL_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={preference === value}
              className={
                preference === value
                  ? `${styles.visualOption} ${styles.visualOptionActive}`
                  : styles.visualOption
              }
              onClick={() => setPreference(value)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardHeading}>Choose your accent color</h2>
        <p className={styles.cardHint}>The colors of the AIOS logo.</p>
        <div className={styles.accentOptions} role="radiogroup" aria-label="Accent color">
          {ACCENTS.map(({ value, label, swatch }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={accent === value}
              aria-label={label}
              title={label}
              className={
                accent === value
                  ? `${styles.accentSwatch} ${styles.accentSwatchActive}`
                  : styles.accentSwatch
              }
              style={{ background: swatch }}
              onClick={() => setAccent(value)}
            />
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <ProfileForm />
      </div>

      {ROLE_SELECTION_ENABLED && (
        <div className={styles.card}>
          <RoleSelect
            initialRoleId={learner?.role?.id}
            heading="Your role"
            description="Change the role that best describes you."
            confirmLabel="Save"
            onDone={handleRoleChange}
          />
          {saved && (
            <p className={styles.confirmation}>Saved — you&apos;re now set as {saved.name}.</p>
          )}
        </div>
      )}

      <div className={styles.card}>
        <DeleteAccountSection />
      </div>
    </div>
  );
}
