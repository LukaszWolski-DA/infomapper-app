// Project commands.

import { z } from "zod";
import { buildWriteSet, fail, newRowColumns, type CommandContext, type CommandResult } from "../changes";
import { notFound } from "../errors";
import type { Uuid } from "../ids";
import { checkPermission, type WorkspaceAccess } from "../permissions";
import { DEFAULT_CANVAS_LOOK, type Canvas, type Project, type ProjectCanvas } from "../types";
import { nameSchema, parseInput, uuidSchema } from "../validation";
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
