"use server";

// Classifications and notes on sources (slice 7c, items 8–15): the workspace's classification list (add, rename,
// remove with its impact first, restore), a classification set on or cleared from a table or column, and a table's or
// column's note. Each is one write through its domain command (AD-23), one change group, one undo step; the commands
// check the role and the archive (item 12).

import { revalidatePath } from "next/cache";
import { getDataStore, type DataStore } from "@/data";
import type { CommandContext, CommandResult } from "@/domain/changes";
import {
  addClassification,
  classificationImpact,
  removeClassification,
  renameClassification,
  restoreClassification,
  setClassification,
  type AddClassificationInput,
  type ClassificationImpact,
  type RemoveClassificationInput,
  type RenameClassificationInput,
  type RestoreClassificationInput,
  type SetClassificationInput,
} from "@/domain/commands/classification";
import { setSourceNote, type SetSourceNoteInput } from "@/domain/commands/source";
import type { Uuid } from "@/domain/ids";
import { checkPermission, type WorkspaceAccess } from "@/domain/permissions";
import type { Classification, WorkspaceModel } from "@/domain/types";
import { getSessionUser } from "../_lib/session";
import { runCommand, type ActionResult } from "../_lib/run-command";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };

async function loadAccess(store: DataStore, workspaceId: unknown, userId: Uuid): Promise<WorkspaceAccess | null> {
  if (typeof workspaceId !== "string") return null;
  const workspace = await store.workspaces.get(workspaceId);
  if (!workspace) return null;
  return { workspace, member: await store.workspaces.getMember(workspace.id, userId) };
}

/** Runs a command with the workspace's live model; on success the pages are fresh again. */
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

export async function addClassificationAction(workspaceId: string, input: AddClassificationInput): Promise<ActionResult<{ classificationId: string; name: string }>> {
  return command(workspaceId, (ctx, access, m) => value(addClassification(ctx, access, m, input), (v) => ({ classificationId: v.classification.id, name: v.classification.name })));
}

export async function renameClassificationAction(workspaceId: string, input: RenameClassificationInput): Promise<ActionResult<{ name: string }>> {
  return command(workspaceId, (ctx, access, m) => value(renameClassification(ctx, access, m, input), (v) => ({ name: v.classification.name })));
}

export async function removeClassificationAction(workspaceId: string, input: RemoveClassificationInput): Promise<ActionResult<{ name: string; tables: number; columns: number }>> {
  return command(workspaceId, (ctx, access, m) => removeClassification(ctx, access, { classifications: m.classifications, links: m.classificationLinks }, input));
}

export async function restoreClassificationAction(workspaceId: string, input: RestoreClassificationInput): Promise<ActionResult<{ name: string }>> {
  return command(workspaceId, (ctx, access, m) => value(restoreClassification(ctx, access, m, input), (v: { classification: Classification }) => ({ name: v.classification.name })));
}

export async function setClassificationAction(workspaceId: string, input: SetClassificationInput): Promise<ActionResult<{ name: string; objectName: string; on: boolean }>> {
  return command(workspaceId, (ctx, access, m) =>
    setClassification(ctx, access, { classifications: m.classifications, links: m.classificationLinks, tables: m.sourceTables, columns: m.sourceColumns }, input),
  );
}

export async function setSourceNoteAction(workspaceId: string, input: SetSourceNoteInput): Promise<ActionResult<{ name: string; removed: boolean }>> {
  return command(workspaceId, (ctx, access, m) =>
    setSourceNote(ctx, access, { table: m.sourceTables.find((t) => t.id === input?.target?.id) ?? null, column: m.sourceColumns.find((c) => c.id === input?.target?.id) ?? null }, input),
  );
}

/** What removing a classification takes with it, for the form before the click (item 10, D-47); a read, no write. */
export async function classificationImpactAction(workspaceId: string, classificationId: string): Promise<ActionResult<ClassificationImpact>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, code: "unauthenticated", message: "Your session has ended. Sign in again." };
  const store = getDataStore();
  const access = await loadAccess(store, workspaceId, user.id);
  if (!access) return { ok: false, code: "not_found", message: "This workspace does not exist." };
  const denied = checkPermission(access, "workspace.view");
  if (denied) return { ok: false, code: denied.code, message: denied.message };
  const [model, changes] = await Promise.all([store.model.load(access.workspace.id), store.model.listChanges(access.workspace.id)]);
  const impact = classificationImpact({ classifications: model.classifications, links: model.classificationLinks, tables: model.sourceTables, columns: model.sourceColumns, changes }, classificationId);
  return impact ? { ok: true, value: impact } : { ok: false, code: "not_found", message: "This classification no longer exists." };
}
