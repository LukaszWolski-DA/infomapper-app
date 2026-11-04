"use client";

import { useCallback, useContext, useEffect, useRef, useTransition } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import { useToast } from "@/ui/components/toast";
import { rowSaves, type SaveRowsRow } from "@/ui/row-saves";
import type { ActionResult } from "../_lib/run-command";
import { useUndoNow } from "./undo";

/**
 * Runs a server action. A refusal (permission, archive, stale version, invalid input) is shown as a toast with
 * the domain's message; on success the optional message is shown, with “Undo” when `undoable` and the page has
 * undo (destructive actions, slice 1b; a canvas's, else the page's `UndoProvider` on the home pages, slice 12a), and
 * the versions the write answers with go to `rowSaves` (slice 10a). Returns the result for follow-up steps.
 */
export function useAction() {
  const toast = useToast();
  const ui = useContext(CanvasUiCtx);
  const undoNow = useUndoNow();
  const [pending, startTransition] = useTransition();
  /**
   * Refusals of a row's save that bring the fresh page (slice 13, F3), answered only once the transition that applies
   * it has committed: a field then reads the newest stored value and version, and a save sent right after it is not
   * refused again with the old version. Flushed when the transition ends, when the component unmounts, and after 3 s at
   * most. Any other action's refusal is answered at once (a paste empties the clipboard with its toast).
   */
  const afterPage = useRef<(() => void)[]>([]);
  const flush = () => {
    const waiting = afterPage.current;
    afterPage.current = [];
    for (const w of waiting) w();
  };
  useEffect(() => {
    if (!pending) flush();
  }, [pending]);
  useEffect(() => flush, []);

  const run = useCallback(
    <T,>(action: () => Promise<ActionResult<T>>, success?: string | ((value: T) => string), options?: RunOptions) =>
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
          if (!result.ok) {
            if (!options?.quiet) toast(result.message, "refusal");
          } else if (success) {
            const undo = options?.undoable ? (ui.undo()?.undo ?? undoNow ?? undefined) : undefined;
            toast(typeof success === "function" ? success(result.value) : success, "info", undo ? { label: "Undo", run: undo } : undefined);
          }
          if (!result.ok && options?.afterPage && REFRESHING.has(result.code)) {
            let done = false;
            const answer = () => {
              if (!done) resolve(result);
              done = true;
            };
            afterPage.current.push(answer);
            setTimeout(answer, 3000);
          } else resolve(result);
        });
      }),
    [toast, ui, undoNow],
  );

  /**
   * Runs a save of one row as `run` does, after that row's earlier saves and with the newest version known when it is
   * sent (slice 9, `rowSaves`): `row` is the row as the panel shows it, `action` gets the version to send. A save that a
   * refusal before it cut comes back as `CUT`, without a toast of its own. `deletes`: the action deletes the row, so the
   * row's saves waiting behind it are cut once it succeeds (slice 10a, F5).
   */
  const saveRow = useCallback(
    <T,>(row: { id: string; version: number }, action: (expectedVersion: number) => Promise<ActionResult<T>>, success?: string | ((value: T) => string), options?: SaveOptions) =>
      rowSaves.save(row.id, row.version, (v) => run(() => action(v), success, { ...options, afterPage: true }), { deletes: options?.deletes }).then((r): ActionResult<T> => r ?? CUT),
    [run],
  );

  /**
   * Runs a save that writes several rows (slice 10a, `rowSaves.saveRows`): `rows` are the rows it writes, with `shown`
   * where it sends their version; `action` gets the version to send of each of those. Cut as `saveRow`.
   */
  const saveRows = useCallback(
    <T,>(rows: readonly SaveRowsRow[], action: (versionOf: (id: string) => number) => Promise<ActionResult<T>>, success?: string | ((value: T) => string), options?: SaveOptions) =>
      rowSaves.saveRows(rows, (versionOf) => run(() => action(versionOf), success, { ...options, afterPage: true }), { deletes: options?.deletes }).then((r): ActionResult<T> => r ?? CUT),
    [run],
  );

  return { run, saveRow, saveRows, pending };
}

/**
 * A save's options: “Undo” in its toast (`undoable`), whether it deletes its row (`deletes`, slice 10a), and `quiet`: a
 * refusal shows no toast, as its field shows it in place (InfoCube's switch, slice 15a).
 */
type SaveOptions = { undoable?: boolean; deletes?: boolean; quiet?: boolean };

/** `run`'s options: “Undo” in its toast, and whether a refusal waits for the fresh page (a row's save, slice 13). */
type RunOptions = { undoable?: boolean; afterPage?: boolean; quiet?: boolean };

/** The refusals whose answer brings the fresh page (`runCommand`, slice 13, F3). */
const REFRESHING = new Set<string>(["stale_version", "forbidden", "archived", "not_found"]);

/** A save not sent: a refusal of an earlier save of the same row cut it (its toast says why). */
export const CUT = { ok: false as const, code: "cut" as const, message: "" };
