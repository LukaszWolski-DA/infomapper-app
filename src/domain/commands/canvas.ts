// Canvas commands: create, rename, and which projects a canvas belongs to (D-28).

import { z } from "zod";
import { buildWriteSet, fail, newRowColumns, nextVersion, type CommandContext, type CommandResult } from "../changes";
import { domainError, notFound, staleVersion } from "../errors";
import type { Uuid } from "../ids";
import { checkPermission, type WorkspaceAccess } from "../permissions";
import { DEFAULT_CANVAS_LOOK, type Canvas, type Project, type ProjectCanvas } from "../types";
import { nameSchema, parseInput, uuidSchema, versionSchema } from "../validation";

const isLive = <R extends { deleted_at: string | null; workspace_id: Uuid }>(row: R | null, workspaceId: Uuid): row is R =>
  row !== null && row.deleted_at === null && row.workspace_id === workspaceId;

const nextSortOrder = (links: readonly ProjectCanvas[]): number =>
  links.reduce((max, l) => Math.max(max, l.sort_order + 1), 0);

// ---- create ----

const createCanvasInput = z.object({ projectId: uuidSchema, name: nameSchema }).strict();
export type CreateCanvasInput = z.input<typeof createCanvasInput>;

export interface CreateCanvasState {
  project: Project | null;
  /** The project's current canvas links, to place the new canvas last. */
  projectLinks: readonly ProjectCanvas[];
}

/** Creates an empty canvas in a project, as its last tab. */
export function createCanvas(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: CreateCanvasState,
  input: unknown,
): CommandResult<{ canvasId: Uuid }> {
  const denied = checkPermission(access, "canvas.create");
  if (denied) return fail(denied);
  const parsed = parseInput(createCanvasInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const workspaceId = access.workspace.id;
  const { project } = state;
  if (!isLive(project, workspaceId) || project.id !== parsed.data.projectId) return fail(notFound("project"));

  const canvas: Canvas = {
    ...newRowColumns(ctx),
    workspace_id: workspaceId,
    name: parsed.data.name,
    live_label_id: null,
    look: { ...DEFAULT_CANVAS_LOOK },
  };
  const link: ProjectCanvas = {
    project_id: project.id,
    canvas_id: canvas.id,
    workspace_id: workspaceId,
    sort_order: nextSortOrder(state.projectLinks.filter((l) => l.project_id === project.id)),
    added_at: ctx.now,
    added_by: ctx.actorId,
  };

  return {
    ok: true,
    value: { canvasId: canvas.id },
    writeSet: buildWriteSet(ctx, workspaceId, [
      { kind: "insert", table: "canvas", row: canvas },
      { kind: "insert", table: "project_canvas", row: link },
    ]),
  };
}

// ---- rename ----

const renameCanvasInput = z.object({ canvasId: uuidSchema, expectedVersion: versionSchema, name: nameSchema }).strict();
export type RenameCanvasInput = z.input<typeof renameCanvasInput>;

export function renameCanvas(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { canvas: Canvas | null },
  input: unknown,
): CommandResult<{ canvas: Canvas }> {
  const denied = checkPermission(access, "canvas.rename");
  if (denied) return fail(denied);
  const parsed = parseInput(renameCanvasInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { canvas } = state;
  if (!isLive(canvas, access.workspace.id) || canvas.id !== parsed.data.canvasId) return fail(notFound("canvas"));
  if (parsed.data.expectedVersion !== canvas.version) return fail(staleVersion());

  const row = nextVersion(ctx, canvas, { name: parsed.data.name });
  return {
    ok: true,
    value: { canvas: row },
    writeSet: buildWriteSet(ctx, access.workspace.id, [{ kind: "update", table: "canvas", before: canvas, row }]),
  };
}

// ---- project membership (D-28) ----

const membershipInput = z.object({ canvasId: uuidSchema, projectId: uuidSchema }).strict();
export type CanvasMembershipInput = z.input<typeof membershipInput>;

export interface CanvasMembershipState {
  canvas: Canvas | null;
  project: Project | null;
  /** Links of the canvas to its live projects. */
  canvasLinks: readonly ProjectCanvas[];
  /** Links of the project to its live canvases. */
  projectLinks: readonly ProjectCanvas[];
}

function checkMembership(access: WorkspaceAccess, state: CanvasMembershipState, input: unknown) {
  const denied = checkPermission(access, "canvas.edit_projects");
  if (denied) return { ok: false as const, error: denied };
  const parsed = parseInput(membershipInput, input);
  if (!parsed.ok) return parsed;
  const workspaceId = access.workspace.id;
  const { canvas, project } = state;
  if (!isLive(canvas, workspaceId) || canvas.id !== parsed.data.canvasId) {
    return { ok: false as const, error: notFound("canvas") };
  }
  if (!isLive(project, workspaceId) || project.id !== parsed.data.projectId) {
    return { ok: false as const, error: notFound("project") };
  }
  const linked = state.canvasLinks.some((l) => l.canvas_id === canvas.id && l.project_id === project.id);
  return { ok: true as const, canvas, project, linked };
}

/** Adds an existing canvas to another project; it is the same canvas, not a copy. */
export function addCanvasToProject(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: CanvasMembershipState,
  input: unknown,
): CommandResult {
  const checked = checkMembership(access, state, input);
  if (!checked.ok) return fail(checked.error);
  const { canvas, project, linked } = checked;
  if (linked) return fail(domainError("conflict", `This canvas is already in ${project.name}.`));

  const link: ProjectCanvas = {
    project_id: project.id,
    canvas_id: canvas.id,
    workspace_id: access.workspace.id,
    sort_order: nextSortOrder(state.projectLinks.filter((l) => l.project_id === project.id)),
    added_at: ctx.now,
    added_by: ctx.actorId,
  };
  return {
    ok: true,
    value: undefined,
    writeSet: buildWriteSet(ctx, access.workspace.id, [{ kind: "insert", table: "project_canvas", row: link }]),
  };
}

/**
 * Takes a canvas out of one project. The canvas itself stays (D-28): a canvas always belongs to at least one
 * project, and a project keeps at least one canvas, so removing never deletes a canvas.
 */
export function removeCanvasFromProject(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: CanvasMembershipState,
  input: unknown,
): CommandResult {
  const checked = checkMembership(access, state, input);
  if (!checked.ok) return fail(checked.error);
  const { canvas, project, linked } = checked;
  const link = state.canvasLinks.find((l) => l.canvas_id === canvas.id && l.project_id === project.id);
  if (!linked || !link) return fail(domainError("not_found", `This canvas is not in ${project.name}.`));
  if (state.canvasLinks.filter((l) => l.canvas_id === canvas.id).length < 2) {
    return fail(domainError("invalid", "A canvas belongs to at least one project."));
  }
  if (state.projectLinks.filter((l) => l.project_id === project.id).length < 2) {
    return fail(domainError("invalid", "This project would have no canvas left."));
  }
  return {
    ok: true,
    value: undefined,
    writeSet: buildWriteSet(ctx, access.workspace.id, [{ kind: "remove", table: "project_canvas", before: link }]),
  };
}
