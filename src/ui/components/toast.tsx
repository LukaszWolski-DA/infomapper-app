"use client";

// One toast at a time, bottom centre, as in the prototype: a dark pill that fades out.
// Refusals stay a little longer so their message can be read; so does a toast with an action (“Undo”, slice 1b).

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type ToastKind = "info" | "refusal";
/** A link in the toast, such as “Undo”. */
export interface ToastAction {
  label: string;
  run: () => void;
}
interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
  action?: ToastAction;
}

const ToastContext = createContext<(message: string, kind?: ToastKind, action?: ToastAction) => void>(() => {});

export const useToast = () => useContext(ToastContext);

const DURATION: Record<ToastKind, number> = { info: 2200, refusal: 5000 };
const WITH_ACTION = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((message: string, kind: ToastKind = "info", action?: ToastAction) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, kind, action });
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), action ? WITH_ACTION : DURATION[kind]);
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
        <span className="py-[3px]" data-testid="toast-message">
          {toast?.message}
        </span>
        {toast?.action && (
          <button
            type="button"
            data-testid="toast-action"
            className="flex-none rounded-md px-1.5 py-1 font-semibold text-im-surface underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-im-surface"
            onClick={() => {
              clearTimeout(timer.current);
              setVisible(false);
              toast.action!.run();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </ToastContext.Provider>
  );
}
