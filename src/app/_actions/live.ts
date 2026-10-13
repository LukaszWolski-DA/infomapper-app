"use server";

// Live label canvases (slice 3b, D-10, D-11, D-25): open a label's live canvas (made the first time, added to this
// project when it is in another one) and take a card off one, which unlabels it. Adding a card is a placement on the
// live canvas, or a label put on its element (the live step in `runCommand` labels and places it).

import { revalidatePath } from "next/cache";
import type { DataStore } from "@/data";
import type { CommandContext, CommandResult } from "@/domain/changes";
import { addLabel } from "@/domain/commands/label";
import { openLiveCanvas, removeFromLiveCanvas } from "@/domain/commands/live";
import type { WorkspaceAccess } from "@/domain/permissions";
import { loadLiveState } from "../_lib/live-state";
import { runCommand, type ActionResult } from "../_lib/run-command";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };
const str = (v: unknown) => (typeof v === "string" ? v : "");

async function liveCommand<T>(
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

/** “Open as live canvas” / “Go to its live canvas” (PRD item 6). */
export async function openLiveCanvasAction(
  workspaceId: string,
  input: { labelId: string; projectId: string },
): Promise<ActionResult<{ canvasId: string; name: string; created: boolean; addedToProject: boolean; projectName: string }>> {
  return liveCommand(workspaceId, async (ctx, access, store) => {
    const ws = access.workspace.id;
    const [state, project, projectLinks] = await Promise.all([
      loadLiveState(store, ws),
      store.projects.get(ws, str(input?.projectId)),
      Promise.all((await store.projects.list(ws)).map((p) => store.canvases.listLinksOfProject(ws, p.id))).then((l) => l.flat()),
    ]);
    const r = openLiveCanvas(ctx, access, { ...state, project, projectLinks }, input);
    return r.ok ? { ...r, value: { ...r.value, projectName: project?.name ?? "" } } : r;
  });
}

/**
 * Adding a card to a live canvas by a click in the left panel or from a feeding source, after its question (PRD item
 * 10): the label goes on the element and the sync places its card to the right of the content.
 */
export async function labelForLiveCanvasAction(
  workspaceId: string,
  labelId: string,
  target: { entityId: string } | { sourceTableId: string },
): Promise<ActionResult<{ name: string }>> {
  return liveCommand(workspaceId, async (ctx, access, store) => {
    const ws = access.workspace.id;
    const [model, labels, links] = await Promise.all([store.model.load(ws), store.labels.list(ws), store.labels.listLinks(ws)]);
    const t = target && "entityId" in target ? { kind: "entity" as const, id: str(target.entityId) } : { kind: "source_table" as const, id: str(target?.sourceTableId) };
    const r = addLabel(ctx, access, { ...model, labels, links }, { target: t, labelId });
    return r.ok ? { ...r, value: { name: r.value.name } } : r;
  });
}

/** “Remove from this canvas (unlabel)…” after its question (PRD item 11). */
export async function removeFromLiveCanvasAction(
  workspaceId: string,
  input: { canvasItemId: string; expectedVersion: number },
): Promise<ActionResult<{ name: string; label: string; mode: "direct" | "context"; what: string; keptAsContext: boolean }>> {
  return liveCommand(workspaceId, async (ctx, access, store) => removeFromLiveCanvas(ctx, access, await loadLiveState(store, access.workspace.id), input));
}
