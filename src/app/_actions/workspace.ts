"use server";

// Workspace and project writes (slice 0, step 5b). Each runs a domain command through runCommand();
// the server refuses whatever the role or the archive does not allow, whatever the UI showed.

import { revalidatePath } from "next/cache";
import type { DataStore } from "@/data";
import { createProject, deleteProject, updateProject } from "@/domain/commands/project";
import { archiveWorkspace, createWorkspace, unarchiveWorkspace, updateWorkspaceSettings } from "@/domain/commands/workspace";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceAccess } from "@/domain/permissions";
import { rememberGoneProject } from "../_lib/gone-project";
import { projectHref, workspaceHref } from "../_lib/paths";
import { runCommand, type ActionResult, type Saved } from "../_lib/run-command";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };

async function loadAccess(store: DataStore, workspaceId: unknown, userId: Uuid): Promise<WorkspaceAccess | null> {
  if (typeof workspaceId !== "string") return null;
  const workspace = await store.workspaces.get(workspaceId);
  if (!workspace) return null;
  return { workspace, member: await store.workspaces.getMember(workspace.id, userId) };
}

function done<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function createWorkspaceAction(input: { organizationId: string; name: string }) {
  return done(
    await runCommand(async (ctx, store, user) => {
      const organization = typeof input?.organizationId === "string" ? await store.organizations.get(input.organizationId) : null;
      const organizationMember = organization ? await store.organizations.getMember(organization.id, user.id) : null;
      const result = createWorkspace(ctx, { organization, organizationMember }, input);
      return result.ok ? { ...result, value: { href: workspaceHref(result.value.workspaceId) } } : result;
    }),
  );
}

export async function updateWorkspaceSettingsAction(input: {
  workspaceId: string;
  expectedVersion: number;
  name?: string;
  clientName?: string | null;
  description?: string | null;
  docLanguage?: string;
  dv2Mode?: boolean;
  fourEyes?: boolean;
}) {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const result = updateWorkspaceSettings(ctx, access, input);
      return result.ok ? { ...result, value: { version: result.value.workspace.version } } : result;
    }),
  );
}

export async function archiveWorkspaceAction(input: { workspaceId: string; expectedVersion: number }) {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const result = archiveWorkspace(ctx, access, input);
      return result.ok ? { ...result, value: { version: result.value.workspace.version } } : result;
    }),
  );
}

export async function unarchiveWorkspaceAction(input: { workspaceId: string; expectedVersion: number }) {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      // the settings form's next save sends this version (slice 10a, F1)
      const result = unarchiveWorkspace(ctx, access, input);
      return result.ok ? { ...result, value: { version: result.value.workspace.version } } : result;
    }),
  );
}

export async function createProjectAction(input: { workspaceId: string; name: string }) {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const result = createProject(ctx, access, input);
      return result.ok ? { ...result, value: { href: projectHref(access.workspace.id, result.value.projectId) } } : result;
    }),
  );
}

/** The project's name and description from its home (slice 9, D-59); the new version for the next save. */
export async function updateProjectAction(input: {
  workspaceId: string;
  projectId: string;
  expectedVersion: number;
  name?: string;
  description?: string | null;
}): Promise<ActionResult<Saved<{ name: string }>>> {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const project = typeof input?.projectId === "string" ? await store.projects.get(access.workspace.id, input.projectId) : null;
      const result = updateProject(ctx, access, { project }, {
        projectId: input?.projectId,
        expectedVersion: input?.expectedVersion,
        ...(input?.name !== undefined ? { name: input.name } : {}),
        ...(input?.description !== undefined ? { description: input.description } : {}),
      });
      return result.ok ? { ...result, value: { name: result.value.project.name, version: result.value.project.version } } : result;
    }),
  );
}

/**
 * "Delete this project" on its home (slice 12a, D-65): the project, its links and pins, and the canvases only it uses.
 * The page, drawn again, finds its project gone and goes to the workspace home without "That project no longer
 * exists." (`rememberGoneProject`, F2); the browser shows the delete's own toast, with Undo.
 */
export async function deleteProjectAction(input: { workspaceId: string; projectId: string; expectedVersion: number }): Promise<ActionResult<{ name: string; deletedCanvases: number }>> {
  const result = await runCommand(async (ctx, store, user) => {
    const access = await loadAccess(store, input?.workspaceId, user.id);
    if (!access) return NOT_FOUND;
    const ws = access.workspace.id;
    const [project, projects, canvases, items, frames, notes, pins] = await Promise.all([
      typeof input?.projectId === "string" ? store.projects.get(ws, input.projectId) : null,
      store.projects.list(ws),
      store.canvases.list(ws),
      store.canvasItems.list(ws),
      store.frames.list(ws),
      store.notes.list(ws),
      store.labels.listPins(ws),
    ]);
    const links = (await Promise.all(canvases.map((c) => store.canvases.listLinksOfCanvas(ws, c.id)))).flat();
    const r = deleteProject(ctx, access, { project, projects, links, canvases, items, frames, notes, pins }, { projectId: input?.projectId, expectedVersion: input?.expectedVersion });
    return r.ok ? { ...r, value: { name: r.value.name, deletedCanvases: r.value.deletedCanvasIds.length } } : r;
  });
  if (result.ok) await rememberGoneProject(input.projectId);
  return done(result);
}
