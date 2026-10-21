import { useRef, useState, type ReactNode } from "react";
import { InformationLetterModal } from "./InformationLetterModal";
import styles from "./InformationLetterLink.module.css";

/**
 * A link-styled button that opens the information letter in a modal, used by
 * the profile step's consent checkbox and by Settings. Focus goes back to the
 * button when the modal closes.
 */
export function InformationLetterLink({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <>
      <button ref={buttonRef} type="button" className={styles.link} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && <InformationLetterModal onClose={close} />}
    </>
  );
}
