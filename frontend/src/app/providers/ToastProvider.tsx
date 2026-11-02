import { createContext, useContext, useState, type ReactNode } from "react";
import { Toast, type ToastContent } from "@/shared/components/Toast";

type ToastContextValue = { showToast: (toast: ToastContent) => void };

// Outside the provider (a component rendered on its own, in a test), a
// toast is just not shown.
const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

/**
 * Shows one toast at a time (a newer one replaces it). Above the routes, so
 * a toast shown just before navigating (e.g. when an assessment finishes)
 * stays up on the page that follows.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastContent & { id: number }) | null>(null);

  function showToast(content: ToastContent) {
    setToast({ ...content, id: Date.now() });
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && <Toast key={toast.id} {...toast} onClose={() => setToast(null)} />}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
