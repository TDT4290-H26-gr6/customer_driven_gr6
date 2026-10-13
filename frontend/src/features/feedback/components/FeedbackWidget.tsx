import { useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageIcon } from "@/shared/components/icons";
import { sendFeedback } from "../api";
import { FeedbackDialog, type FeedbackDraft, type FeedbackStatus } from "./FeedbackDialog";
import styles from "./FeedbackWidget.module.css";

const EMPTY_DRAFT: FeedbackDraft = { message: "", suggestion: "" };

/**
 * The always-visible "Feedback" button (bottom-right, above the mobile tab
 * bar) and the form it opens. Sends the page the tester is on along with
 * the text, so the team knows which screen the feedback is about.
 */
export function FeedbackWidget() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FeedbackDraft>(EMPTY_DRAFT);
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const buttonRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    // The draft is kept for next time; a finished one isn't.
    if (status === "sent") setStatus("idle");
    buttonRef.current?.focus();
  }

  function submit() {
    setStatus("sending");
    sendFeedback({
      message: draft.message.trim(),
      suggestion: draft.suggestion.trim() || null,
      page: pathname,
    })
      .then(() => {
        setDraft(EMPTY_DRAFT);
        setStatus("sent");
      })
      .catch(() => setStatus("error"));
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        // Keeps the button's name when the text is hidden (icon-only on mobile).
        aria-label="Feedback"
      >
        <MessageIcon className={styles.icon} aria-hidden="true" />
        <span className={styles.text}>Feedback</span>
      </button>

      {open && (
        <FeedbackDialog
          draft={draft}
          onDraftChange={setDraft}
          status={status}
          onSubmit={submit}
          onWriteAnother={() => setStatus("idle")}
          onClose={close}
        />
      )}
    </>
  );
}
