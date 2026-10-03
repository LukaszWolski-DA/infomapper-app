"use client";

import { useCallback, useTransition } from "react";
import { useToast } from "@/ui/components/toast";
import type { ActionResult } from "../_lib/run-command";

/**
 * Runs a server action. A refusal (permission, archive, stale version, invalid input) is shown as a toast with
 * the domain's message; on success the optional message is shown. Returns the result for follow-up steps.
 */
export function useAction() {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    <T,>(action: () => Promise<ActionResult<T>>, success?: string | ((value: T) => string)) =>
      new Promise<ActionResult<T>>((resolve) => {
        startTransition(async () => {
          let result: ActionResult<T>;
          try {
            result = await action();
          } catch {
            result = { ok: false, code: "unexpected", message: "Something went wrong. Nothing was saved." };
          }
          if (!result.ok) toast(result.message, "refusal");
          else if (success) toast(typeof success === "function" ? success(result.value) : success);
          resolve(result);
        });
      }),
    [toast],
  );

  return { run, pending };
}
