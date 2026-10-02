"use server";

// Canvas writes (slice 0, step 5c): create, rename, and which projects a canvas belongs to (D-28).

import { revalidatePath } from "next/cache";
import type { DataStore } from "@/data";
import {
  addCanvasToProject,
  createCanvas,
  removeCanvasFromProject,
  renameCanvas,
  type CanvasMembershipState,
} from "@/domain/commands/canvas";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceAccess } from "@/domain/permissions";
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
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const state = await membershipState(store, access.workspace.id, str(input?.canvasId), str(input?.projectId));
      return removeCanvasFromProject(ctx, access, state, { canvasId: input?.canvasId, projectId: input?.projectId });
    }),
  );
}
