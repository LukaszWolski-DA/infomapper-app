// Invitations by link and password reset links (slice 33, AD-40). The server makes each link's token (32 random bytes)
// and hands these commands only its SHA-256 as hex (`tokenHash`): a token or a password never enters the domain. A
// command checks the rights, the row's state and the time on `ctx.now` (F15), and writes the rows and their change
// events in the workspace's log; none is an undo step (D-58).
//
// - Inviting (P2.1, P2.2): Owners and Admins (`people.edit`), never in an archived workspace, the roles Admin to Reader;
//   one pending invitation per workspace and e-mail (an expired one still counts: it is renewed with "New link", D6).
// - Accepting (Q6): a new person (`ctx.actorId` is the new `app_user`'s id, made by the caller, as `createOrganization`
//   does), an existing person, or a person without an Auth account (D5: their account is linked here). The memberships
//   are `joinWrites`, today's rule for "Add person" (PT8). The invitation's update is compared as a whole row inside the
//   write, so a second Join of the same link is refused there (F26).
// - Reset links (D1): only by someone who already has power over everything the person can reach.

import { z } from "zod";
import { buildWriteSet, fail, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound, type DomainError } from "../errors";
import type { Uuid } from "../ids";
import { checkPermission, isArchived, type WorkspaceAccess } from "../permissions";
import {
  INVITATION_ROLES,
  type AppUser,
  type Invitation,
  type InvitationRole,
  type Organization,
  type OrganizationMember,
  type PasswordReset,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceRole,
} from "../types";
import { parseInput, uuidSchema } from "../validation";
import { emailSchema, newFormName } from "./organization";
import { joinWrites, ROLE_LABEL } from "./people";

/** How long a link works (P2.2, P2.3). */
export const INVITATION_DAYS = 7;
export const RESET_HOURS = 24;

/** A person's own password (F11): at least 10 characters; at most 72, which Supabase's bcrypt takes. */
export const PERSON_PASSWORD_MIN = 10;
export const PERSON_PASSWORD_MAX = 72;
export const PASSWORD_TOO_SHORT = `The password needs at least ${PERSON_PASSWORD_MIN} characters.`;
export const PASSWORD_TOO_LONG = `The password can have at most ${PERSON_PASSWORD_MAX} characters.`;
export const PASSWORDS_DIFFER = "The two passwords are not the same.";

/** The one message for an unknown, altered, expired, used or revoked invitation link (PRD; P-l). */
export const INVITATION_GONE = "This invitation link has expired, was already used or was revoked. Nothing was changed.";
export const INVITATION_GONE_ASK = "Ask the person who invited you for a new link.";
/** The same for a reset link (not in the prototype, which has no refused reset page). */
export const RESET_GONE = "This password reset link has expired, was already used or was revoked. Nothing was changed.";
export const RESET_GONE_ASK = "Ask an owner or admin of your workspace for a new link.";

export const ALREADY_INVITED = (email: string) => `${email} is already in this workspace or invited.`;
export const ARCHIVED_JOIN = (workspace: string) => `${workspace} is archived, so nobody can join it now. Nothing was changed.`;
export const ALREADY_JOINED = (workspace: string) => `You are already in ${workspace}.`;
export const INVITATION_REVOKED = (email: string) => `The invitation to ${email} is revoked; its link no longer works.`;
export const RESET_FOR_SELF = "You cannot make a password reset link for yourself.";
export const RESET_FOR_GUEST = "A guest's password is reset in their own organization.";
export const RESET_FOR_OWNER = "Only an owner can make a password reset link for an owner.";
export const RESET_OUT_OF_REACH = (name: string) => `Only someone with the same rights in every workspace of ${name} can make this link.`;
export const ACCOUNT_MISMATCH = "This account is not the one the invitation is for. Nothing was changed.";

const HOUR_MS = 3_600_000;
const laterBy = (now: string, ms: number) => new Date(Date.parse(now) + ms).toISOString();
export const invitationExpiry = (now: string) => laterBy(now, INVITATION_DAYS * 24 * HOUR_MS);
export const resetExpiry = (now: string) => laterBy(now, RESET_HOURS * HOUR_MS);

/** A SHA-256 as the server hands it on: 64 lower-case hex characters. */
const tokenHashSchema = z.string().regex(/^[0-9a-f]{64}$/, "Not a link's hash.");
export const isTokenHash = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);

/** The person's password and its repetition (F11), or the problem. The server calls it before Supabase sees either. */
export function checkPersonPassword(password: string, again: string): DomainError | null {
  if (password.length < PERSON_PASSWORD_MIN) return domainError("invalid", PASSWORD_TOO_SHORT, { password: PASSWORD_TOO_SHORT });
  if (password.length > PERSON_PASSWORD_MAX) return domainError("invalid", PASSWORD_TOO_LONG, { password: PASSWORD_TOO_LONG });
  if (password !== again) return domainError("invalid", PASSWORDS_DIFFER, { passwordAgain: PASSWORDS_DIFFER });
  return null;
}

export type InvitationStatus = "pending" | "expired" | "accepted" | "revoked";

/** Where an invitation stands at `now`. */
export function invitationStatus(i: Pick<Invitation, "accepted_at" | "revoked_at" | "expires_at">, now: string): InvitationStatus {
  if (i.revoked_at !== null) return "revoked";
  if (i.accepted_at !== null) return "accepted";
  return Date.parse(i.expires_at) <= Date.parse(now) ? "expired" : "pending";
}

/** Whether a reset link works at `now`. */
export const resetLive = (r: Pick<PasswordReset, "used_at" | "revoked_at" | "expires_at">, now: string): boolean =>
  r.used_at === null && r.revoked_at === null && Date.parse(r.expires_at) > Date.parse(now);

/** The invitations "Pending invitations" lists (D6): neither accepted nor revoked, expired ones included. */
export const listedInvitations = (all: readonly Invitation[]): Invitation[] => all.filter((i) => i.accepted_at === null && i.revoked_at === null);

// ---- inviting ----

const createInput = z.object({ workspaceId: uuidSchema, email: emailSchema, role: z.enum(INVITATION_ROLES), tokenHash: tokenHashSchema }).strict();
export type CreateInvitationInput = z.input<typeof createInput>;

export interface CreateInvitationState {
  access: WorkspaceAccess;
  /** The account with the typed e-mail address, if any. */
  account: AppUser | null;
  /** The workspace's members. */
  members: readonly WorkspaceMember[];
  /** The workspace's invitations (any state). */
  invitations: readonly Invitation[];
}

export interface MadeInvitation {
  invitationId: Uuid;
  email: string;
  role: InvitationRole;
  expiresAt: string;
}

/** "Create invitation link" (P1.2, P2.1, P2.2): a pending invitation for 7 days. */
export function createInvitation(ctx: CommandContext, state: CreateInvitationState, input: unknown): CommandResult<MadeInvitation> {
  const { access, account, members, invitations } = state;
  const denied = checkPermission(access, "people.edit");
  if (denied) return fail(denied);
  const parsed = parseInput(createInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const p = parsed.data;
  if (p.workspaceId !== access.workspace.id) return fail(notFound("workspace"));
  if (account && account.email !== p.email) return fail(notFound("person"));
  const member = account !== null && members.some((m) => m.workspace_id === access.workspace.id && m.user_id === account.id);
  const invited = listedInvitations(invitations).some((i) => i.workspace_id === access.workspace.id && i.email === p.email);
  if (member || invited) {
    const message = ALREADY_INVITED(p.email);
    return fail(domainError("conflict", message, { email: message }));
  }
  const row: Invitation = {
    id: ctx.newId(),
    workspace_id: access.workspace.id,
    email: p.email,
    role: p.role,
    token_hash: p.tokenHash,
    invited_by: ctx.actorId,
    created_at: ctx.now,
    expires_at: invitationExpiry(ctx.now),
    accepted_at: null,
    revoked_at: null,
  };
  return {
    ok: true,
    value: { invitationId: row.id, email: row.email, role: row.role, expiresAt: row.expires_at },
    writeSet: buildWriteSet(ctx, access.workspace.id, [{ kind: "insert", table: "invitation", row }]),
  };
}

const renewInput = z.object({ workspaceId: uuidSchema, invitationId: uuidSchema, tokenHash: tokenHashSchema }).strict();
const revokeInput = z.object({ workspaceId: uuidSchema, invitationId: uuidSchema }).strict();

export interface InvitationState {
  access: WorkspaceAccess;
  invitation: Invitation | null;
}

/** The listed invitation the input names, or the refusal. */
function listedOne(state: InvitationState, workspaceId: Uuid, invitationId: Uuid): { ok: true; invitation: Invitation } | { ok: false; error: DomainError } {
  const denied = checkPermission(state.access, "people.edit");
  if (denied) return fail(denied);
  if (workspaceId !== state.access.workspace.id) return fail(notFound("workspace"));
  const i = state.invitation;
  if (!i || i.id !== invitationId || i.workspace_id !== state.access.workspace.id || i.accepted_at !== null || i.revoked_at !== null) {
    return fail(notFound("invitation"));
  }
  return { ok: true, invitation: i };
}

/** "New link" (P2.2): the same row with a new hash and 7 days again; the earlier link finds nothing. */
export function renewInvitation(ctx: CommandContext, state: InvitationState, input: unknown): CommandResult<MadeInvitation> {
  const parsed = parseInput(renewInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const found = listedOne(state, parsed.data.workspaceId, parsed.data.invitationId);
  if (!found.ok) return found;
  const before = found.invitation;
  const row: Invitation = { ...before, token_hash: parsed.data.tokenHash, expires_at: invitationExpiry(ctx.now) };
  return {
    ok: true,
    value: { invitationId: row.id, email: row.email, role: row.role, expiresAt: row.expires_at },
    writeSet: buildWriteSet(ctx, state.access.workspace.id, [{ kind: "update", table: "invitation", before, row }]),
  };
}

/** "Revoke" (P2.2): the link stops working and the row leaves the list. */
export function revokeInvitation(ctx: CommandContext, state: InvitationState, input: unknown): CommandResult<{ toast: string }> {
  const parsed = parseInput(revokeInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const found = listedOne(state, parsed.data.workspaceId, parsed.data.invitationId);
  if (!found.ok) return found;
  const before = found.invitation;
  return {
    ok: true,
    value: { toast: INVITATION_REVOKED(before.email) },
    writeSet: buildWriteSet(ctx, state.access.workspace.id, [{ kind: "update", table: "invitation", before, row: { ...before, revoked_at: ctx.now } }]),
  };
}

// ---- accepting ----

/** What an invitation link's page needs, read before anything is written. */
export interface AcceptState {
  /** The invitation the link's hash finds, if any. */
  invitation: Invitation | null;
  /** Its workspace (null when deleted). */
  workspace: Workspace | null;
  organization: Organization | null;
  inviter: AppUser | null;
  /** The person with the invitation's e-mail, if any. */
  account: AppUser | null;
  /** That person's row in the workspace's organization. */
  accountOrganizationMember: OrganizationMember | null;
  /** That person's live workspaces in the organization. */
  accountWorkspaceIds: readonly Uuid[];
}

/**
 * The page a link opens (PT3): `new` (name and password), `existing` (sign in and join), `account` (a person without an
 * Auth account sets a password, D5; locally such a person joins as `existing`), `archived` (F19) or `gone` (the one
 * message for an unknown, expired, used or revoked link).
 */
export type InvitationPage =
  | { kind: "gone" }
  | { kind: "archived"; workspace: string }
  | {
      kind: "new" | "existing" | "account";
      email: string;
      role: InvitationRole;
      roleLabel: string;
      workspaceId: Uuid;
      workspace: string;
      organization: string;
      inviter: string;
    };

/** Which page a link shows. `online`: Postgres, where `account` is told apart from `existing` by the Auth link. */
export function invitationPage(state: AcceptState, tokenHash: string, now: string, online: boolean): InvitationPage {
  const { invitation: i, workspace: w, organization: o } = state;
  if (!i || i.token_hash !== tokenHash || invitationStatus(i, now) !== "pending") return { kind: "gone" };
  if (!w || w.id !== i.workspace_id || w.deleted_at !== null || !o || o.id !== w.organization_id || o.deleted_at !== null) return { kind: "gone" };
  if (isArchived(w)) return { kind: "archived", workspace: w.name };
  const a = state.account;
  const kind = !a ? "new" : online && !a.auth_user_id ? "account" : "existing";
  return {
    kind,
    email: i.email,
    role: i.role,
    roleLabel: ROLE_LABEL[i.role],
    workspaceId: w.id,
    workspace: w.name,
    organization: o.name,
    inviter: state.inviter?.display_name ?? "Someone",
  };
}

const acceptInput = z
  .object({
    tokenHash: tokenHashSchema,
    /** A new person's name (the page's "Your name"); absent for an existing person. */
    name: newFormName("Enter your name.").optional(),
    /** The Supabase Auth account (Postgres): made for a new person, or the one signed in with; null locally. */
    authUserId: uuidSchema.nullable(),
  })
  .strict();
export type AcceptInvitationInput = z.input<typeof acceptInput>;

export interface Accepted {
  userId: Uuid;
  workspaceId: Uuid;
  organizationId: Uuid;
}

/**
 * Join (PT3): the person (new, or an existing one; one without an Auth account gets it linked, D5), their memberships
 * (`joinWrites`, PT8) and the invitation accepted, in one change group in the workspace. A new person's id is
 * `ctx.actorId`, so every change event is signed by the person who joins.
 */
export function acceptInvitation(ctx: CommandContext, state: AcceptState, input: unknown): CommandResult<Accepted> {
  const parsed = parseInput(acceptInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const p = parsed.data;
  const page = invitationPage(state, p.tokenHash, ctx.now, p.authUserId !== null);
  if (page.kind === "gone") return fail(domainError("not_found", INVITATION_GONE));
  if (page.kind === "archived") return fail(domainError("archived", ARCHIVED_JOIN(page.workspace)));
  const invitation = state.invitation!;
  const workspace = state.workspace!;
  const organization = state.organization!;
  const { account } = state;
  if (account && account.email !== invitation.email) return fail(notFound("person"));
  if (state.accountOrganizationMember && (!account || state.accountOrganizationMember.user_id !== account.id || state.accountOrganizationMember.organization_id !== organization.id)) {
    return fail(notFound("person"));
  }

  const writes: Write[] = [];
  let userId: Uuid;
  if (!account) {
    if (p.name === undefined) return fail(domainError("invalid", "Enter your name.", { name: "Enter your name." }));
    const user: AppUser = {
      id: ctx.actorId,
      email: invitation.email,
      display_name: p.name,
      created_at: ctx.now,
      last_seen_at: null,
      ...(p.authUserId ? { auth_user_id: p.authUserId } : {}),
    };
    writes.push({ kind: "insert", table: "app_user", row: user });
    userId = user.id;
  } else {
    userId = account.id;
    if (ctx.actorId !== account.id) return fail(domainError("forbidden", ACCOUNT_MISMATCH));
    if (state.accountWorkspaceIds.includes(workspace.id)) return fail(domainError("conflict", ALREADY_JOINED(workspace.name)));
    const linkedTo = account.auth_user_id ?? null;
    if (linkedTo !== null && p.authUserId !== linkedTo) return fail(domainError("forbidden", ACCOUNT_MISMATCH));
    // D5: a person without an Auth account gets the one made for them now
    if (linkedTo === null && p.authUserId !== null) writes.push({ kind: "update", table: "app_user", before: account, row: { ...account, auth_user_id: p.authUserId } });
  }
  writes.push(
    ...joinWrites(ctx, {
      organizationId: organization.id,
      workspaceId: workspace.id,
      userId,
      role: invitation.role,
      addedBy: invitation.invited_by,
      linked: state.accountOrganizationMember !== null || state.accountWorkspaceIds.length > 0,
    }),
    { kind: "update", table: "invitation", before: invitation, row: { ...invitation, accepted_at: ctx.now } },
  );
  return { ok: true, value: { userId, workspaceId: workspace.id, organizationId: organization.id }, writeSet: buildWriteSet(ctx, workspace.id, writes) };
}

// ---- password reset links ----

/** Everything the person can reach, for D1's rule. */
export interface ResetReach {
  /** Every workspace membership of the person (live workspaces), with its organization and the actor's role there. */
  workspaces: readonly { workspaceId: Uuid; organizationId: Uuid; personRole: WorkspaceRole; actorRole: WorkspaceRole | null }[];
  /** Every organization row of the person. */
  organizations: readonly OrganizationMember[];
}

export interface ResetLinkState {
  access: WorkspaceAccess;
  person: AppUser | null;
  /** The workspace's members. */
  members: readonly WorkspaceMember[];
  reach: ResetReach;
  /** The person's reset links (any state). */
  resets: readonly PasswordReset[];
}

/**
 * Why the actor may not make a reset link for the person, or null (P2.3, D1, Q8): not for oneself, a guest, or an Owner
 * when the actor is an Admin; and only when the actor already has power over everything the person can reach: no other
 * organization, not the organization's owner or admin, and in every workspace of the person the actor is Owner, or Admin
 * while the person is not Owner there. The page hides the button where this refuses; the server checks it again.
 */
export function resetRefusal(actorId: Uuid, access: WorkspaceAccess, person: AppUser, members: readonly WorkspaceMember[], reach: ResetReach): DomainError | null {
  const here = members.find((m) => m.workspace_id === access.workspace.id && m.user_id === person.id);
  if (!here) return notFound("person");
  if (person.id === actorId) return domainError("forbidden", RESET_FOR_SELF);
  const organizationId = access.workspace.organization_id;
  const own = reach.organizations.find((o) => o.organization_id === organizationId);
  if (!own) return domainError("forbidden", RESET_FOR_GUEST);
  if (here.role === "owner" && access.member?.role !== "owner") return domainError("forbidden", RESET_FOR_OWNER);
  const outOfReach = domainError("forbidden", RESET_OUT_OF_REACH(person.display_name));
  if (own.role !== "member") return outOfReach;
  if (reach.organizations.some((o) => o.organization_id !== organizationId)) return outOfReach;
  for (const w of reach.workspaces) {
    if (w.organizationId !== organizationId) return outOfReach;
    if (w.actorRole === "owner") continue;
    if (w.actorRole === "admin" && w.personRole !== "owner") continue;
    return outOfReach;
  }
  return null;
}

const resetInput = z.object({ workspaceId: uuidSchema, userId: uuidSchema, tokenHash: tokenHashSchema }).strict();

export interface MadeReset {
  resetId: Uuid;
  name: string;
  email: string;
  expiresAt: string;
}

/** "Password reset link" (P2.3): a live link for 24 hours; the person's earlier live links are revoked. */
export function createPasswordReset(ctx: CommandContext, state: ResetLinkState, input: unknown): CommandResult<MadeReset> {
  const denied = checkPermission(state.access, "people.edit");
  if (denied) return fail(denied);
  const parsed = parseInput(resetInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const p = parsed.data;
  if (p.workspaceId !== state.access.workspace.id) return fail(notFound("workspace"));
  const person = state.person;
  if (!person || person.id !== p.userId) return fail(notFound("person"));
  const refused = resetRefusal(ctx.actorId, state.access, person, state.members, state.reach);
  if (refused) return fail(refused);
  const writes: Write[] = state.resets
    .filter((r) => r.app_user_id === person.id && resetLive(r, ctx.now))
    .map((before) => ({ kind: "update", table: "password_reset", before, row: { ...before, revoked_at: ctx.now } }) as Write);
  const row: PasswordReset = {
    id: ctx.newId(),
    workspace_id: state.access.workspace.id,
    app_user_id: person.id,
    token_hash: p.tokenHash,
    created_by: ctx.actorId,
    created_at: ctx.now,
    expires_at: resetExpiry(ctx.now),
    used_at: null,
    revoked_at: null,
  };
  writes.push({ kind: "insert", table: "password_reset", row });
  return {
    ok: true,
    value: { resetId: row.id, name: person.display_name, email: person.email, expiresAt: row.expires_at },
    writeSet: buildWriteSet(ctx, state.access.workspace.id, writes),
  };
}

export interface RedeemResetState {
  reset: PasswordReset | null;
  person: AppUser | null;
}

/** What a reset link's page shows: the person's e-mail, or the one refusal. */
export function resetPage(state: RedeemResetState, tokenHash: string, now: string): { kind: "gone" } | { kind: "set"; email: string } {
  const { reset: r, person } = state;
  if (!r || r.token_hash !== tokenHash || !resetLive(r, now) || !person || person.id !== r.app_user_id) return { kind: "gone" };
  return { kind: "set", email: person.email };
}

const useInput = z.object({ tokenHash: tokenHashSchema, authUserId: uuidSchema.nullable() }).strict();

/**
 * "Set password" (PT5): the link used; a person without an Auth account gets the one made for them (D5). The password
 * itself is Supabase's; this writes only the link's state (and the account's link), signed by the person.
 */
export function redeemPasswordReset(ctx: CommandContext, state: RedeemResetState, input: unknown): CommandResult<{ userId: Uuid }> {
  const parsed = parseInput(useInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const p = parsed.data;
  if (resetPage(state, p.tokenHash, ctx.now).kind === "gone") return fail(domainError("not_found", RESET_GONE));
  const reset = state.reset!;
  const person = state.person!;
  if (ctx.actorId !== person.id) return fail(domainError("forbidden", ACCOUNT_MISMATCH));
  const linkedTo = person.auth_user_id ?? null;
  if (linkedTo !== null && p.authUserId !== null && linkedTo !== p.authUserId) return fail(domainError("forbidden", ACCOUNT_MISMATCH));
  const writes: Write[] = [{ kind: "update", table: "password_reset", before: reset, row: { ...reset, used_at: ctx.now } }];
  if (linkedTo === null && p.authUserId !== null) writes.push({ kind: "update", table: "app_user", before: person, row: { ...person, auth_user_id: p.authUserId } });
  return { ok: true, value: { userId: person.id }, writeSet: buildWriteSet(ctx, reset.workspace_id, writes) };
}
