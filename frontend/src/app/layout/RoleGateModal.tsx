import { useAuth } from "@/app/providers/AuthProvider";
import { RoleSelect } from "@/features/onboarding";
import type { Role } from "@/features/onboarding";
import styles from "./RoleGateModal.module.css";

/**
 * Blocking modal shown whenever a signed-in learner has no role yet.
 * Deliberately has no close button, no backdrop-click-to-dismiss, and no
 * Escape handling, AppShell also makes the rest of the app `inert` while
 * this is up, so there's no click-through or Tab-to-focus escape route
 * either.
 *
 * That said: this is UI, not the security boundary. A learner with dev
 * tools can always manipulate their own client-side state, so the backend
 * additionally requires a role on every gated endpoint (`requireRole`
 * middleware, see backend/src/middleware/requireRole.ts) and refuses the
 * data regardless of what the page renders.
 */
export function RoleGateModal() {
  const { setRole } = useAuth();

  function handleDone(role: Role) {
    setRole(role);
  }

  return (
    <div className={styles.backdrop} role="presentation">
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Choose your role">
        <RoleSelect
          heading="Welcome, choose your role"
          description="Pick the role that best describes you to start your learning journey."
          confirmLabel="Continue"
          onDone={handleDone}
        />
      </div>
    </div>
  );
}
