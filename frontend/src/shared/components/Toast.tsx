import { useEffect, useRef, useState } from "react";
import styles from "./Toast.module.css";

/** How long a toast stays before it fades. */
export const TOAST_VISIBLE_MS = 5000;
/** The fade itself (matches Toast.module.css). */
export const TOAST_FADE_MS = 300;

export type ToastContent = {
  /** What happened, e.g. "Partial assessment completed." */
  title: string;
  /** A follow-up: makes the whole toast a button that does `onAction`. */
  action?: { label: string; onAction: () => void };
};

/**
 * A short notice in the bottom-right corner, just above the Feedback button.
 * It fades after TOAST_VISIBLE_MS, but not while the pointer or keyboard
 * focus is on it (so reaching for it doesn't lose it), and the × closes it
 * at any time. With an `action`, clicking it does that and closes it.
 */
export function Toast({ title, action, onClose }: ToastContent & { onClose: () => void }) {
  const [fading, setFading] = useState(false);
  const [held, setHeld] = useState(false);
  const closed = useRef(false);

  function close() {
    if (closed.current) return;
    closed.current = true;
    onClose();
  }

  useEffect(() => {
    if (held) {
      setFading(false);
      return;
    }
    const fade = setTimeout(() => setFading(true), TOAST_VISIBLE_MS);
    const gone = setTimeout(close, TOAST_VISIBLE_MS + TOAST_FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held]);

  const hold = {
    onMouseEnter: () => setHeld(true),
    onMouseLeave: () => setHeld(false),
    onFocus: () => setHeld(true),
    onBlur: () => setHeld(false),
  };

  return (
    <div
      className={fading ? `${styles.toast} ${styles.fading}` : styles.toast}
      role="status"
      {...hold}
    >
      {action ? (
        <button
          type="button"
          className={styles.body}
          onClick={() => {
            action.onAction();
            close();
          }}
        >
          <span className={styles.title}>{title}</span>
          <span className={styles.action}>{action.label} →</span>
        </button>
      ) : (
        <p className={styles.body}>
          <span className={styles.title}>{title}</span>
        </p>
      )}
      <button type="button" className={styles.close} onClick={close} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
