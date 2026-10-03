// What each workspace role may do (AD-05), the archive (AD-09) and guests (AD-01).
// Only the actions of slice 0 are listed; later slices add theirs.

import { ARCHIVED_MESSAGE, domainError, notFound, type DomainError } from "./errors";
import type { Uuid } from "./ids";
import type { OrganizationMember, Workspace, WorkspaceMember, WorkspaceRole } from "./types";

export const WORKSPACE_ACTIONS = [
  "workspace.view",
  "workspace.edit_settings",
  "workspace.archive",
  "workspace.unarchive",
  "project.create",
  "canvas.create",
  "canvas.rename",
  "canvas.edit_projects",
] as const;
export type WorkspaceAction = (typeof WORKSPACE_ACTIONS)[number];

const EDITORS: readonly WorkspaceRole[] = ["owner", "admin", "modeler"];
const ALL_ROLES: readonly WorkspaceRole[] = ["owner", "admin", "modeler", "reviewer", "reader"];

/** Roles allowed to perform each action. Reviewers and readers change nothing in slice 0. */
export const ROLE_PERMISSIONS: Record<WorkspaceAction, readonly WorkspaceRole[]> = {
  "workspace.view": ALL_ROLES,
  "workspace.edit_settings": ["owner", "admin"],
  "workspace.archive": ["owner"],
  "workspace.unarchive": ["owner"],
  "project.create": EDITORS,
  "canvas.create": EDITORS,
  "canvas.rename": EDITORS,
  "canvas.edit_projects": EDITORS,
};

/** Actions that remain possible while the workspace is archived (AD-09). */
const ALLOWED_WHEN_ARCHIVED: ReadonlySet<WorkspaceAction> = new Set(["workspace.view", "workspace.unarchive"]);

const ACTION_TEXT: Record<WorkspaceAction, string> = {
  "workspace.view": "open this workspace",
  "workspace.edit_settings": "change the workspace settings",
  "workspace.archive": "archive this workspace",
  "workspace.unarchive": "unarchive this workspace",
  "project.create": "create projects",
  "canvas.create": "create canvases",
  "canvas.rename": "rename canvases",
  "canvas.edit_projects": "change which projects a canvas belongs to",
};

/** The acting user's standing in one workspace, as loaded by the caller. */
export interface WorkspaceAccess {
  workspace: Workspace;
  /** The actor's membership, or null when the actor is not a member. */
  member: WorkspaceMember | null;
}

export const isArchived = (workspace: Workspace): boolean => workspace.archived_at !== null;

/** Returns why the actor may not perform the action, or null when it is allowed. */
export function checkPermission(access: WorkspaceAccess, action: WorkspaceAction): DomainError | null {
  const { workspace, member } = access;
  if (workspace.deleted_at !== null) return notFound("workspace");
  if (!member || member.workspace_id !== workspace.id) {
    return domainError("forbidden", "You are not a member of this workspace.");
  }
  if (isArchived(workspace) && !ALLOWED_WHEN_ARCHIVED.has(action)) {
    return domainError("archived", ARCHIVED_MESSAGE);
  }
  if (!ROLE_PERMISSIONS[action].includes(member.role)) {
    return domainError("forbidden", `As ${roleWithArticle(member.role)} you cannot ${ACTION_TEXT[action]}.`);
  }
  if (action === "workspace.unarchive" && !isArchived(workspace)) {
    return domainError("invalid", "This workspace is not archived.");
  }
  return null;
}

export const can = (access: WorkspaceAccess, action: WorkspaceAction): boolean =>
  checkPermission(access, action) === null;

/**
 * Creating a workspace: any member of the organization may, guests may not
 * (the prototype hides "New workspace" in an organization where you are a guest).
 */
export function checkCreateWorkspace(
  organizationId: Uuid,
  organizationMember: OrganizationMember | null,
): DomainError | null {
  if (!organizationMember || organizationMember.organization_id !== organizationId) {
    return domainError("forbidden", "Only members of this organization can create workspaces in it.");
  }
  return null;
}

/** A guest is a workspace member who is not a member of the workspace's organization (derived, not stored). */
export function isGuest(
  workspace: Workspace,
  userId: Uuid,
  organizationMembers: readonly OrganizationMember[],
): boolean {
  return !organizationMembers.some((m) => m.organization_id === workspace.organization_id && m.user_id === userId);
}

function roleWithArticle(role: WorkspaceRole): string {
  return /^[aeiou]/.test(role) ? `an ${role}` : `a ${role}`;
}
