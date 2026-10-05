"use server";

// Undo and redo (slice 1b): the person's last change group in this workspace is reverted as a new change group
// (`revertChangeGroup`). A step that was changed afterwards is dropped from the history with a toast that says so,
// and the next Ctrl+Z goes further back (Łukasz, 4 October 2026). Other refusals (archive, role) keep the step.

import { revalidatePath } from "next/cache";
import { getDataStore } from "@/data";
import type { CommandContext } from "@/domain/changes";
import { revertChangeGroup } from "@/domain/commands/undo";
import { uuidv7 } from "@/domain/ids";
import {
  afterRedo,
  afterUndo,
  dropNextRedo,
  dropNextUndo,
  nextRedo,
  nextUndo,
  refusedStepMessage,
  type UndoHistory,
} from "@/domain/model/undo-history";
import type { ActionResult } from "../_lib/run-command";
import { getSessionUser } from "../_lib/session";

export interface UndoState {
  canUndo: boolean;
  canRedo: boolean;
}

export interface UndoOutcome extends UndoState {
  /** What was undone or redone, e.g. “Delete mapping”. */
  label: string;
}

const stateOf = (h: UndoHistory): UndoState => ({ canUndo: h.undo.length > 0, canRedo: h.redo.length > 0 });
const NOTHING = { undo: "Nothing to undo.", redo: "Nothing to redo." } as const;

/** Undoes (or redoes) the signed-in person's last step in the workspace. */
export async function undoAction(workspaceId: string, mode: "undo" | "redo"): Promise<ActionResult<UndoOutcome>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, code: "unauthenticated", message: "Your session has ended. Sign in again." };
  if (mode !== "undo" && mode !== "redo") return { ok: false, code: "invalid", message: "Undo or redo?" };
  const store = getDataStore();
  const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
  if (!workspace) return { ok: false, code: "not_found", message: "This workspace does not exist." };
  const access = { workspace, member: await store.workspaces.getMember(workspace.id, user.id) };

  try {
    const history = await store.undoHistory.get(workspace.id, user.id);
    const step = mode === "undo" ? nextUndo(history) : nextRedo(history);
    if (!step) return { ok: false, code: "invalid", message: NOTHING[mode] };
    /** The step is still the next one: a second Ctrl+Z on its way does not drop or move a different one. */
    const isNext = (h: UndoHistory) => (mode === "undo" ? nextUndo(h) : nextRedo(h))?.changeGroupId === step.changeGroupId;
    const drop = async () => {
      await store.undoHistory.update(workspace.id, user.id, (h) => (isNext(h) ? (mode === "undo" ? dropNextUndo(h) : dropNextRedo(h)) : h));
      revalidatePath("/", "layout");
      return { ok: false as const, code: "conflict" as const, message: refusedStepMessage(mode, step.label) };
    };

    const ctx: CommandContext = { actorId: user.id, now: new Date().toISOString(), newId: () => uuidv7() };
    const result = revertChangeGroup(ctx, access, { events: step.events, rows: await store.model.loadForUndo(workspace.id) }, mode);
    if (!result.ok) return result.error.code === "conflict" ? drop() : { ok: false, code: result.error.code, message: result.error.message };
    const applied = await store.apply(result.writeSet);
    if (!applied.ok) {
      // Changed between reading and writing: the same as changed afterwards.
      return applied.error.code === "stale_version" || applied.error.code === "conflict" || applied.error.code === "not_found"
        ? drop()
        : { ok: false, code: applied.error.code, message: applied.error.message };
    }
    const revert = { changeGroupId: result.writeSet.changeGroupId, label: step.label, events: result.writeSet.events };
    const next = await store.undoHistory.update(workspace.id, user.id, (h) =>
      isNext(h) ? (mode === "undo" ? afterUndo(h, revert) : afterRedo(h, revert)) : h,
    );
    revalidatePath("/", "layout");
    return { ok: true, value: { label: step.label, ...stateOf(next) } };
  } catch (e) {
    console.error("Undo failed:", e instanceof Error ? `${e.name}: ${e.message}` : "unknown error");
    return { ok: false, code: "unexpected", message: "Something went wrong. Nothing was changed." };
  }
}
