"use server";

// Frame writes on the canvas (slice 2b): draw, rename and change what a frame stands for, resize, fit to its content,
// delete; and every change of where cards and frames are or how wide cards are (`moveOnCanvas`), which also decides
// the cards' frames. Each runs one domain command on the canvas as it is stored now. Moves need no fresh page (the
// canvas already shows them); the others do.

import { revalidatePath } from "next/cache";
import type { CommandContext, CommandResult } from "@/domain/changes";
import {
  arrangeCanvasIntoFrames,
  createFrame,
  deleteFrame,
  fitFrameToContent,
  moveOnCanvas,
  putCardsInNewFrame,
  resizeFrame,
  setFrameCollapsed,
  updateFrame,
  type FrameCanvasState,
  type MoveState,
} from "@/domain/commands/frame";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { DataStore } from "@/data";
import { runCommand, type ActionResult } from "../_lib/run-command";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };
const str = (v: unknown) => (typeof v === "string" ? v : "");

async function accessOf(store: DataStore, workspaceId: unknown, userId: string): Promise<WorkspaceAccess | null> {
  const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
  return workspace ? { workspace, member: await store.workspaces.getMember(workspace.id, userId) } : null;
}

async function canvasState(store: DataStore, workspaceId: string, canvasId: string): Promise<FrameCanvasState> {
  const [canvas, frames, items] = await Promise.all([
    store.canvases.get(workspaceId, canvasId),
    store.frames.listOfCanvas(workspaceId, canvasId),
    store.canvasItems.listOfCanvas(workspaceId, canvasId),
  ]);
  return { canvas, frames, items };
}

/** Runs a frame command on one canvas; `canvasOf` finds the canvas when the input names a frame, not a canvas. */
function onCanvas<T>(
  workspaceId: string,
  canvasId: string | ((store: DataStore, workspaceId: string) => Promise<string>),
  command: (ctx: CommandContext, access: WorkspaceAccess, state: FrameCanvasState, store: DataStore) => Promise<CommandResult<T>> | CommandResult<T>,
): Promise<ActionResult<T>> {
  return runCommand(async (ctx, store, user) => {
    const access = await accessOf(store, workspaceId, user.id);
    if (!access) return NOT_FOUND;
    const ws = access.workspace.id;
    const cid = typeof canvasId === "function" ? await canvasId(store, ws) : str(canvasId);
    return command(ctx, access, await canvasState(store, ws, cid), store);
  });
}

/** The canvas of the frame an input names (a frame of another canvas is “not found” by the command). */
const canvasOfFrame = (frameId: unknown) => async (store: DataStore, ws: string) =>
  (await store.frames.list(ws)).find((f) => f.id === frameId)?.canvas_id ?? "";

const refreshed = <T>(result: ActionResult<T>): ActionResult<T> => {
  if (result.ok) revalidatePath("/", "layout");
  return result;
};

/** The Frame tool and “New frame here”: a free frame that takes the free cards fully inside it (D-06). */
export async function createFrameAction(
  workspaceId: string,
  canvasId: string,
  input: { x: number; y: number; width: number; height: number; cards: { canvasItemId: string; expectedVersion: number; height: number }[] },
) {
  return refreshed(await onCanvas(workspaceId, canvasId, (ctx, access, state) => createFrame(ctx, access, state, { ...input, canvasId })));
}

/** Name, what the frame stands for, colour (the frame panel). */
export async function updateFrameAction(
  workspaceId: string,
  input: { frameId: string; expectedVersion: number; name?: string; kind?: string; conceptId?: string; sourceSystemId?: string; color?: string },
) {
  return refreshed(
    await runCommand(async (ctx, store, user) => {
      const access = await accessOf(store, workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const ws = access.workspace.id;
      const [frames, model] = await Promise.all([store.frames.list(ws), store.model.load(ws)]);
      const frame = frames.find((f) => f.id === input?.frameId) ?? null;
      return updateFrame(ctx, access, { frame, concepts: model.concepts, sourceSystems: model.sourceSystems }, input);
    }),
  );
}

export interface MoveOnCanvasActionInput {
  frames: { frameId: string; expectedVersion: number; x?: number; y?: number }[];
  items: { canvasItemId: string; expectedVersion: number; x?: number; y?: number; width?: number | null; height?: number }[];
  onGrid?: boolean;
  moveToConcepts?: boolean;
  dragDrop?: boolean;
}

/** Drags, drops, nudges, align/stack/line up, card resize and fit widths: positions, widths and frames in one change. */
export async function moveOnCanvasAction(workspaceId: string, canvasId: string, input: MoveOnCanvasActionInput) {
  const result = await onCanvas(workspaceId, canvasId, async (ctx, access, state, store) => {
    const model = await store.model.load(access.workspace.id);
    const full: MoveState = { ...state, entities: model.entities, concepts: model.concepts };
    return moveOnCanvas(ctx, access, full, { ...input, canvasId });
  });
  // a concept change is a change of the model: the panels show it
  return result.ok && result.value.movedToConcepts ? refreshed(result) : result;
}

/** Collapses a frame into one block or expands it (slice 2c, D-07): the label's button, the toolbox, the panel, the block. */
export async function setFrameCollapsedAction(workspaceId: string, input: { frameId: string; expectedVersion: number; collapsed: boolean }) {
  return refreshed(
    await runCommand(async (ctx, store, user) => {
      const access = await accessOf(store, workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const frame = (await store.frames.list(access.workspace.id)).find((f) => f.id === input?.frameId) ?? null;
      return setFrameCollapsed(ctx, access, { frame }, input);
    }),
  );
}

/** The resize handle at a frame's bottom-right corner. */
export async function resizeFrameAction(
  workspaceId: string,
  input: { frameId: string; expectedVersion: number; width: number; height: number; cards: { canvasItemId: string; expectedVersion: number }[] },
) {
  return onCanvas(workspaceId, canvasOfFrame(input?.frameId), (ctx, access, state) => resizeFrame(ctx, access, state, input));
}

/** “Fit frame to its content” (toolbox, frame panel). */
export async function fitFrameAction(
  workspaceId: string,
  input: { frameId: string; expectedVersion: number; cards: { canvasItemId: string; expectedVersion: number; height: number }[] },
) {
  return onCanvas(workspaceId, canvasOfFrame(input?.frameId), (ctx, access, state) => fitFrameToContent(ctx, access, state, input));
}

/** Deletes a frame; its cards stay where they are, in no frame. */
export async function deleteFrameAction(
  workspaceId: string,
  input: { frameId: string; expectedVersion: number; cards: { canvasItemId: string; expectedVersion: number }[] },
) {
  return refreshed(await onCanvas(workspaceId, canvasOfFrame(input?.frameId), (ctx, access, state) => deleteFrame(ctx, access, state, input)));
}

/**
 * “Put in a new frame” (a selection) and “Put in a new concept / source system frame” (one card, which also takes the
 * free cards fully inside, `others`).
 */
export async function putInNewFrameAction(
  workspaceId: string,
  canvasId: string,
  input: { cards: { canvasItemId: string; expectedVersion: number; height: number }[]; others?: { canvasItemId: string; expectedVersion: number; height: number }[] },
) {
  return refreshed(
    await onCanvas(workspaceId, canvasId, async (ctx, access, state, store) => {
      const model = await store.model.load(access.workspace.id);
      return putCardsInNewFrame(ctx, access, { ...state, ...model }, { ...input, canvasId });
    }),
  );
}

/** “Arrange into frames by concept and system” (the canvas overview, PRD items 14 and 15). One change. */
export async function arrangeIntoFramesAction(
  workspaceId: string,
  canvasId: string,
  input: { frames: { frameId: string; expectedVersion: number }[]; cards: { canvasItemId: string; expectedVersion: number; height: number }[] },
) {
  return refreshed(
    await onCanvas(workspaceId, canvasId, async (ctx, access, state, store) => {
      const model = await store.model.load(access.workspace.id);
      return arrangeCanvasIntoFrames(ctx, access, { ...state, ...model }, { ...input, canvasId });
    }),
  );
}
