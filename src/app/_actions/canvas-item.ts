"use server";

// Card writes on the canvas (slice 1a): position (when a drag ends), collapse and row filter, which need no fresh page;
// placing a card and removing it, which do; slice 1b: placing several at once (feeding sources, B-08).

import { revalidatePath } from "next/cache";
import { placeManyOnCanvas, placeOnCanvas, removeFromCanvas, updateCanvasItem } from "@/domain/commands/canvas-item";
import { runCommand, type ActionResult } from "../_lib/run-command";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };

export interface CardChangeInput {
  canvasItemId: string;
  expectedVersion: number;
  collapsed?: boolean;
  rowFilter?: string;
  x?: number;
  y?: number;
  width?: number | null;
}

/** Saves a card's position, collapse state, row filter or width. Returns the card's new version for the next change. */
export async function updateCardAction(workspaceId: string, change: CardChangeInput): Promise<ActionResult<{ version: number }>> {
  return runCommand(async (ctx, store, user) => {
    const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
    if (!workspace) return NOT_FOUND;
    const access = { workspace, member: await store.workspaces.getMember(workspace.id, user.id) };
    const id = typeof change?.canvasItemId === "string" ? change.canvasItemId : "";
    const result = updateCanvasItem(ctx, access, { item: await store.canvasItems.get(workspace.id, id) }, change);
    return result.ok ? { ...result, value: { version: result.value.item.version } } : result;
  });
}

/** Places an entity or a source table on a canvas (a click or a drop from the left panel). */
export async function placeCardAction(
  workspaceId: string,
  canvasId: string,
  input: { entityId?: string; sourceTableId?: string; x: number; y: number },
): Promise<ActionResult<{ canvasItemId: string }>> {
  const result = await runCommand(async (ctx, store, user) => {
    const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
    if (!workspace) return NOT_FOUND;
    const access = { workspace, member: await store.workspaces.getMember(workspace.id, user.id) };
    const cid = typeof canvasId === "string" ? canvasId : "";
    const [canvas, model, items] = await Promise.all([
      store.canvases.get(workspace.id, cid),
      store.model.load(workspace.id),
      store.canvasItems.listOfCanvas(workspace.id, cid),
    ]);
    const state = {
      canvas,
      entity: model.entities.find((e) => e.id === input?.entityId) ?? null,
      sourceTable: model.sourceTables.find((t) => t.id === input?.sourceTableId) ?? null,
      items,
    };
    return placeOnCanvas(ctx, access, state, { ...input, canvasId });
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** Places several entities or source tables on a canvas in one change (feeding sources and fed entities). */
export async function placeCardsAction(
  workspaceId: string,
  canvasId: string,
  cards: { entityId?: string; sourceTableId?: string; x: number; y: number }[],
): Promise<ActionResult<{ canvasItemIds: string[] }>> {
  const result = await runCommand(async (ctx, store, user) => {
    const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
    if (!workspace) return NOT_FOUND;
    const access = { workspace, member: await store.workspaces.getMember(workspace.id, user.id) };
    const cid = typeof canvasId === "string" ? canvasId : "";
    const [canvas, model, items] = await Promise.all([
      store.canvases.get(workspace.id, cid),
      store.model.load(workspace.id),
      store.canvasItems.listOfCanvas(workspace.id, cid),
    ]);
    return placeManyOnCanvas(ctx, access, { canvas, entities: model.entities, sourceTables: model.sourceTables, items }, { canvasId, cards });
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** Takes a card off its canvas; the element stays in the model (D-02). */
export async function removeCardAction(
  workspaceId: string,
  input: { canvasItemId: string; expectedVersion: number },
): Promise<ActionResult> {
  const result = await runCommand(async (ctx, store, user) => {
    const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
    if (!workspace) return NOT_FOUND;
    const access = { workspace, member: await store.workspaces.getMember(workspace.id, user.id) };
    const id = typeof input?.canvasItemId === "string" ? input.canvasItemId : "";
    return removeFromCanvas(ctx, access, { item: await store.canvasItems.get(workspace.id, id) }, input);
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
