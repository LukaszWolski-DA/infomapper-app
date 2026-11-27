// What each workspace role may do (AD-05), the archive (AD-09) and guests (AD-01).
// Actions of slices 0 to 4a; later slices add theirs (slice 8: people, and the organization's access below).

import { ARCHIVED_MESSAGE, domainError, notFound, type DomainError } from "./errors";
import type { Uuid } from "./ids";
import type { Organization, OrganizationLicence, OrganizationMember, Workspace, WorkspaceMember, WorkspaceRole } from "./types";

export const WORKSPACE_ACTIONS = [
  "workspace.view",
  "workspace.edit_settings",
  "workspace.archive",
  "workspace.unarchive",
  "project.create",
  "project.edit",
  "project.delete",
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
  "module.own_objects",
  // slice 35 (D-87): baselines
  "baseline.create",
  "baseline.rename",
  "baseline.delete",
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
  // deleting a project from its home, with the canvases only it uses (slice 12a, D-65)
  "project.delete": EDITORS,
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
  // a member's own objects of a module, outside the model, that only they see (slice 25, AD-05's addition: an
  // InfoDocumenter private document); every role, never in an archived workspace. What else a module allows on its
  // objects is the module's own rule (InfoDocumenter's rights).
  "module.own_objects": ALL_ROLES,
  // slice 35 (D-87, the design of 11 November 2026): taking and renaming a baseline for editors, deleting it for owners
  // and admins; reading the list and comparing is `workspace.view`
  "baseline.create": EDITORS,
  "baseline.rename": EDITORS,
  "baseline.delete": ["owner", "admin"],
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
  "project.delete": "delete projects",
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
  "module.own_objects": "make your own documents",
  "baseline.create": "create baselines",
  "baseline.rename": "rename baselines",
  "baseline.delete": "delete baselines",
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

// ---- InfoCatalog (slice 39, A1.2 guardrail 2, A2.1, A2.3, S39-02) ----

/** A workspace a person reads in InfoCatalog: read only, with or without a role in it. */
export interface CatalogWorkspace {
  readonly id: Uuid;
  readonly organizationId: Uuid;
  readonly name: string;
  readonly archived: boolean;
  /** InfoCube's switch: its kinds are searched only where it is on. */
  readonly infocube: boolean;
  /** Whether the person has a role (any) in it; without one they read it because its switch is on. */
  readonly hasRole: boolean;
}

/** An organization whose catalog a person reads, with the workspaces they may read, by name. */
export interface CatalogOrganization {
  readonly id: Uuid;
  readonly name: string;
  readonly workspaces: readonly CatalogWorkspace[];
}

/** What the rule reads: the person's rows and their organizations' (any extra rows are ignored). */
export interface CatalogRightsInput {
  readonly userId: Uuid;
  /** The organizations the session has unlocked (online: every one of the person's, D-58's note). */
  readonly unlocked: ReadonlySet<Uuid>;
  readonly organizations: readonly Organization[];
  readonly memberships: readonly OrganizationMember[];
  readonly licences: readonly OrganizationLicence[];
  readonly workspaces: readonly Workspace[];
  readonly workspaceMembers: readonly WorkspaceMember[];
}

const byName = <T extends { name: string; id: string }>(a: T, b: T) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * May read the catalog (one rule, derived from stored rows, nothing stored for it): a person reads a workspace in
 * InfoCatalog when its organization is live, unlocked in the session and holds the `infocatalog` licence, the person is
 * a member of the organization (never a guest: a guest's role in a workspace of it gives no catalog), and the workspace
 * is live and either the person has a role in it or its switch "Shown in InfoCatalog" is on. Archived workspaces follow
 * the same rule. Organization owners and admins have no other way in. The organizations by name, each one's workspaces
 * by name; an organization with no readable workspace is listed with none (its tile still counts it).
 */
export function catalogReadable(input: CatalogRightsInput): CatalogOrganization[] {
  const { userId } = input;
  const member = new Set(input.memberships.filter((m) => m.user_id === userId).map((m) => m.organization_id));
  const licensed = new Set(input.licences.filter((l) => l.deleted_at === null && l.module === "infocatalog").map((l) => l.organization_id));
  const roles = new Set(input.workspaceMembers.filter((m) => m.user_id === userId).map((m) => m.workspace_id));
  const out: CatalogOrganization[] = [];
  for (const o of [...input.organizations].sort(byName)) {
    if (o.deleted_at !== null || !member.has(o.id) || !licensed.has(o.id) || !input.unlocked.has(o.id)) continue;
    const workspaces = input.workspaces
      .filter((w) => w.organization_id === o.id && w.deleted_at === null && (roles.has(w.id) || w.catalog_shown))
      .sort(byName)
      .map((w) => ({ id: w.id, organizationId: o.id, name: w.name, archived: w.archived_at !== null, infocube: w.infocube, hasRole: roles.has(w.id) }));
    out.push({ id: o.id, name: o.name, workspaces });
  }
  return out;
}

function roleWithArticle(role: WorkspaceRole): string {
  return /^[aeiou]/.test(role) ? `an ${role}` : `a ${role}`;
}
