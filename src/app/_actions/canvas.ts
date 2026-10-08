"use server";

// Canvas writes (slice 0, step 5c): create, rename, and which projects a canvas belongs to (D-28).
// Slice 2a: duplicate the layout, delete a canvas (or take it out of this project), its look and layer mode.

import { revalidatePath } from "next/cache";
import type { DataStore } from "@/data";
import {
  addCanvasToProject,
  applyLookToAllCanvases,
  createCanvas,
  deleteCanvas,
  duplicateCanvas,
  removeCanvasFromProject,
  renameCanvas,
  setCanvasLook,
  type CanvasMembershipState,
} from "@/domain/commands/canvas";
import type { CanvasBackground, CanvasGrid, CanvasLayer } from "@/domain/types";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceAccess } from "@/domain/permissions";
import { rememberNextCanvas } from "../_lib/next-canvas";
import { canvasHref } from "../_lib/paths";
import { runCommand, type ActionResult } from "../_lib/run-command";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };
const str = (v: unknown) => (typeof v === "string" ? v : "");

async function loadAccess(store: DataStore, workspaceId: unknown, userId: Uuid): Promise<WorkspaceAccess | null> {
  if (typeof workspaceId !== "string") return null;
  const workspace = await store.workspaces.get(workspaceId);
  if (!workspace) return null;
  return { workspace, member: await store.workspaces.getMember(workspace.id, userId) };
}

async function membershipState(store: DataStore, workspaceId: Uuid, canvasId: string, projectId: string): Promise<CanvasMembershipState> {
  const [canvas, project, canvasLinks, projectLinks] = await Promise.all([
    store.canvases.get(workspaceId, canvasId),
    store.projects.get(workspaceId, projectId),
    store.canvases.listLinksOfCanvas(workspaceId, canvasId),
    store.canvases.listLinksOfProject(workspaceId, projectId),
  ]);
  return { canvas, project, canvasLinks, projectLinks };
}

function done<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function createCanvasAction(input: { workspaceId: string; projectId: string; name: string }) {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const projectId = str(input?.projectId);
      const state = {
        project: await store.projects.get(access.workspace.id, projectId),
        projectLinks: await store.canvases.listLinksOfProject(access.workspace.id, projectId),
      };
      const result = createCanvas(ctx, access, state, { projectId: input?.projectId, name: input?.name });
      return result.ok
        ? { ...result, value: { href: canvasHref(access.workspace.id, projectId, result.value.canvasId) } }
        : result;
    }),
  );
}

export async function renameCanvasAction(input: { workspaceId: string; canvasId: string; expectedVersion: number; name: string }) {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const canvas = await store.canvases.get(access.workspace.id, str(input?.canvasId));
      const result = renameCanvas(ctx, access, { canvas }, {
        canvasId: input?.canvasId,
        expectedVersion: input?.expectedVersion,
        name: input?.name,
      });
      return result.ok ? { ...result, value: { name: result.value.canvas.name } } : result;
    }),
  );
}

export async function addCanvasToProjectAction(input: { workspaceId: string; canvasId: string; projectId: string }) {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const state = await membershipState(store, access.workspace.id, str(input?.canvasId), str(input?.projectId));
      return addCanvasToProject(ctx, access, state, { canvasId: input?.canvasId, projectId: input?.projectId });
    }),
  );
}

export async function removeCanvasFromProjectAction(input: { workspaceId: string; canvasId: string; projectId: string }) {
  let next: string | undefined;
  const result = await runCommand(async (ctx, store, user) => {
    const access = await loadAccess(store, input?.workspaceId, user.id);
    if (!access) return NOT_FOUND;
    const state = await membershipState(store, access.workspace.id, str(input?.canvasId), str(input?.projectId));
    next = state.projectLinks.find((l) => l.canvas_id !== input?.canvasId)?.canvas_id;
    return removeCanvasFromProject(ctx, access, state, { canvasId: input?.canvasId, projectId: input?.projectId });
  });
  // if it was the open canvas, the project's next canvas opens
  if (result.ok && next) await rememberNextCanvas(str(input?.canvasId), next);
  return done(result);
}

export async function duplicateCanvasAction(input: { workspaceId: string; projectId: string; canvasId: string }) {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const ws = access.workspace.id, projectId = str(input?.projectId), canvasId = str(input?.canvasId);
      const [canvas, project, projectLinks, items] = await Promise.all([
        store.canvases.get(ws, canvasId),
        store.projects.get(ws, projectId),
        store.canvases.listLinksOfProject(ws, projectId),
        store.canvasItems.listOfCanvas(ws, canvasId),
      ]);
      const result = duplicateCanvas(ctx, access, { canvas, project, projectLinks, items }, { projectId: input?.projectId, canvasId: input?.canvasId });
      return result.ok
        ? { ...result, value: { name: result.value.name, canvasId: result.value.canvasId, href: canvasHref(ws, projectId, result.value.canvasId) } }
        : result;
    }),
  );
}

/** The tab menu's last item (D-28): deletes the canvas, or only takes it out of this project when another has it. */
export async function deleteCanvasAction(input: { workspaceId: string; projectId: string; canvasId: string; expectedVersion: number }) {
  let next: string | undefined;
  const result = await runCommand(async (ctx, store, user) => {
    const access = await loadAccess(store, input?.workspaceId, user.id);
    if (!access) return NOT_FOUND;
    const ws = access.workspace.id, canvasId = str(input?.canvasId);
    const [state, items, frames] = await Promise.all([
      membershipState(store, ws, canvasId, str(input?.projectId)),
      store.canvasItems.listOfCanvas(ws, canvasId),
      store.frames.listOfCanvas(ws, canvasId),
    ]);
    next = state.projectLinks.find((l) => l.canvas_id !== canvasId)?.canvas_id;
    return deleteCanvas(ctx, access, { ...state, items, frames }, {
      projectId: input?.projectId,
      canvasId: input?.canvasId,
      expectedVersion: input?.expectedVersion,
    });
  });
  // if it was the open canvas, the project's next canvas opens (prototype delDia)
  if (result.ok && next) await rememberNextCanvas(str(input?.canvasId), next);
  return done(result);
}

/** Background, grid or layer mode of one canvas (D-12, D-22): saved, not an undo step. Returns the new version. */
export async function setCanvasLookAction(input: {
  workspaceId: string;
  canvasId: string;
  expectedVersion: number;
  background?: CanvasBackground;
  grid?: CanvasGrid;
  layer?: CanvasLayer;
}) {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const canvas = await store.canvases.get(access.workspace.id, str(input?.canvasId));
      const result = setCanvasLook(ctx, access, { canvas }, {
        canvasId: input?.canvasId,
        expectedVersion: input?.expectedVersion,
        background: input?.background,
        grid: input?.grid,
        layer: input?.layer,
      });
      return result.ok ? { ...result, value: { version: result.value.canvas.version } } : result;
    }),
  );
}

/** The same, with the workspace bound first (the canvas page passes it to the canvas's look). */
export async function saveCanvasLookAction(
  workspaceId: string,
  input: { canvasId: string; expectedVersion: number; background?: CanvasBackground; grid?: CanvasGrid; layer?: CanvasLayer },
) {
  return setCanvasLookAction({ ...input, workspaceId });
}

/** “Use this look on all canvases”: background and grid of one canvas go to every canvas of the workspace. */
export async function applyLookToAllCanvasesAction(input: { workspaceId: string; canvasId: string }) {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const canvases = await store.canvases.list(access.workspace.id);
      return applyLookToAllCanvases(ctx, access, { canvases }, { canvasId: input?.canvasId });
    }),
  );
}
