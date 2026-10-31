// Project commands: create, name and description (slice 9, D-59), delete (slice 12a, D-65).

import { z } from "zod";
import { buildWriteSet, fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound } from "../errors";
import type { Uuid } from "../ids";
import { checkPermission, type WorkspaceAccess } from "../permissions";
import { DEFAULT_CANVAS_LOOK, type Canvas, type CanvasItem, type Frame, type Note, type Project, type ProjectCanvas, type ProjectPinnedLabel } from "../types";
import { nameSchema, optionalTextSchema, parseInput, uuidSchema, versionSchema } from "../validation";
import { canvasDeletionWrites } from "./canvas";
import { begin, current, done, isLive, nothingToChange } from "./shared";
import { FIRST_CANVAS_NAME } from "./workspace";

const createProjectInput = z.object({ workspaceId: uuidSchema, name: nameSchema }).strict();
export type CreateProjectInput = z.input<typeof createProjectInput>;

/** The undo history's name of a new project (slice 12a, F4: by the groups' events it read "Create canvas"). */
export const CREATE_PROJECT_LABEL = "Create project";

/** Creates a project with one canvas "First canvas", as the prototype does. One undo step, "Create project". */
export function createProject(
  ctx: CommandContext,
  access: WorkspaceAccess,
  input: unknown,
): CommandResult<{ projectId: Uuid; canvasId: Uuid }> {
  const denied = checkPermission(access, "project.create");
  if (denied) return fail(denied);
  const parsed = parseInput(createProjectInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const workspaceId = access.workspace.id;
  if (parsed.data.workspaceId !== workspaceId) return fail(notFound("workspace"));

  const project: Project = {
    ...newRowColumns(ctx),
    workspace_id: workspaceId,
    name: parsed.data.name,
    description: null,
  };
  const canvas: Canvas = {
    ...newRowColumns(ctx),
    workspace_id: workspaceId,
    name: FIRST_CANVAS_NAME,
    live_label_id: null,
    look: { ...DEFAULT_CANVAS_LOOK },
    entity_names: null,
    attribute_names: null,
  };
  const link: ProjectCanvas = {
    project_id: project.id,
    canvas_id: canvas.id,
    workspace_id: workspaceId,
    sort_order: 0,
    added_at: ctx.now,
    added_by: ctx.actorId,
  };

  return {
    ok: true,
    value: { projectId: project.id, canvasId: canvas.id },
    writeSet: {
      ...buildWriteSet(ctx, workspaceId, [
        { kind: "insert", table: "project", row: project },
        { kind: "insert", table: "canvas", row: canvas },
        { kind: "insert", table: "project_canvas", row: link },
      ]),
      label: CREATE_PROJECT_LABEL,
    },
  };
}

// ---- name and description (slice 9, D-59) ----

/** D-59 (ii): an empty name is not saved; the project home shows this and puts the stored name back. */
export const PROJECT_NAME_REQUIRED = "A project needs a name.";

const updateProjectInput = z
  .object({
    projectId: uuidSchema,
    expectedVersion: versionSchema,
    // no length rule and duplicates allowed, as when a project is created (F9)
    name: z.string().trim().min(1, PROJECT_NAME_REQUIRED).optional(),
    // plain text, lines kept; empty is stored as null
    description: optionalTextSchema.optional(),
  })
  .strict();
export type UpdateProjectInput = z.input<typeof updateProjectInput>;

/** The project's name and description from its home, as `renameCanvas`: one change group, one undo step (D-59 (iii)). */
export function updateProject(ctx: CommandContext, access: WorkspaceAccess, state: { project: Project | null }, input: unknown): CommandResult<{ project: Project }> {
  const parsed = begin(access, "project.edit", updateProjectInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { projectId, expectedVersion, name, description } = parsed.data;
  const got = current(state.project, access, projectId, expectedVersion, "project");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  const patch: Partial<Pick<Project, "name" | "description">> = {};
  if (name !== undefined && name !== before.name) patch.name = name;
  if (description !== undefined && description !== before.description) patch.description = description;
  if (!Object.keys(patch).length) return fail(nothingToChange());

  const row = nextVersion<Project>(ctx, before, patch);
  return done(ctx, access, { project: row }, [{ kind: "update", table: "project", before, row }]);
}

// ---- delete (slice 12a, D-65) ----

/** The last live project of a workspace is never deleted: by this command, an undo or a redo, or two deletes at once. */
export const LAST_PROJECT_MESSAGE = "A workspace needs at least one project.";

/** The undo history's name of a project's delete (slice 12a, F4). */
export const deleteProjectLabel = (name: string): string => `Delete project ${name}`;

const deleteProjectInput = z.object({ projectId: uuidSchema, expectedVersion: versionSchema }).strict();
export type DeleteProjectInput = z.input<typeof deleteProjectInput>;

export interface DeleteProjectState {
  project: Project | null;
  /** The workspace's live projects, to keep the last one. */
  projects: readonly Project[];
  /** The workspace's canvas links (of live projects and canvases). */
  links: readonly ProjectCanvas[];
  /** The canvases the project links; deleted ones are skipped. */
  canvases: readonly Canvas[];
  /** The cards, frames and notes of those canvases (deleted ones are skipped). */
  items: readonly CanvasItem[];
  frames: readonly Frame[];
  notes: readonly Note[];
  /** The workspace's project pins. */
  pins: readonly ProjectPinnedLabel[];
}

/**
 * "Delete this project" on its home (item 11): the project is soft-deleted with its canvas links and its pins; each of
 * its canvases that no other project links is soft-deleted with its cards, frames and notes, as a canvas's delete does
 * (`canvasDeletionWrites`); a shared canvas stays in its other projects with everything on it. The model is untouched
 * and nothing is labeled by the working context (D-26: deletions are not labeled). Checks the project's version only:
 * its canvases and their contents are read as they stand, and the adapter refuses a row changed between read and write
 * (F10). Refused for the workspace's last live project. One change group, one undo step "Delete project {name}".
 */
export function deleteProject(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: DeleteProjectState,
  input: unknown,
): CommandResult<{ name: string; deletedCanvasIds: Uuid[]; keptCanvasIds: Uuid[] }> {
  const parsed = begin(access, "project.delete", deleteProjectInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { projectId, expectedVersion } = parsed.data;
  const got = current(state.project, access, projectId, expectedVersion, "project");
  if (!got.ok) return fail(got.error);
  const project = got.row;
  const ws = access.workspace.id;
  if (!state.projects.some((p) => isLive(p, ws) && p.id !== project.id)) return fail(domainError("invalid", LAST_PROJECT_MESSAGE));

  const own = state.links.filter((l) => l.workspace_id === ws && l.project_id === project.id);
  const writes: Write[] = [];
  const deletedCanvasIds: Uuid[] = [];
  const keptCanvasIds: Uuid[] = [];
  for (const link of own) {
    const canvas = state.canvases.find((c) => c.id === link.canvas_id);
    if (!isLive(canvas, ws)) continue;
    if (state.links.some((l) => l.canvas_id === canvas.id && l.project_id !== project.id)) {
      keptCanvasIds.push(canvas.id);
      continue;
    }
    writes.push(...canvasDeletionWrites(ctx, ws, canvas, state));
    deletedCanvasIds.push(canvas.id);
  }
  writes.push(...own.map((before): Write => ({ kind: "remove", table: "project_canvas", before })));
  writes.push(...state.pins.filter((p) => p.workspace_id === ws && p.project_id === project.id).map((before): Write => ({ kind: "remove", table: "project_pinned_label", before })));
  writes.push({ kind: "update", table: "project", before: project, row: nextVersion(ctx, project, { deleted_at: ctx.now }) });

  const result = done(ctx, access, { name: project.name, deletedCanvasIds, keptCanvasIds }, writes);
  if (result.ok) result.writeSet.label = deleteProjectLabel(project.name);
  return result;
}
