// People in a workspace (slice 8, P6, P7): changing a role, removing a person; since slice 33 people join by an
// invitation (`invitations.ts`), whose memberships are `joinWrites` here. Workspace owners and admins may
// (`people.edit`); only an owner gives, takes or touches the Owner role (item 11, F12); nobody changes or removes their
// own row; the last owner stays. Each writes one change group in the workspace (item 17) and is no undo step (P10).
//
// Organization membership (P7 as answered, F8): a person belongs to an organization while they have a workspace in
// it. `organization_member` keeps the organization role and the home/guest distinction: a new person joining, or an
// account with no link to this organization yet, writes a `member` row; a guest added to another workspace stays a
// guest (step 2's answer 2); removing someone from their last workspace there deletes their row, except for the
// organization's owner, who keeps a workspace (F9).

import { z } from "zod";
import { buildWriteSet, fail, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound, type DomainError } from "../errors";
import type { Uuid } from "../ids";
import { checkPermission, type WorkspaceAccess } from "../permissions";
import { WORKSPACE_ROLES, type AppUser, type Organization, type OrganizationMember, type WorkspaceMember, type WorkspaceRole } from "../types";
import { parseInput, uuidSchema } from "../validation";

/** How roles are named in texts (the prototype's labels; the app's role select and badges use the same). */
export const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  modeler: "Modeler",
  reviewer: "Reviewer",
  reader: "Reader",
};

/** The last owner keeps the role (item 11, 12); the local adapter checks it again inside its write (step 5's answer). */
export const LAST_OWNER = (workspace: string) => `${workspace} needs at least one owner.`;
export const OWN_ROLE_MESSAGE = "You cannot change your own role.";
export const OWN_REMOVAL_MESSAGE = "You cannot remove yourself.";
export const OWNER_ONLY_GIVE_MESSAGE = "Only an owner can make someone an owner.";
export const OWNER_ONLY_CHANGE_MESSAGE = "Only an owner can change an owner's role.";
export const OWNER_ONLY_REMOVE_MESSAGE = "Only an owner can remove an owner.";

/**
 * A person joins a workspace (item 10; slice 33's invitations, F17): a `member` row in the organization when they have
 * no link to it yet, then the workspace membership. `linked`: a row in the organization or a workspace there; a guest of
 * this organization (a workspace here, no row) stays a guest.
 */
export function joinWrites(
  ctx: Pick<CommandContext, "now">,
  j: { organizationId: Uuid; workspaceId: Uuid; userId: Uuid; role: WorkspaceRole; addedBy: Uuid | null; linked: boolean },
): Write[] {
  const writes: Write[] = [];
  if (!j.linked) {
    writes.push({ kind: "insert", table: "organization_member", row: { organization_id: j.organizationId, user_id: j.userId, role: "member", created_at: ctx.now } });
  }
  writes.push({
    kind: "insert",
    table: "workspace_member",
    row: { workspace_id: j.workspaceId, user_id: j.userId, role: j.role, added_by: j.addedBy, created_at: ctx.now },
  });
  return writes;
}

// ---- changing a role ----

const changeRoleInput = z.object({ workspaceId: uuidSchema, userId: uuidSchema, role: z.enum(WORKSPACE_ROLES) }).strict();
export type ChangeRoleInput = z.input<typeof changeRoleInput>;

export interface PersonState {
  access: WorkspaceAccess;
  /** The person whose row is changed or removed. */
  person: AppUser | null;
  /** Everyone in the workspace: the person's row and the owners. */
  members: readonly WorkspaceMember[];
}

/** Changes a person's role in the workspace (item 11). */
export function changeRole(ctx: CommandContext, state: PersonState, input: unknown): CommandResult<{ toast: string }> {
  const { access, person, members } = state;
  const denied = checkPermission(access, "people.edit");
  if (denied) return fail(denied);
  const parsed = parseInput(changeRoleInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const p = parsed.data;
  if (p.workspaceId !== access.workspace.id) return fail(notFound("workspace"));
  const row = members.find((m) => m.user_id === p.userId && m.workspace_id === access.workspace.id);
  if (!row || !person || person.id !== p.userId) return fail(notFound("person"));
  if (row.user_id === ctx.actorId) return fail(domainError("forbidden", OWN_ROLE_MESSAGE));
  if (row.role === p.role) return fail(domainError("invalid", `${person.display_name} is already ${ROLE_LABEL[p.role]}.`));

  const actorIsOwner = access.member?.role === "owner";
  if (row.role === "owner" && !actorIsOwner) return fail(domainError("forbidden", OWNER_ONLY_CHANGE_MESSAGE));
  if (p.role === "owner" && !actorIsOwner) return fail(domainError("forbidden", OWNER_ONLY_GIVE_MESSAGE));
  if (row.role === "owner" && ownerCount(members) <= 1) return fail(domainError("invalid", LAST_OWNER(access.workspace.name)));

  return {
    ok: true,
    value: { toast: `${person.display_name} is now ${ROLE_LABEL[p.role]}.` },
    writeSet: buildWriteSet(ctx, access.workspace.id, [{ kind: "update", table: "workspace_member", before: row, row: { ...row, role: p.role } }]),
  };
}

// ---- removing a person ----

const removePersonInput = z.object({ workspaceId: uuidSchema, userId: uuidSchema }).strict();
export type RemovePersonInput = z.input<typeof removePersonInput>;

export interface RemovePersonState extends PersonState {
  organization: Organization | null;
  /** The person's row in this workspace's organization; null for a guest. */
  personOrganizationMember: OrganizationMember | null;
  /** The person's other live workspaces in this organization (this one left out). */
  personOtherWorkspaceIds: readonly Uuid[];
}

export interface RemovePersonPreview {
  /** The confirmation's lines (item 12). */
  confirmation: string[];
  /** True when this is their last workspace in the organization: they leave it (P7). */
  leavesOrganization: boolean;
  toast: string;
}

/** Checks a removal and returns the confirmation (item 12). Writes nothing. */
export function checkRemovePerson(
  ctx: Pick<CommandContext, "actorId">,
  state: RemovePersonState,
  input: unknown,
): { ok: true; value: RemovePersonPreview } | { ok: false; error: DomainError } {
  const checked = checkRemove(ctx, state, input);
  if (!checked.ok) return checked;
  return { ok: true, value: checked.preview };
}

/**
 * Removes the person from the workspace (item 12); from their last workspace in the organization, their organization
 * membership goes too (P7). Their earlier work keeps their name: accounts are never deleted.
 */
export function removePerson(ctx: CommandContext, state: RemovePersonState, input: unknown): CommandResult<RemovePersonPreview> {
  const checked = checkRemove(ctx, state, input);
  if (!checked.ok) return checked;
  const { row, preview } = checked;
  const writes: Write[] = [{ kind: "remove", table: "workspace_member", before: row }];
  if (preview.leavesOrganization && state.personOrganizationMember) {
    writes.push({ kind: "remove", table: "organization_member", before: state.personOrganizationMember });
  }
  return { ok: true, value: preview, writeSet: buildWriteSet(ctx, state.access.workspace.id, writes) };
}

function checkRemove(ctx: Pick<CommandContext, "actorId">, state: RemovePersonState, input: unknown) {
  const { access, person, members, organization, personOrganizationMember, personOtherWorkspaceIds } = state;
  const denied = checkPermission(access, "people.edit");
  if (denied) return fail(denied);
  if (!organization || organization.id !== access.workspace.organization_id) return fail(notFound("organization"));
  const parsed = parseInput(removePersonInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const p = parsed.data;
  if (p.workspaceId !== access.workspace.id) return fail(notFound("workspace"));
  const row = members.find((m) => m.user_id === p.userId && m.workspace_id === access.workspace.id);
  if (!row || !person || person.id !== p.userId) return fail(notFound("person"));
  if (personOrganizationMember && (personOrganizationMember.user_id !== person.id || personOrganizationMember.organization_id !== organization.id)) {
    return fail(notFound("person"));
  }
  if (row.user_id === ctx.actorId) return fail(domainError("forbidden", OWN_REMOVAL_MESSAGE));
  if (row.role === "owner" && access.member?.role !== "owner") return fail(domainError("forbidden", OWNER_ONLY_REMOVE_MESSAGE));
  if (row.role === "owner" && ownerCount(members) <= 1) return fail(domainError("invalid", LAST_OWNER(access.workspace.name)));

  const last = personOtherWorkspaceIds.filter((id) => id !== access.workspace.id).length === 0;
  // F9 as answered: the organization's owner keeps at least one workspace there
  if (last && personOrganizationMember?.role === "owner") {
    return fail(domainError("invalid", `${person.display_name} owns ${organization.name}, so they keep at least one workspace there.`));
  }
  const name = person.display_name;
  const confirmation = [`${name} loses access to ${access.workspace.name}.`];
  if (last) confirmation.push(`They are in no other workspace of ${organization.name}, so they leave ${organization.name} too.`);
  return { ok: true as const, row, preview: { confirmation, leavesOrganization: last, toast: `${name} no longer has access.` } };
}

const ownerCount = (members: readonly WorkspaceMember[]) => members.filter((m) => m.role === "owner").length;
