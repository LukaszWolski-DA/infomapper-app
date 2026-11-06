// A model command with its workspace and live model loaded (slice 1a; moved here in slice 15a so that a module's
// actions use it too, AD-33): a file with "use server" would make it a server action itself.

import { revalidatePath } from "next/cache";
import { STORE_SCHEMA } from "@/compose";
import { getDataStore, type DataStore } from "@/data";
import type { CommandContext, CommandResult } from "@/domain/changes";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { WorkspaceModel } from "@/domain/types";
import { runCommand, type ActionResult, type CommandOptions } from "./run-command";
import { getSession } from "./session";
import { lockedRefusal } from "./unlock";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };

export async function loadAccess(store: DataStore, workspaceId: unknown, userId: Uuid): Promise<WorkspaceAccess | null> {
  if (typeof workspaceId !== "string") return null;
  const workspace = await store.workspaces.get(workspaceId);
  if (!workspace) return null;
  return { workspace, member: await store.workspaces.getMember(workspace.id, userId) };
}

/**
 * A read with the workspace's live model loaded, for a dialog that asks when it opens (slice 15d, Y5; as
 * `entityImpactAction`): the session, a member of the workspace in any role, an unlocked organization; the composed store
 * (the modules' tables), no write and no fresh page.
 */
export async function modelRead<T>(
  workspaceId: unknown,
  read: (access: WorkspaceAccess, model: WorkspaceModel, store: DataStore) => Promise<T> | T,
): Promise<ActionResult<T>> {
  const session = await getSession();
  if (!session) return { ok: false, code: "unauthenticated", message: "Your session has ended. Sign in again." };
  const store = getDataStore(STORE_SCHEMA);
  const access = await loadAccess(store, workspaceId, session.user.id);
  if (!access?.member) return { ok: false, code: "not_found", message: NOT_FOUND.error.message };
  const locked = await lockedRefusal(store, session.unlocked, access.workspace.organization_id);
  if (locked) return locked;
  return { ok: true, value: await read(access, await store.model.load(access.workspace.id), store) };
}

/** Runs a model command with the workspace's live model loaded; on success the pages are fresh again. */
export async function modelCommand<T>(
  workspaceId: unknown,
  build: (ctx: CommandContext, access: WorkspaceAccess, model: WorkspaceModel, store: DataStore) => Promise<CommandResult<T>> | CommandResult<T>,
  options: CommandOptions = {},
): Promise<ActionResult<T>> {
  const result = await runCommand<T>(async (ctx, store, user) => {
    const access = await loadAccess(store, workspaceId, user.id);
    if (!access) return NOT_FOUND;
    return build(ctx, access, await store.model.load(access.workspace.id), store);
  }, options);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
