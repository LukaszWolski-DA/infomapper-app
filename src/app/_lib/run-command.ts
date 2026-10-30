import "server-only";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getDataStore, type DataStore } from "@/data";
import { buildWriteSet, writtenVersions, type CommandContext, type CommandResult, type WriteSet } from "@/domain/changes";
import { completeLiveWrites, touchesLiveCanvases, type LiveOutcome } from "@/domain/commands/live";
import { CONTEXT_LABEL_GONE, contextTargets } from "@/domain/model/live";
import { isUndoable } from "@/domain/commands/undo";
import type { DomainErrorCode } from "@/domain/errors";
import { ACCOUNT_EXISTS_MESSAGE } from "@/domain/commands/organization";
import { uuidv7 } from "@/domain/ids";
import { changeLabel } from "@/domain/model/change-label";
import { recordChange } from "@/domain/model/undo-history";
import { isOpen } from "@/domain/source-changes/rules";
import { settleAfterWrites } from "@/domain/source-changes/settle";
import type { AppUser } from "@/domain/types";
import { contextCookieName, parseContextCookie } from "@/ui/working-context-cookie";
import { retryWhenStale } from "./fresh-retry";
import { recordLiveNotices } from "./live-notices";
import { loadLiveState } from "./live-state";
import { getSession } from "./session";
import { lockedRefusal, organizationOfWrite } from "./unlock";

/** What a server action returns to the browser: the value, or the domain's message to show in a toast. */
export type ActionResult<T = undefined> =
  /**
   * `versions`: the new version of every row the write wrote, for the writes that opt in (`runCommand`'s `versions`,
   * slice 10a, F2); the browser's next saves of those rows send them (`rowSaves`).
   */
  | { ok: true; value: T; live?: LiveOutcome; versions?: Record<string, number> }
  /** `fields`: the domain's field messages, when it gave some (slice 7a: P8's refusal says `review: "stale"`). */
  | { ok: false; code: DomainErrorCode | "unauthenticated" | "unexpected" | "cut"; message: string; fields?: Record<string, string> };

/** How `runCommand` runs a write. */
export interface CommandOptions {
  /** A write refused as stale is built again from fresh data once (slice 4a). */
  freshOnStale?: boolean;
  /** The answer carries `versions` (slice 10a, F2). */
  versions?: boolean;
}

/**
 * What a panel's save returns (slice 9, F3): the row's new version, with the action's own values. The next save of the
 * same row sends it (`src/ui/row-saves.ts`), before the fresh page shows it.
 */
export type Saved<T extends object = object> = T & { version: number };

/**
 * Runs one write (AD-23): the signed-in user, a fresh context, the domain command, then the changes to resolve it
 * settles (slice 7b, Q12: a deleted object, a status set in the mapping panel, a column mapped; `settleAfterWrites`),
 * then the live canvas rules (slice 3b: what labels mark and what live canvases hold, in the same change group;
 * `completeLiveWrites`), then the adapter applies the rows and change events together, and the change group goes into
 * the person's undo history (slice 1b). Refusals come back with the domain's message. With `freshOnStale`, a write
 * refused as stale is built again from fresh data (slice 4a: the requirement key counter, `fresh-retry.ts`). A write
 * into an organization this session has not unlocked is refused before anything is applied (slice 8, F3). With
 * `versions`, the answer carries the new version of every row written, the settled changes and the live step's included
 * (slice 10a, F2).
 */
export async function runCommand<T>(
  build: (ctx: CommandContext, store: DataStore, user: AppUser) => Promise<CommandResult<T>>,
  options: CommandOptions = {},
): Promise<ActionResult<T>> {
  const session = await getSession();
  if (!session) return { ok: false, code: "unauthenticated", message: "Your session has ended. Sign in again." };
  const { user } = session;
  const store = getDataStore();
  const once = async (): Promise<ActionResult<T>> => {
    const ctx: CommandContext = { actorId: user.id, now: new Date().toISOString(), newId: () => uuidv7() };
    const result = await build(ctx, store, user);
    if (!result.ok) return { ok: false, code: result.error.code, message: result.error.message, ...(result.error.fields ? { fields: result.error.fields } : {}) };
    const organizationId = await organizationOfWrite(store, result.writeSet);
    if (organizationId && organizationId !== "new") {
      const locked = await lockedRefusal(store, session.unlocked, organizationId);
      if (locked) return locked;
    }
    const workspaceId = result.writeSet.events[0]?.workspace_id;
    const contextLabelId = workspaceId ? parseContextCookie((await cookies()).get(contextCookieName(user.id, workspaceId))?.value)?.labelId : null;
    const settled = await withSettledChanges(ctx, store, result.writeSet);
    const completed = await withLiveCanvases(ctx, store, user, settled, { contextLabelId });
    if (!completed.ok) {
      // the context's label is gone: a fresh page lets the browser switch the context off (slice 3b, PRD item 3)
      if (completed.error.message === CONTEXT_LABEL_GONE) revalidatePath("/", "layout");
      return { ok: false, code: completed.error.code, message: completed.error.message };
    }
    const applied = await store.apply(completed.writeSet);
    if (!applied.ok) return { ok: false, code: applied.error.code, message: applied.error.message };
    await remember(store, user.id, completed.writeSet);
    if (completed.value.canvases.length) recordLiveNotices(user.id, completed.value);
    return {
      ok: true,
      value: result.value,
      ...(completed.value.canvases.length || completed.value.labeled ? { live: completed.value } : {}),
      ...(options.versions ? { versions: writtenVersions(completed.writeSet.writes) } : {}),
    };
  };
  try {
    return options.freshOnStale ? await retryWhenStale(once, (r) => !r.ok && r.code === "stale_version") : await once();
  } catch (e) {
    // No row content in the log (personal data, rich text): only what kind of error it was.
    console.error("Write failed:", e instanceof Error ? `${e.name}: ${e.message}` : "unknown error");
    return { ok: false, code: "unexpected", message: "Something went wrong. Nothing was saved." };
  }
}

/**
 * Runs a write without a session (slice 8, F2): creating an organization from the start page, where the actor is the
 * person the command creates (`actorId`, made by the caller). No live canvases or changes to resolve can be involved
 * (a new workspace has none), and nothing goes into an undo history. An e-mail address taken meanwhile by another write
 * comes back as the domain's refusal.
 */
export async function runCommandAs<T>(
  actorId: string,
  build: (ctx: CommandContext, store: DataStore) => Promise<CommandResult<T>>,
): Promise<ActionResult<T>> {
  const store = getDataStore();
  try {
    const ctx: CommandContext = { actorId, now: new Date().toISOString(), newId: () => uuidv7() };
    const result = await build(ctx, store);
    if (!result.ok) return { ok: false, code: result.error.code, message: result.error.message, ...(result.error.fields ? { fields: result.error.fields } : {}) };
    const applied = await store.apply(result.writeSet);
    if (!applied.ok) {
      if (applied.error.code === "conflict" && applied.error.message.includes("app_user")) {
        return { ok: false, code: "conflict", message: ACCOUNT_EXISTS_MESSAGE, fields: { email: ACCOUNT_EXISTS_MESSAGE } };
      }
      return { ok: false, code: applied.error.code, message: applied.error.message };
    }
    return { ok: true, value: result.value };
  } catch (e) {
    console.error("Write failed:", e instanceof Error ? `${e.name}: ${e.message}` : "unknown error");
    return { ok: false, code: "unexpected", message: "Something went wrong. Nothing was saved." };
  }
}

/**
 * The live canvas rules for a write set (slice 3b): with the working context on (`contextLabelId`, from the person's
 * browser), or when it can change what labels mark or what a live canvas holds. A layout change with the context on
 * needs only the labels (to check the context and record it); the rest loads the whole live state.
 */
export async function withLiveCanvases(
  ctx: CommandContext,
  store: DataStore,
  user: AppUser,
  writeSet: WriteSet,
  options: { revert?: boolean; contextLabelId?: string | null } = {},
): Promise<CommandResult<LiveOutcome>> {
  const none = { ok: true as const, value: { labeled: 0, canvases: [] }, writeSet };
  const workspaceId = writeSet.events[0]?.workspace_id;
  const contextLabelId = options.revert ? null : (options.contextLabelId ?? null);
  const touches = touchesLiveCanvases(writeSet.writes);
  if (!workspaceId || (!touches && !contextLabelId)) return none;
  const workspace = await store.workspaces.get(workspaceId);
  if (!workspace) return none;
  const access = { workspace, member: await store.workspaces.getMember(workspaceId, user.id) };
  const full = touches || contextTargets(writeSet.writes, writeSet.mainTargets, writeSet.followers).length > 0;
  const state = full ? await loadLiveState(store, workspaceId) : { ...EMPTY_LIVE_STATE, labels: await store.labels.list(workspaceId) };
  return completeLiveWrites(ctx, access, state, writeSet, { revert: options.revert, contextLabelId });
}

/** The tables whose writes can settle a change to resolve (slice 7b, `settleAfterWrites`). */
const SETTLING_TABLES = new Set(["entity", "attribute", "mapping", "mapping_input", "source_table", "source_column", "classification", "classification_link"]);

/** The write set with the open changes it settles, in its change group; read only when it may settle one. */
export async function withSettledChanges(ctx: CommandContext, store: DataStore, writeSet: WriteSet): Promise<WriteSet> {
  const workspaceId = writeSet.events[0]?.workspace_id;
  if (!workspaceId || writeSet.labelNothing || !writeSet.writes.some((w) => SETTLING_TABLES.has(w.table))) return writeSet;
  const changes = await store.model.listChanges(workspaceId);
  if (!changes.some(isOpen)) return writeSet;
  const extra = settleAfterWrites(ctx, writeSet.writes, changes, await store.model.load(workspaceId));
  if (!extra.length) return writeSet;
  const rebuilt = buildWriteSet(ctx, workspaceId, [...writeSet.writes, ...extra]);
  return { ...writeSet, writes: rebuilt.writes, events: rebuilt.events.map((e) => ({ ...e, change_group_id: writeSet.changeGroupId })) };
}

const EMPTY_LIVE_STATE = {

  entities: [],
  attributes: [],
  sourceTables: [],
  sourceColumns: [],
  mappings: [],
  mappingInputs: [],
  concepts: [],
  sourceSystems: [],
  labels: [],
  labelLinks: [],
  canvases: [],
  canvasItems: [],
  frames: [],
  notes: [],
};

/** A change of the model or the layout can be undone; settings, people and a canvas's look cannot. */
async function remember(store: DataStore, userId: AppUser["id"], writeSet: WriteSet): Promise<void> {
  const workspaceId = writeSet.events[0]?.workspace_id;
  if (!workspaceId || !isUndoable(writeSet.events)) return;
  const step = { changeGroupId: writeSet.changeGroupId, label: writeSet.label ?? changeLabel(writeSet.events), events: writeSet.events };
  await store.undoHistory.update(workspaceId, userId, (h) => recordChange(h, step));
}
