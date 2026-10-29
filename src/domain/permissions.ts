// What each workspace role may do (AD-05), the archive (AD-09) and guests (AD-01).
// Actions of slices 0 to 4a; later slices add theirs (slice 8: people, and the organization's access below).

import { ARCHIVED_MESSAGE, domainError, notFound, type DomainError } from "./errors";
import type { Uuid } from "./ids";
import type { Organization, OrganizationMember, Workspace, WorkspaceMember, WorkspaceRole } from "./types";

export const WORKSPACE_ACTIONS = [
  "workspace.view",
  "workspace.edit_settings",
  "workspace.archive",
  "workspace.unarchive",
  "project.create",
  "project.edit",
  "canvas.create",
  "canvas.rename",
  "canvas.edit_projects",
  "canvas.edit_items",
  "canvas.edit_look",
  "canvas.delete",
  "model.edit",
  "mapping.set_status",
  "label.edit",
  "note.edit",
  "requirement.edit",
  "requirement.set_status",
  "people.edit",
] as const;
export type WorkspaceAction = (typeof WORKSPACE_ACTIONS)[number];

const EDITORS: readonly WorkspaceRole[] = ["owner", "admin", "modeler"];
const ALL_ROLES: readonly WorkspaceRole[] = ["owner", "admin", "modeler", "reviewer", "reader"];

/**
 * Roles allowed to perform each action. Reviewers may change a mapping's status (approve) and work on notes as modelers
 * do (AD-05; slice 3a, Łukasz's answer 1); labels are for modelers, admins and owners (answer 2); reviewers change a
 * requirement's status only (AD-05, slice 4a); readers change nothing.
 */
export const ROLE_PERMISSIONS: Record<WorkspaceAction, readonly WorkspaceRole[]> = {
  "workspace.view": ALL_ROLES,
  "workspace.edit_settings": ["owner", "admin"],
  "workspace.archive": ["owner"],
  "workspace.unarchive": ["owner"],
  "project.create": EDITORS,
  // a project's name and description on its home (slice 9, D-59)
  "project.edit": EDITORS,
  "canvas.create": EDITORS,
  "canvas.rename": EDITORS,
  "canvas.edit_projects": EDITORS,
  "canvas.edit_items": EDITORS,
  "canvas.edit_look": EDITORS,
  "canvas.delete": EDITORS,
  "model.edit": EDITORS,
  "mapping.set_status": ["owner", "admin", "modeler", "reviewer"],
  "label.edit": EDITORS,
  "note.edit": ["owner", "admin", "modeler", "reviewer"],
  "requirement.edit": EDITORS,
  "requirement.set_status": ["owner", "admin", "modeler", "reviewer"],
  // adding people, changing their role and removing them (slice 8, P6); who may touch an owner is the people commands'
  "people.edit": ["owner", "admin"],
};

/** Actions that remain possible while the workspace is archived (AD-09). */
const ALLOWED_WHEN_ARCHIVED: ReadonlySet<WorkspaceAction> = new Set(["workspace.view", "workspace.unarchive"]);

const ACTION_TEXT: Record<WorkspaceAction, string> = {
  "workspace.view": "open this workspace",
  "workspace.edit_settings": "change the workspace settings",
  "workspace.archive": "archive this workspace",
  "workspace.unarchive": "unarchive this workspace",
  "project.create": "create projects",
  "project.edit": "edit projects",
  "canvas.create": "create canvases",
  "canvas.rename": "rename canvases",
  "canvas.edit_projects": "change which projects a canvas belongs to",
  "canvas.edit_items": "change what is on a canvas",
  "canvas.edit_look": "change the look of a canvas",
  "canvas.delete": "delete canvases",
  "model.edit": "edit the model",
  "mapping.set_status": "change the status of a mapping",
  "label.edit": "change labels",
  "note.edit": "change notes",
  "requirement.edit": "change requirements",
  "requirement.set_status": "change requirements",
  "people.edit": "change who has access",
};

/** Refusals worded for the role rather than the action (slice 4a, PRD item 12). */
export const REVIEWER_REQUIREMENT_MESSAGE = "As a reviewer you can only change a requirement's status.";

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
    if (action === "requirement.edit" && member.role === "reviewer") return domainError("forbidden", REVIEWER_REQUIREMENT_MESSAGE);
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

/**
 * Changing an organization's password (slice 8, P8): its owners and admins, by their organization role whatever their
 * role in the workspace whose People tab they use; never from an archived workspace, whose log is read-only (F17).
 */
export function checkOrganizationAccess(
  access: WorkspaceAccess,
  organization: Organization,
  organizationMember: OrganizationMember | null,
): DomainError | null {
  const denied = checkPermission(access, "workspace.view");
  if (denied) return denied;
  if (access.workspace.organization_id !== organization.id || organization.deleted_at !== null) return notFound("organization");
  if (isArchived(access.workspace)) return domainError("archived", ARCHIVED_MESSAGE);
  const role = organizationMember?.organization_id === organization.id ? organizationMember.role : null;
  if (role !== "owner" && role !== "admin") {
    return domainError("forbidden", `Only the owners and admins of ${organization.name} can change its password.`);
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
