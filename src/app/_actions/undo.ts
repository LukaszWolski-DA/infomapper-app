"use server";

// Undo and redo (slice 1b): the person's last change group in this workspace is reverted as a new change group
// (`revertChangeGroup`). A step that was changed afterwards is dropped from the history with a toast that says so,
// and the next Ctrl+Z goes further back (Łukasz, 4 October 2026). Other refusals (archive, role) keep the step.
// Slice 2a: when the step takes the open canvas out of its project (undoing its duplicate, redoing its deletion), the
// canvas to open instead is remembered: the original of an undone duplicate, as in the prototype, else the project's
// first canvas.
// Slice 12a: when the step removes a project (undoing "Create project", redoing a project's delete), that project is
// remembered, so that its page, drawn again, goes to the workspace home with only this step's toast (F2, Q-A).

import { revalidatePath } from "next/cache";
import { STORE_SCHEMA, UNDO_TABLES } from "@/compose";
import { getDataStore } from "@/data";
import { writtenVersions, type CommandContext } from "@/domain/changes";
import { revertChangeGroup } from "@/domain/commands/undo";
import { changeCanvasId } from "@/domain/model/change-label";
import { canvasAfterStep } from "@/domain/model/next-canvas";
import { uuidv7 } from "@/domain/ids";
import { refusedStepMessage } from "@/domain/model/undo-history";
import { rememberGoneProject } from "../_lib/gone-project";
import { rememberNextCanvas } from "../_lib/next-canvas";
import { withLiveCanvases, type ActionResult } from "../_lib/run-command";
import { getSession } from "../_lib/session";
import { withTiming } from "../_lib/timing";
import { lockedRefusal } from "../_lib/unlock";

export interface UndoState {
  canUndo: boolean;
  canRedo: boolean;
}

export interface UndoOutcome extends UndoState {
  /** What was undone or redone, e.g. “Delete mapping”. */
  label: string;
  /** The canvas whose cards it changed, if any, for “… on {canvas}” when another canvas is open. */
  canvas: { id: string; name: string } | null;
  /** The new version of every row the step wrote (slice 9): the panels' next saves of those rows send it. */
  versions: Record<string, number>;
}

const NOTHING = { undo: "Nothing to undo.", redo: "Nothing to redo." } as const;

/** Undoes (or redoes) the signed-in person's last step in the workspace. */
export async function undoAction(
  workspaceId: string,
  mode: "undo" | "redo",
  open?: { projectId: string; canvasId: string },
): Promise<ActionResult<UndoOutcome>> {
  // slice 30 (S30-13): with INFOMAPPER_TIMING=1 one log line of numbers (no id, name or value)
  return withTiming(
    () => revert(workspaceId, mode, open),
    (summary, r) => console.log(`timing ${JSON.stringify({ route: mode, ok: r.ok, ...summary })}`),
  );
}

async function revert(workspaceId: string, mode: "undo" | "redo", open?: { projectId: string; canvasId: string }): Promise<ActionResult<UndoOutcome>> {
  const session = await getSession();
  if (!session) return { ok: false, code: "unauthenticated", message: "Your session has ended. Sign in again." };
  const { user } = session;
  if (mode !== "undo" && mode !== "redo") return { ok: false, code: "invalid", message: "Undo or redo?" };
  const store = getDataStore(STORE_SCHEMA);
  const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
  if (!workspace) return { ok: false, code: "not_found", message: "This workspace does not exist." };
  const locked = await lockedRefusal(store, session.unlocked, workspace.organization_id);
  if (locked) return locked;
  const access = { workspace, member: await store.workspaces.getMember(workspace.id, user.id) };

  try {
    const step = await store.undoHistory.next(workspace.id, user.id, mode);
    if (!step) return { ok: false, code: "invalid", message: NOTHING[mode] };
    // a dropped or moved step is the one read here only while it is still the next one: a second Ctrl+Z on its way
    // drops or moves no other (the port compares, slice 30)
    const drop = async () => {
      await store.undoHistory.drop(workspace.id, user.id, mode, step.changeGroupId);
      revalidatePath("/", "layout");
      return { ok: false as const, code: "conflict" as const, message: refusedStepMessage(mode, step.label) };
    };

    const ctx: CommandContext = { actorId: user.id, now: new Date().toISOString(), newId: () => uuidv7() };
    const reverted = revertChangeGroup(ctx, access, { events: step.events, rows: await store.model.loadForUndo(workspace.id) }, mode, UNDO_TABLES);
    if (!reverted.ok) return reverted.error.code === "conflict" ? drop() : { ok: false, code: reverted.error.code, message: reverted.error.message };
    // live canvases follow what the undo changed in labels and the model (slice 3b), in the same change group; an undo
    // or redo never links the working context or labels a card it brings back (`revert`)
    const result = await withLiveCanvases(ctx, store, user, reverted.writeSet, { revert: true });
    if (!result.ok) return { ok: false, code: result.error.code, message: result.error.message };
    // slice 30 (B3, L1): the access this undo was checked with, read again inside the write
    const checked = { userId: user.id, workspace: { id: workspace.id, name: workspace.name, archived: workspace.archived_at !== null, role: access.member?.role ?? null } };
    // slice 30 (F4): the step moves to the other list with its revert, in the same write
    const history = { userId: user.id, kind: mode === "undo" ? ("undone" as const) : ("redone" as const), stepGroupId: step.changeGroupId, label: step.label };
    const applied = await store.apply(result.writeSet, { access: checked, history });
    if (!applied.ok) {
      // Changed between reading and writing: the same as changed afterwards.
      return (applied.error.code === "stale_version" || applied.error.code === "conflict" || applied.error.code === "not_found")
        ? drop()
        : { ok: false, code: applied.error.code, message: applied.error.message };
    }
    const state = await store.undoHistory.state(workspace.id, user.id);
    if (open && typeof open.projectId === "string" && typeof open.canvasId === "string") {
      const links = await store.canvases.listLinksOfProject(workspace.id, open.projectId);
      const next = canvasAfterStep(open, links, step.events);
      if (next) await rememberNextCanvas(open.canvasId, next);
    }
    for (const w of result.writeSet.writes) {
      if (w.table === "project" && w.kind === "update" && w.before.deleted_at === null && w.row.deleted_at !== null) await rememberGoneProject(w.row.id);
    }
    revalidatePath("/", "layout");
    const canvasId = changeCanvasId(step.events);
    const canvas = canvasId ? await store.canvases.get(workspace.id, canvasId) : null;
    return { ok: true, value: { label: step.label, canvas: canvas ? { id: canvas.id, name: canvas.name } : null, versions: writtenVersions(result.writeSet.writes), ...state } };
  } catch (e) {
    console.error("Undo failed:", e instanceof Error ? `${e.name}: ${e.message}` : "unknown error");
    return { ok: false, code: "unexpected", message: "Something went wrong. Nothing was changed." };
  }
}
