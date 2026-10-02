"use client";

// One toast at a time, bottom centre, as in the prototype: a dark pill that fades out.
// Refusals stay a little longer so their message can be read.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type ToastKind = "info" | "refusal";
interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export const useToast = () => useContext(ToastContext);

const DURATION: Record<ToastKind, number> = { info: 2200, refusal: 5000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, kind });
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), DURATION[kind]);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        data-testid="toast"
        data-kind={toast?.kind}
        data-visible={visible}
        className={
          "fixed bottom-11 left-1/2 z-50 flex max-w-[min(560px,90vw)] items-center gap-3 rounded-lg bg-im-ink py-2 pl-3.5 pr-2 text-im-surface shadow-[0_10px_30px_-10px_var(--im-shadow)] transition-[opacity,transform] duration-150 " +
          (visible ? "-translate-x-1/2 translate-y-0 opacity-100" : "pointer-events-none -translate-x-1/2 translate-y-3 opacity-0")
        }
      >
        <span className="py-[3px]">{toast?.message}</span>
      </div>
    </ToastContext.Provider>
  );
}
