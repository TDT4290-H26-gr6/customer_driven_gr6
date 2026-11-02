import { createContext, useContext, useState, type ReactNode } from "react";

type FeedbackContextValue = {
  /** Whether the feedback window is open. */
  open: boolean;
  openFeedback: () => void;
  closeFeedback: () => void;
};

// Outside the provider (a component rendered on its own, in a test), the
// window just never opens.
const FeedbackContext = createContext<FeedbackContextValue>({
  open: false,
  openFeedback: () => {},
  closeFeedback: () => {},
});

/**
 * Whether the feedback window is open, app-wide: FeedbackWidget shows it,
 * and anything else can open it, e.g. the "How was it?" prompt after an
 * assessment. Above the routes, not in AppShell, because finishing an
 * assessment passes through "/" (outside AppShell) on its way to the
 * dashboard, which would otherwise forget a request to open it.
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <FeedbackContext.Provider
      value={{ open, openFeedback: () => setOpen(true), closeFeedback: () => setOpen(false) }}
    >
      {children}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  return useContext(FeedbackContext);
}
