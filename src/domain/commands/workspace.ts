// Workspace commands: create, edit settings, archive, unarchive (AD-09).

import { z } from "zod";
import { buildWriteSet, fail, newRowColumns, nextVersion, type CommandContext, type CommandResult } from "../changes";
import { notFound, staleVersion } from "../errors";
import type { Uuid } from "../ids";
import { checkCreateWorkspace, checkPermission, type WorkspaceAccess } from "../permissions";
import {
  DEFAULT_CANVAS_LOOK,
  DOC_LANGUAGES,
  type Canvas,
  type Organization,
  type OrganizationMember,
  type Project,
  type ProjectCanvas,
  type Workspace,
  type WorkspaceMember,
} from "../types";
import { nameSchema, optionalTextSchema, parseInput, uuidSchema, versionSchema } from "../validation";

export const FIRST_PROJECT_NAME = "First project";
export const FIRST_CANVAS_NAME = "First canvas";

// ---- create ----

const createWorkspaceInput = z.object({ organizationId: uuidSchema, name: nameSchema });
export type CreateWorkspaceInput = z.input<typeof createWorkspaceInput>;

export interface CreateWorkspaceState {
  organization: Organization | null;
  /** The actor's membership in that organization. */
  organizationMember: OrganizationMember | null;
}

/**
 * Creates an empty workspace in the organization with the creator as owner,
 * one project "First project" and one canvas "First canvas" in it.
 */
export function createWorkspace(
  ctx: CommandContext,
  state: CreateWorkspaceState,
  input: unknown,
): CommandResult<{ workspaceId: Uuid; projectId: Uuid; canvasId: Uuid }> {
  const { organization, organizationMember } = state;
  if (!organization || organization.deleted_at !== null) return fail(notFound("organization"));
  const denied = checkCreateWorkspace(organization.id, organizationMember);
  if (denied) return fail(denied);
  const parsed = parseInput(createWorkspaceInput, input);
  if (!parsed.ok) return fail(parsed.error);
  if (parsed.data.organizationId !== organization.id) return fail(notFound("organization"));

  const workspace: Workspace = {
    ...newRowColumns(ctx),
    organization_id: organization.id,
    name: parsed.data.name,
    client_name: null,
    description: null,
    doc_language: "en",
    dv2_mode: false,
    four_eyes: false,
    archived_at: null,
    archived_by: null,
    requirement_key_next: 101,
  };
  const member: WorkspaceMember = {
    workspace_id: workspace.id,
    user_id: ctx.actorId,
    role: "owner",
    added_by: ctx.actorId,
    created_at: ctx.now,
  };
  const project: Project = {
    ...newRowColumns(ctx),
    workspace_id: workspace.id,
    name: FIRST_PROJECT_NAME,
    description: null,
  };
  const canvas: Canvas = {
    ...newRowColumns(ctx),
    workspace_id: workspace.id,
    name: FIRST_CANVAS_NAME,
    live_label_id: null,
    look: { ...DEFAULT_CANVAS_LOOK },
  };
  const link: ProjectCanvas = {
    project_id: project.id,
    canvas_id: canvas.id,
    workspace_id: workspace.id,
    sort_order: 0,
    added_at: ctx.now,
    added_by: ctx.actorId,
  };

  return {
    ok: true,
    value: { workspaceId: workspace.id, projectId: project.id, canvasId: canvas.id },
    writeSet: buildWriteSet(ctx, workspace.id, [
      { kind: "insert", table: "workspace", row: workspace },
      { kind: "insert", table: "workspace_member", row: member },
      { kind: "insert", table: "project", row: project },
      { kind: "insert", table: "canvas", row: canvas },
      { kind: "insert", table: "project_canvas", row: link },
    ]),
  };
}

// ---- edit settings ----

const updateSettingsInput = z
  .object({
    workspaceId: uuidSchema,
    expectedVersion: versionSchema,
    name: nameSchema.optional(),
    clientName: optionalTextSchema.optional(),
    description: optionalTextSchema.optional(),
    docLanguage: z.enum(DOC_LANGUAGES).optional(),
    dv2Mode: z.boolean().optional(),
    fourEyes: z.boolean().optional(),
  })
  .strict();
export type UpdateWorkspaceSettingsInput = z.input<typeof updateSettingsInput>;

/** Changes any of name, client, description, documentation language, Data Vault 2.0 mode and four-eyes. */
export function updateWorkspaceSettings(
  ctx: CommandContext,
  access: WorkspaceAccess,
  input: unknown,
): CommandResult<{ workspace: Workspace }> {
  const denied = checkPermission(access, "workspace.edit_settings");
  if (denied) return fail(denied);
  const parsed = parseInput(updateSettingsInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { workspace } = access;
  const p = parsed.data;
  if (p.workspaceId !== workspace.id) return fail(notFound("workspace"));
  if (p.expectedVersion !== workspace.version) return fail(staleVersion());

  const patch: Partial<Workspace> = {};
  if (p.name !== undefined) patch.name = p.name;
  if (p.clientName !== undefined) patch.client_name = p.clientName;
  if (p.description !== undefined) patch.description = p.description;
  if (p.docLanguage !== undefined) patch.doc_language = p.docLanguage;
  if (p.dv2Mode !== undefined) patch.dv2_mode = p.dv2Mode;
  if (p.fourEyes !== undefined) patch.four_eyes = p.fourEyes;

  const row = nextVersion(ctx, workspace, patch);
  return {
    ok: true,
    value: { workspace: row },
    writeSet: buildWriteSet(ctx, workspace.id, [{ kind: "update", table: "workspace", before: workspace, row }]),
  };
}

// ---- archive and unarchive ----

const archiveInput = z.object({ workspaceId: uuidSchema, expectedVersion: versionSchema }).strict();
export type ArchiveWorkspaceInput = z.input<typeof archiveInput>;

function setArchived(
  ctx: CommandContext,
  access: WorkspaceAccess,
  input: unknown,
  archive: boolean,
): CommandResult<{ workspace: Workspace }> {
  const denied = checkPermission(access, archive ? "workspace.archive" : "workspace.unarchive");
  if (denied) return fail(denied);
  const parsed = parseInput(archiveInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { workspace } = access;
  if (parsed.data.workspaceId !== workspace.id) return fail(notFound("workspace"));
  if (parsed.data.expectedVersion !== workspace.version) return fail(staleVersion());

  const row = nextVersion(ctx, workspace, {
    archived_at: archive ? ctx.now : null,
    archived_by: archive ? ctx.actorId : null,
  });
  return {
    ok: true,
    value: { workspace: row },
    writeSet: buildWriteSet(ctx, workspace.id, [{ kind: "update", table: "workspace", before: workspace, row }]),
  };
}

/** Makes the workspace read-only (owner only, AD-09). */
export const archiveWorkspace = (ctx: CommandContext, access: WorkspaceAccess, input: unknown) =>
  setArchived(ctx, access, input, true);

/** Makes an archived workspace editable again (owner only, AD-09). */
export const unarchiveWorkspace = (ctx: CommandContext, access: WorkspaceAccess, input: unknown) =>
  setArchived(ctx, access, input, false);
