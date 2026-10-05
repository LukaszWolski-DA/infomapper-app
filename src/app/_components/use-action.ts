"use client";

import { useCallback, useContext, useTransition } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import { useToast } from "@/ui/components/toast";
import type { ActionResult } from "../_lib/run-command";

/**
 * Runs a server action. A refusal (permission, archive, stale version, invalid input) is shown as a toast with
 * the domain's message; on success the optional message is shown, with “Undo” when `undoable` and the page has
 * undo (destructive actions, slice 1b). Returns the result for follow-up steps.
 */
export function useAction() {
  const toast = useToast();
  const ui = useContext(CanvasUiCtx);
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    <T,>(action: () => Promise<ActionResult<T>>, success?: string | ((value: T) => string), options?: { undoable?: boolean }) =>
      new Promise<ActionResult<T>>((resolve) => {
        startTransition(async () => {
          let result: ActionResult<T>;
          try {
            result = await action();
          } catch {
            result = { ok: false, code: "unexpected", message: "Something went wrong. Nothing was saved." };
          }
          if (!result.ok) toast(result.message, "refusal");
          else if (success) {
            const undo = options?.undoable ? ui.undo() : null;
            toast(typeof success === "function" ? success(result.value) : success, "info", undo ? { label: "Undo", run: undo.undo } : undefined);
          }
          resolve(result);
        });
      }),
    [toast, ui],
  );

  return { run, pending };
}
