"use server";

// Workspace and project writes (slice 0, step 5b). Each runs a domain command through runCommand();
// the server refuses whatever the role or the archive does not allow, whatever the UI showed.

import { revalidatePath } from "next/cache";
import type { DataStore } from "@/data";
import { createProject } from "@/domain/commands/project";
import { archiveWorkspace, createWorkspace, unarchiveWorkspace, updateWorkspaceSettings } from "@/domain/commands/workspace";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceAccess } from "@/domain/permissions";
import { projectHref, workspaceHref } from "../_lib/paths";
import { runCommand, type ActionResult } from "../_lib/run-command";

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
      return result.ok ? { ...result, value: undefined } : result;
    }),
  );
}

export async function unarchiveWorkspaceAction(input: { workspaceId: string; expectedVersion: number }) {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const result = unarchiveWorkspace(ctx, access, input);
      return result.ok ? { ...result, value: undefined } : result;
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
