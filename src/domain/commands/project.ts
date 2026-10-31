// Project commands.

import { z } from "zod";
import { buildWriteSet, fail, newRowColumns, nextVersion, type CommandContext, type CommandResult } from "../changes";
import { notFound } from "../errors";
import type { Uuid } from "../ids";
import { checkPermission, type WorkspaceAccess } from "../permissions";
import { DEFAULT_CANVAS_LOOK, type Canvas, type Project, type ProjectCanvas } from "../types";
import { nameSchema, optionalTextSchema, parseInput, uuidSchema, versionSchema } from "../validation";
import { begin, current, done, nothingToChange } from "./shared";
import { FIRST_CANVAS_NAME } from "./workspace";

const createProjectInput = z.object({ workspaceId: uuidSchema, name: nameSchema }).strict();
export type CreateProjectInput = z.input<typeof createProjectInput>;

/** Creates a project with one canvas "First canvas", as the prototype does. */
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
    writeSet: buildWriteSet(ctx, workspaceId, [
      { kind: "insert", table: "project", row: project },
      { kind: "insert", table: "canvas", row: canvas },
      { kind: "insert", table: "project_canvas", row: link },
    ]),
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
