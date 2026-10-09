"use server";

// Card writes on the canvas (slice 1a): collapse and row filter, which need no fresh page; placing a card and removing
// it, which do; slice 1b: placing several at once (feeding sources, B-08); slice 2a: removing a group of selected
// cards in one change. Positions and widths are in `frame.ts` (`moveOnCanvasAction`, slice 2b).

import { revalidatePath } from "next/cache";
import {
  placeManyOnCanvas,
  placeOnCanvas,
  removeCanvasItems,
  removeFromCanvas,
  updateCanvasItem,
  type CanvasItemsState,
} from "@/domain/commands/canvas-item";
import type { CommandContext, CommandResult } from "@/domain/changes";
import type { WorkspaceAccess } from "@/domain/permissions";
import { runCommand, type ActionResult } from "../_lib/run-command";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };

export interface CardChangeInput {
  canvasItemId: string;
  expectedVersion: number;
  collapsed?: boolean;
  rowFilter?: string;
}

/** Saves a card's collapse state or row filter. Returns the card's new version for the next change. */
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
  input: { entityId?: string; sourceTableId?: string; x: number; y: number; height?: number; frames?: { frameId: string; expectedVersion: number }[] },
): Promise<ActionResult<{ canvasItemId: string }>> {
  const result = await runCommand(async (ctx, store, user) => {
    const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
    if (!workspace) return NOT_FOUND;
    const access = { workspace, member: await store.workspaces.getMember(workspace.id, user.id) };
    const cid = typeof canvasId === "string" ? canvasId : "";
    const [canvas, model, items, frames] = await Promise.all([
      store.canvases.get(workspace.id, cid),
      store.model.load(workspace.id),
      store.canvasItems.listOfCanvas(workspace.id, cid),
      store.frames.listOfCanvas(workspace.id, cid),
    ]);
    const state = {
      canvas,
      entity: model.entities.find((e) => e.id === input?.entityId) ?? null,
      sourceTable: model.sourceTables.find((t) => t.id === input?.sourceTableId) ?? null,
      items,
      frames,
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
  cards: { entityId?: string; sourceTableId?: string; x: number; y: number; height?: number }[],
  frames?: { frameId: string; expectedVersion: number }[],
): Promise<ActionResult<{ canvasItemIds: string[] }>> {
  const result = await runCommand(async (ctx, store, user) => {
    const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
    if (!workspace) return NOT_FOUND;
    const access = { workspace, member: await store.workspaces.getMember(workspace.id, user.id) };
    const cid = typeof canvasId === "string" ? canvasId : "";
    const [canvas, model, items, frameRows] = await Promise.all([
      store.canvases.get(workspace.id, cid),
      store.model.load(workspace.id),
      store.canvasItems.listOfCanvas(workspace.id, cid),
      store.frames.listOfCanvas(workspace.id, cid),
    ]);
    const state = { canvas, entities: model.entities, sourceTables: model.sourceTables, items, frames: frameRows };
    return placeManyOnCanvas(ctx, access, state, { canvasId, cards, ...(frames ? { frames } : {}) });
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

// ---- a group of selected cards (slice 2a) ----

type GroupCommand<T> = (ctx: CommandContext, access: WorkspaceAccess, state: CanvasItemsState, input: unknown) => CommandResult<T>;

/** Runs a group command on one canvas with its cards as they are stored now. */
function onCanvasCards<T>(workspaceId: string, canvasId: string, command: GroupCommand<T>, input: object): Promise<ActionResult<T>> {
  return runCommand(async (ctx, store, user) => {
    const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
    if (!workspace) return NOT_FOUND;
    const access = { workspace, member: await store.workspaces.getMember(workspace.id, user.id) };
    const cid = typeof canvasId === "string" ? canvasId : "";
    const [canvas, items] = await Promise.all([store.canvases.get(workspace.id, cid), store.canvasItems.listOfCanvas(workspace.id, cid)]);
    return command(ctx, access, { canvas, items }, { ...input, canvasId });
  });
}

/** Takes several cards off the canvas in one change; the elements stay in the model (D-02). */
export async function removeCardsAction(workspaceId: string, canvasId: string, items: { canvasItemId: string; expectedVersion: number }[]) {
  const result = await onCanvasCards(workspaceId, canvasId, removeCanvasItems, { items });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
