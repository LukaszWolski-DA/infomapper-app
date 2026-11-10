"use server";

// Entity stereotypes (slice 24, D-79; items 3–7): the workspace's list, edited in the Metadata conventions tab. Each is
// one write through its domain command (AD-23), one change group, one undo step; the commands check the role and the
// archive (D-57's roles).

import { revalidatePath } from "next/cache";
import type { DataStore } from "@/data";
import type { CommandContext, CommandResult } from "@/domain/changes";
import {
  addStereotype,
  removeStereotype,
  renameStereotype,
  setStereotypeDefinition,
  type AddStereotypeInput,
  type RemoveStereotypeInput,
  type RenameStereotypeInput,
  type SetStereotypeDefinitionInput,
} from "@/domain/commands/stereotype";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { WorkspaceModel } from "@/domain/types";
import { runCommand, type ActionResult, type Saved } from "../_lib/run-command";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };

async function loadAccess(store: DataStore, workspaceId: unknown, userId: Uuid): Promise<WorkspaceAccess | null> {
  if (typeof workspaceId !== "string") return null;
  const workspace = await store.workspaces.get(workspaceId);
  if (!workspace) return null;
  return { workspace, member: await store.workspaces.getMember(workspace.id, userId) };
}

/** Runs a command with the workspace's model; on success the pages are fresh again (cards, tree and panels show names). */
async function command<T>(workspaceId: unknown, build: (ctx: CommandContext, access: WorkspaceAccess, model: WorkspaceModel) => CommandResult<T>): Promise<ActionResult<T>> {
  const result = await runCommand<T>(async (ctx, store, user) => {
    const access = await loadAccess(store, workspaceId, user.id);
    if (!access) return NOT_FOUND;
    return build(ctx, access, await store.model.load(access.workspace.id));
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

const value = <T, V>(r: CommandResult<T>, pick: (v: T) => V): CommandResult<V> => (r.ok ? { ...r, value: pick(r.value) } : r);

export async function addStereotypeAction(workspaceId: string, input: AddStereotypeInput): Promise<ActionResult<{ stereotypeId: string; name: string; code: string }>> {
  return command(workspaceId, (ctx, access, m) =>
    value(addStereotype(ctx, access, m, input), (v) => ({ stereotypeId: v.stereotype.id, name: v.stereotype.name, code: v.stereotype.code })),
  );
}

export async function renameStereotypeAction(workspaceId: string, input: RenameStereotypeInput): Promise<ActionResult<Saved<{ name: string }>>> {
  return command(workspaceId, (ctx, access, m) => value(renameStereotype(ctx, access, m, input), (v) => ({ name: v.stereotype.name, version: v.stereotype.version })));
}

export async function setStereotypeDefinitionAction(workspaceId: string, input: SetStereotypeDefinitionInput): Promise<ActionResult<Saved<{ name: string; removed: boolean }>>> {
  return command(workspaceId, (ctx, access, m) =>
    value(setStereotypeDefinition(ctx, access, m, input), (v) => ({ name: v.name, removed: v.removed, version: v.stereotype.version })),
  );
}

/** An own one, its entities moved to `moveTo` in the same change group (F16); the answer's count is the server's. */
export async function removeStereotypeAction(workspaceId: string, input: RemoveStereotypeInput): Promise<ActionResult<{ name: string; moved: number; movedTo: string | null }>> {
  return command(workspaceId, (ctx, access, m) => removeStereotype(ctx, access, { stereotypes: m.stereotypes, entities: m.entities }, input));
}
