import "server-only";
import { getDataStore, type DataStore } from "@/data";
import type { CommandContext, CommandResult, WriteSet } from "@/domain/changes";
import { completeLiveWrites, touchesLiveCanvases, type LiveOutcome } from "@/domain/commands/live";
import { isUndoable } from "@/domain/commands/undo";
import type { DomainErrorCode } from "@/domain/errors";
import { uuidv7 } from "@/domain/ids";
import { changeLabel } from "@/domain/model/change-label";
import { recordChange } from "@/domain/model/undo-history";
import type { AppUser } from "@/domain/types";
import { loadLiveState } from "./live-state";
import { getSessionUser } from "./session";

/** What a server action returns to the browser: the value, or the domain's message to show in a toast. */
export type ActionResult<T = undefined> =
  | { ok: true; value: T; live?: LiveOutcome }
  | { ok: false; code: DomainErrorCode | "unauthenticated" | "unexpected"; message: string };

/**
 * Runs one write (AD-23): the signed-in user, a fresh context, the domain command, then the live canvas rules (slice
 * 3b: what labels mark and what live canvases hold, in the same change group; `completeLiveWrites`), then the adapter
 * applies the rows and change events together, and the change group goes into the person's undo history (slice 1b).
 * Refusals come back with the domain's message.
 */
export async function runCommand<T>(
  build: (ctx: CommandContext, store: DataStore, user: AppUser) => Promise<CommandResult<T>>,
): Promise<ActionResult<T>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, code: "unauthenticated", message: "Your session has ended. Sign in again." };
  const store = getDataStore();
  const ctx: CommandContext = { actorId: user.id, now: new Date().toISOString(), newId: () => uuidv7() };
  try {
    const result = await build(ctx, store, user);
    if (!result.ok) return { ok: false, code: result.error.code, message: result.error.message };
    const completed = await withLiveCanvases(ctx, store, user, result.writeSet);
    if (!completed.ok) return { ok: false, code: completed.error.code, message: completed.error.message };
    const applied = await store.apply(completed.writeSet);
    if (!applied.ok) return { ok: false, code: applied.error.code, message: applied.error.message };
    await remember(store, user.id, completed.writeSet);
    return { ok: true, value: result.value, ...(completed.value.canvases.length || completed.value.labeled ? { live: completed.value } : {}) };
  } catch (e) {
    // No row content in the log (personal data, rich text): only what kind of error it was.
    console.error("Write failed:", e instanceof Error ? `${e.name}: ${e.message}` : "unknown error");
    return { ok: false, code: "unexpected", message: "Something went wrong. Nothing was saved." };
  }
}

/** The live canvas rules for a write set, when it can change what labels mark or what a live canvas holds (slice 3b). */
export async function withLiveCanvases(
  ctx: CommandContext,
  store: DataStore,
  user: AppUser,
  writeSet: WriteSet,
  options: { revert?: boolean } = {},
): Promise<CommandResult<LiveOutcome>> {
  const workspaceId = writeSet.events[0]?.workspace_id;
  if (!workspaceId || !touchesLiveCanvases(writeSet.writes)) return { ok: true, value: { labeled: 0, canvases: [] }, writeSet };
  const workspace = await store.workspaces.get(workspaceId);
  if (!workspace) return { ok: true, value: { labeled: 0, canvases: [] }, writeSet };
  const access = { workspace, member: await store.workspaces.getMember(workspaceId, user.id) };
  return completeLiveWrites(ctx, access, await loadLiveState(store, workspaceId), writeSet, options);
}

/** A change of the model or the layout can be undone; settings, people and a canvas's look cannot. */
async function remember(store: DataStore, userId: AppUser["id"], writeSet: WriteSet): Promise<void> {
  const workspaceId = writeSet.events[0]?.workspace_id;
  if (!workspaceId || !isUndoable(writeSet.events)) return;
  const step = { changeGroupId: writeSet.changeGroupId, label: changeLabel(writeSet.events), events: writeSet.events };
  await store.undoHistory.update(workspaceId, userId, (h) => recordChange(h, step));
}
