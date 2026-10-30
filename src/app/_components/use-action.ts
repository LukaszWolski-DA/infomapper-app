"use client";

import { useCallback, useContext, useTransition } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import { useToast } from "@/ui/components/toast";
import { rowSaves, type SaveRowsRow } from "@/ui/row-saves";
import type { ActionResult } from "../_lib/run-command";

/**
 * Runs a server action. A refusal (permission, archive, stale version, invalid input) is shown as a toast with
 * the domain's message; on success the optional message is shown, with “Undo” when `undoable` and the page has
 * undo (destructive actions, slice 1b), and the versions the write answers with go to `rowSaves` (slice 10a). Returns
 * the result for follow-up steps.
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
          // the versions a write answers with (slice 10a, F2): the next saves of those rows send them
          if (result.ok && result.versions) rowSaves.answer(result.versions);
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

  /**
   * Runs a save of one row as `run` does, after that row's earlier saves and with the newest version known when it is
   * sent (slice 9, `rowSaves`): `row` is the row as the panel shows it, `action` gets the version to send. A save that a
   * refusal before it cut comes back as `CUT`, without a toast of its own. `deletes`: the action deletes the row, so the
   * row's saves waiting behind it are cut once it succeeds (slice 10a, F5).
   */
  const saveRow = useCallback(
    <T,>(row: { id: string; version: number }, action: (expectedVersion: number) => Promise<ActionResult<T>>, success?: string | ((value: T) => string), options?: SaveOptions) =>
      rowSaves.save(row.id, row.version, (v) => run(() => action(v), success, options), { deletes: options?.deletes }).then((r): ActionResult<T> => r ?? CUT),
    [run],
  );

  /**
   * Runs a save that writes several rows (slice 10a, `rowSaves.saveRows`): `rows` are the rows it writes, with `shown`
   * where it sends their version; `action` gets the version to send of each of those. Cut as `saveRow`.
   */
  const saveRows = useCallback(
    <T,>(rows: readonly SaveRowsRow[], action: (versionOf: (id: string) => number) => Promise<ActionResult<T>>, success?: string | ((value: T) => string), options?: SaveOptions) =>
      rowSaves.saveRows(rows, (versionOf) => run(() => action(versionOf), success, options), { deletes: options?.deletes }).then((r): ActionResult<T> => r ?? CUT),
    [run],
  );

  return { run, saveRow, saveRows, pending };
}

/** A save's options: “Undo” in its toast (`undoable`), and whether it deletes its row (`deletes`, slice 10a). */
type SaveOptions = { undoable?: boolean; deletes?: boolean };

/** A save not sent: a refusal of an earlier save of the same row cut it (its toast says why). */
export const CUT = { ok: false as const, code: "cut" as const, message: "" };
