// Canvas commands: create, rename, and which projects a canvas belongs to (D-28); duplicate its layout, delete it,
// and its look and layer mode (slice 2a, D-12, D-22).

import { z } from "zod";
import { buildWriteSet, fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound, staleVersion } from "../errors";
import type { Uuid } from "../ids";
import { checkPermission, type WorkspaceAccess } from "../permissions";
import {
  CANVAS_BACKGROUNDS,
  CANVAS_GRIDS,
  CANVAS_LAYERS,
  DEFAULT_CANVAS_LOOK,
  type Canvas,
  type CanvasItem,
  type CanvasLook,
  type Frame,
  type Note,
  type Project,
  type ProjectCanvas,
} from "../types";
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

// ---- duplicate layout (slice 2a) ----

const duplicateInput = z.object({ projectId: uuidSchema, canvasId: uuidSchema }).strict();
export type DuplicateCanvasInput = z.input<typeof duplicateInput>;

export interface DuplicateCanvasState {
  canvas: Canvas | null;
  project: Project | null;
  /** The project's canvas links. */
  projectLinks: readonly ProjectCanvas[];
  /** The canvas's cards (deleted ones are skipped). */
  items: readonly CanvasItem[];
  /** The canvas's frames (deleted ones are skipped; slice 2b). */
  frames: readonly Frame[];
}

/**
 * “Duplicate layout”: a new canvas “{name} (copy)” in this project with copies of the cards (positions, widths,
 * collapsed state, row filters) and the same look and layer mode. Slice 2b: its frames are copied too, with new ids,
 * and each copied card is in the copy of its frame. Notes are not copied (slice 3a, Łukasz's step 0 answer 1, as the
 * prototype's dupDia): they are remarks about a canvas, not part of its layout. The model is shared, not copied. The copy's link
 * takes the original's sort order; tabs with the same order follow when they were added, so it sits right after the
 * original. One change group, so one undo removes the copy.
 */
export function duplicateCanvas(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: DuplicateCanvasState,
  input: unknown,
): CommandResult<{ canvasId: Uuid; name: string }> {
  const denied = checkPermission(access, "canvas.create");
  if (denied) return fail(denied);
  const parsed = parseInput(duplicateInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const workspaceId = access.workspace.id;
  const { canvas, project } = state;
  if (!isLive(project, workspaceId) || project.id !== parsed.data.projectId) return fail(notFound("project"));
  if (!isLive(canvas, workspaceId) || canvas.id !== parsed.data.canvasId) return fail(notFound("canvas"));
  const original = state.projectLinks.find((l) => l.project_id === project.id && l.canvas_id === canvas.id);
  if (!original) return fail(domainError("not_found", `This canvas is not in ${project.name}.`));

  const copy: Canvas = {
    ...newRowColumns(ctx),
    workspace_id: workspaceId,
    name: `${canvas.name} (copy)`,
    live_label_id: null,
    look: { ...canvas.look },
  };
  const link: ProjectCanvas = {
    project_id: project.id,
    canvas_id: copy.id,
    workspace_id: workspaceId,
    sort_order: original.sort_order,
    added_at: ctx.now,
    added_by: ctx.actorId,
  };
  const frameCopies = new Map<Uuid, Frame>();
  for (const f of state.frames) {
    if (isLive(f, workspaceId) && f.canvas_id === canvas.id) frameCopies.set(f.id, { ...f, ...newRowColumns(ctx), canvas_id: copy.id });
  }
  const items: CanvasItem[] = state.items
    .filter((i) => isLive(i, workspaceId) && i.canvas_id === canvas.id)
    .map((i) => ({ ...i, ...newRowColumns(ctx), canvas_id: copy.id, frame_id: (i.frame_id && frameCopies.get(i.frame_id)?.id) || null }));

  return {
    ok: true,
    value: { canvasId: copy.id, name: copy.name },
    writeSet: buildWriteSet(ctx, workspaceId, [
      { kind: "insert", table: "canvas", row: copy },
      { kind: "insert", table: "project_canvas", row: link },
      ...[...frameCopies.values()].map((row): Write => ({ kind: "insert", table: "frame", row })),
      ...items.map((row): Write => ({ kind: "insert", table: "canvas_item", row })),
    ]),
  };
}

// ---- delete, or remove from this project (D-28) ----

const deleteInput = z.object({ projectId: uuidSchema, canvasId: uuidSchema, expectedVersion: versionSchema }).strict();
export type DeleteCanvasInput = z.input<typeof deleteInput>;

export interface DeleteCanvasState {
  canvas: Canvas | null;
  project: Project | null;
  /** Links of the canvas to its live projects. */
  canvasLinks: readonly ProjectCanvas[];
  /** Links of the project to its live canvases. */
  projectLinks: readonly ProjectCanvas[];
  /** The canvas's cards (deleted ones are skipped). */
  items: readonly CanvasItem[];
  /** The canvas's frames (deleted ones are skipped). */
  frames: readonly Frame[];
  /** The canvas's notes (deleted ones are skipped; slice 3a). */
  notes?: readonly Note[];
}

export const LAST_CANVAS_MESSAGE = "A project keeps at least one canvas. Delete the project from its home screen instead.";

/**
 * The tab menu's last item (D-28). A canvas that is also in another project is only taken out of this one; otherwise
 * the canvas, its cards, its frames and its notes are soft-deleted and its link to the project goes. The model is untouched. Refused for the
 * project's last canvas. One change group.
 */
export function deleteCanvas(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: DeleteCanvasState,
  input: unknown,
): CommandResult<{ deleted: boolean; otherProjectIds: Uuid[] }> {
  const parsed = parseInput(deleteInput, input);
  const shared = parsed.ok && state.canvasLinks.some((l) => l.canvas_id === parsed.data.canvasId && l.project_id !== parsed.data.projectId);
  const denied = checkPermission(access, shared ? "canvas.edit_projects" : "canvas.delete");
  if (denied) return fail(denied);
  if (!parsed.ok) return fail(parsed.error);
  const workspaceId = access.workspace.id;
  const { canvas, project } = state;
  if (!isLive(project, workspaceId) || project.id !== parsed.data.projectId) return fail(notFound("project"));
  if (!isLive(canvas, workspaceId) || canvas.id !== parsed.data.canvasId) return fail(notFound("canvas"));
  if (parsed.data.expectedVersion !== canvas.version) return fail(staleVersion());
  const link = state.canvasLinks.find((l) => l.canvas_id === canvas.id && l.project_id === project.id);
  if (!link) return fail(domainError("not_found", `This canvas is not in ${project.name}.`));
  if (state.projectLinks.filter((l) => l.project_id === project.id).length < 2) return fail(domainError("invalid", LAST_CANVAS_MESSAGE));

  const otherProjectIds = state.canvasLinks.filter((l) => l.canvas_id === canvas.id && l.project_id !== project.id).map((l) => l.project_id);
  const unlink: Write = { kind: "remove", table: "project_canvas", before: link };
  if (otherProjectIds.length) {
    return { ok: true, value: { deleted: false, otherProjectIds }, writeSet: buildWriteSet(ctx, workspaceId, [unlink]) };
  }
  const items = state.items.filter((i) => isLive(i, workspaceId) && i.canvas_id === canvas.id);
  const frames = state.frames.filter((f) => isLive(f, workspaceId) && f.canvas_id === canvas.id);
  const notes = (state.notes ?? []).filter((n) => isLive(n, workspaceId) && n.canvas_id === canvas.id);
  return {
    ok: true,
    value: { deleted: true, otherProjectIds: [] },
    writeSet: buildWriteSet(ctx, workspaceId, [
      ...notes.map((n): Write => ({ kind: "update", table: "note", before: n, row: nextVersion(ctx, n, { deleted_at: ctx.now }) })),
      ...items.map((i): Write => ({ kind: "update", table: "canvas_item", before: i, row: nextVersion(ctx, i, { deleted_at: ctx.now }) })),
      ...frames.map((f): Write => ({ kind: "update", table: "frame", before: f, row: nextVersion(ctx, f, { deleted_at: ctx.now }) })),
      { kind: "update", table: "canvas", before: canvas, row: nextVersion(ctx, canvas, { deleted_at: ctx.now }) },
      unlink,
    ]),
  };
}

// ---- look and layer mode (D-12, D-22) ----

const lookInput = z
  .object({
    canvasId: uuidSchema,
    expectedVersion: versionSchema,
    background: z.enum(CANVAS_BACKGROUNDS).optional(),
    grid: z.enum(CANVAS_GRIDS).optional(),
    layer: z.enum(CANVAS_LAYERS).optional(),
  })
  .strict();
export type SetCanvasLookInput = z.input<typeof lookInput>;

/**
 * Background, grid and layer mode of one canvas. Saved with a new version and a change event like any write
 * (AD-12, AD-13), but not an undo step (D-12), and undo of other steps leaves the look alone (`undo.ts`).
 */
export function setCanvasLook(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { canvas: Canvas | null },
  input: unknown,
): CommandResult<{ canvas: Canvas }> {
  const denied = checkPermission(access, "canvas.edit_look");
  if (denied) return fail(denied);
  const parsed = parseInput(lookInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { canvasId, expectedVersion, background, grid, layer } = parsed.data;
  const { canvas } = state;
  if (!isLive(canvas, access.workspace.id) || canvas.id !== canvasId) return fail(notFound("canvas"));
  if (expectedVersion !== canvas.version) return fail(staleVersion());
  const look: CanvasLook = {
    background: background ?? canvas.look.background,
    grid: grid ?? canvas.look.grid,
    layer: layer ?? canvas.look.layer,
  };
  if (sameLook(look, canvas.look)) return fail(domainError("invalid", "Nothing to change."));

  const row = nextVersion(ctx, canvas, { look });
  return { ok: true, value: { canvas: row }, writeSet: buildWriteSet(ctx, access.workspace.id, [{ kind: "update", table: "canvas", before: canvas, row }]) };
}

const lookAllInput = z.object({ canvasId: uuidSchema }).strict();
export type ApplyLookToAllCanvasesInput = z.input<typeof lookAllInput>;

/**
 * “Use this look on all canvases”: this canvas's background and grid go to every canvas of the workspace. The layer
 * mode stays each canvas's own (D-22). One change group, not an undo step.
 */
export function applyLookToAllCanvases(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { canvases: readonly Canvas[] },
  input: unknown,
): CommandResult<{ changed: number }> {
  const denied = checkPermission(access, "canvas.edit_look");
  if (denied) return fail(denied);
  const parsed = parseInput(lookAllInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const workspaceId = access.workspace.id;
  const live = state.canvases.filter((c) => isLive(c, workspaceId));
  const source = live.find((c) => c.id === parsed.data.canvasId);
  if (!source) return fail(notFound("canvas"));
  const { background, grid } = source.look;
  const writes: Write[] = live
    .filter((c) => c.look.background !== background || c.look.grid !== grid)
    .map((c) => ({ kind: "update", table: "canvas", before: c, row: nextVersion(ctx, c, { look: { ...c.look, background, grid } }) }));
  if (!writes.length) return fail(domainError("invalid", "Every canvas already uses this look."));
  return { ok: true, value: { changed: writes.length }, writeSet: buildWriteSet(ctx, workspaceId, writes) };
}

const sameLook = (a: CanvasLook, b: CanvasLook) => a.background === b.background && a.grid === b.grid && a.layer === b.layer;
