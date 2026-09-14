import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { LogoutIcon, SettingsIcon } from "@/shared/components/icons";
import styles from "./Header.module.css";

/** Top bar: brand on the left, an initials avatar + account dropdown on the right. */
export function Header() {
  const { learner, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = learner?.name || learner?.email || "";
  const initials = getInitials(displayName);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function goToSettings() {
    setOpen(false);
    navigate("/settings");
  }

  function handleLogout() {
    setOpen(false);
    logout();
  }

  return (
    <header className={styles.header}>
      <span className={styles.brand}>AIOS</span>
      {learner && (
        <div className={styles.userMenu} ref={menuRef}>
          <button
            type="button"
            className={styles.avatarButton}
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Account menu"
          >
            {initials}
          </button>

          {open && (
            <div className={styles.dropdown} role="menu">
              <div className={styles.dropdownHeader}>
                <span className={styles.dropdownName}>{displayName}</span>
                {learner.role && <span className={styles.dropdownRole}>{learner.role.name}</span>}
              </div>
              <button
                type="button"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={goToSettings}
              >
                <SettingsIcon className={styles.dropdownIcon} />
                Settings
              </button>
              <button
                type="button"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={handleLogout}
              >
                <LogoutIcon className={styles.dropdownIcon} />
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
