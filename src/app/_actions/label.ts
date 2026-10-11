"use server";

// Working labels (slice 3a): put on and taken off an item from the Labels field, renamed and deleted in the label
// panel, pinned to a project's home (D-29). Each runs one domain command on the labels as they are stored now; the
// pages are fresh again afterwards (the marks on the canvas and the chips come from the server).

import { revalidatePath } from "next/cache";
import type { DataStore } from "@/data";
import type { CommandContext, CommandResult } from "@/domain/changes";
import { addLabel, deleteLabel, removeLabel, renameLabel, setLabelPinned, type AddLabelInput } from "@/domain/commands/label";
import type { WorkspaceAccess } from "@/domain/permissions";
import { runCommand, type ActionResult } from "../_lib/run-command";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };
const str = (v: unknown) => (typeof v === "string" ? v : "");

async function labelCommand<T>(
  workspaceId: unknown,
  build: (ctx: CommandContext, access: WorkspaceAccess, store: DataStore) => Promise<CommandResult<T>>,
): Promise<ActionResult<T>> {
  const result = await runCommand<T>(async (ctx, store, user) => {
    const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
    if (!workspace) return NOT_FOUND;
    return build(ctx, { workspace, member: await store.workspaces.getMember(workspace.id, user.id) }, store);
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** Puts a label on an item: a picked label, or a typed name (the label with that name in any case, else a new one). */
export async function addLabelAction(workspaceId: string, input: AddLabelInput): Promise<ActionResult<{ labelId: string; name: string; created: boolean }>> {
  return labelCommand(workspaceId, async (ctx, access, store) => {
    const ws = access.workspace.id;
    const [model, labels, links] = await Promise.all([store.model.load(ws), store.labels.list(ws), store.labels.listLinks(ws)]);
    const r = addLabel(ctx, access, { ...model, labels, links }, input);
    return r.ok ? { ...r, value: { labelId: r.value.labelId, name: r.value.name, created: r.value.created } } : r;
  });
}

/** Takes a label off one item (by its link). */
export async function removeLabelAction(workspaceId: string, input: { labelLinkId: string; expectedVersion: number }): Promise<ActionResult> {
  return labelCommand(workspaceId, async (ctx, access, store) =>
    removeLabel(ctx, access, { link: await store.labels.getLink(access.workspace.id, str(input?.labelLinkId)) }, input),
  );
}

export async function renameLabelAction(workspaceId: string, input: { labelId: string; expectedVersion: number; name: string }): Promise<ActionResult<{ name: string }>> {
  return labelCommand(workspaceId, async (ctx, access, store) => {
    const r = renameLabel(ctx, access, { labels: await store.labels.list(access.workspace.id) }, input);
    return r.ok ? { ...r, value: { name: r.value.label.name } } : r;
  });
}

/** Deletes a label with its links and project pins (one undo step); the model is untouched. */
export async function deleteLabelAction(workspaceId: string, input: { labelId: string; expectedVersion: number }): Promise<ActionResult<{ name: string }>> {
  return labelCommand(workspaceId, async (ctx, access, store) => {
    const ws = access.workspace.id;
    const [label, links, pins] = await Promise.all([store.labels.get(ws, str(input?.labelId)), store.labels.listLinks(ws), store.labels.listPins(ws)]);
    const r = deleteLabel(ctx, access, { label, links, pins }, input);
    return r.ok ? { ...r, value: { name: r.value.name } } : r;
  });
}

/** Pins a label to a project's home or unpins it (not an undo step). */
export async function setLabelPinnedAction(workspaceId: string, input: { projectId: string; labelId: string; pinned: boolean }): Promise<ActionResult> {
  return labelCommand(workspaceId, async (ctx, access, store) => {
    const ws = access.workspace.id;
    const [project, label, pins] = await Promise.all([store.projects.get(ws, str(input?.projectId)), store.labels.get(ws, str(input?.labelId)), store.labels.listPins(ws)]);
    return setLabelPinned(ctx, access, { project, label, pins: pins.filter((p) => p.project_id === project?.id) }, input);
  });
}
