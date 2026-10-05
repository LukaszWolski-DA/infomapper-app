import "server-only";
import { getDataStore, type DataStore } from "@/data";
import type { CommandContext, CommandResult, WriteSet } from "@/domain/changes";
import { isUndoable } from "@/domain/commands/undo";
import type { DomainErrorCode } from "@/domain/errors";
import { uuidv7 } from "@/domain/ids";
import { changeLabel } from "@/domain/model/change-label";
import { recordChange } from "@/domain/model/undo-history";
import type { AppUser } from "@/domain/types";
import { getSessionUser } from "./session";

/** What a server action returns to the browser: the value, or the domain's message to show in a toast. */
export type ActionResult<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; code: DomainErrorCode | "unauthenticated" | "unexpected"; message: string };

/**
 * Runs one write (AD-23): the signed-in user, a fresh context, the domain command, then the adapter applies
 * the rows and change events together, and the change group goes into the person's undo history (slice 1b).
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
    const applied = await store.apply(result.writeSet);
    if (!applied.ok) return { ok: false, code: applied.error.code, message: applied.error.message };
    await remember(store, user.id, result.writeSet);
    return { ok: true, value: result.value };
  } catch (e) {
    // No row content in the log (personal data, rich text): only what kind of error it was.
    console.error("Write failed:", e instanceof Error ? `${e.name}: ${e.message}` : "unknown error");
    return { ok: false, code: "unexpected", message: "Something went wrong. Nothing was saved." };
  }
}

/** A change of the model or the layout can be undone; settings, people and a canvas's look cannot. */
async function remember(store: DataStore, userId: AppUser["id"], writeSet: WriteSet): Promise<void> {
  const workspaceId = writeSet.events[0]?.workspace_id;
  if (!workspaceId || !isUndoable(writeSet.events)) return;
  const step = { changeGroupId: writeSet.changeGroupId, label: changeLabel(writeSet.events), events: writeSet.events };
  await store.undoHistory.update(workspaceId, userId, (h) => recordChange(h, step));
}
