import { useEffect, type RefObject } from "react";

const FOCUSABLE = "button:not([disabled]), textarea:not([disabled]), [href]";

/**
 * Keyboard behaviour for a modal dialog: Escape closes it, and Tab/Shift+Tab
 * wrap around inside it. Listens on the document, so it works wherever focus
 * is (like FeedbackDialog and Header's menu).
 */
export function useDialogKeys(dialogRef: RefObject<HTMLElement>, onClose: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const dialog = dialogRef.current;
      if (e.key !== "Tab" || !dialog) return;

      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const inside = dialog.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dialogRef, onClose]);
}
