"use server";

// People on a workspace's People tab (slice 8, items 11–12; slice 33: invitations and reset links instead of "Add
// person"). Each runs a domain command through runCommand(), so the server refuses whatever the role, the archive or the
// lock does not allow, whatever the page showed. None is an undo step. The People tab's controls are in
// `w/[workspaceId]/_components/people.tsx`. A link's token is made here, answered once and never logged or stored
// (`link-tokens.ts`); the domain gets its hash.

import { revalidatePath } from "next/cache";
import type { DataStore } from "@/data";
import { getDataStore, isPostgresMode } from "@/data";
import { checkPersonPassword, createInvitation, createPasswordReset, renewInvitation, revokeInvitation } from "@/domain/commands/invitations";
import { normalizeEmail } from "@/domain/commands/organization";
import { changeRole, checkRemovePerson, removePerson, ROLE_LABEL, type RemovePersonPreview, type RemovePersonState } from "@/domain/commands/people";
import { notFound as notFoundError } from "@/domain/errors";
import type { Uuid } from "@/domain/ids";
import type { InvitationRole } from "@/domain/types";
import { linkFor, newLinkToken } from "../_lib/link-tokens";
import { CURRENT_PASSWORD_WRONG, ENTER_CURRENT_PASSWORD, NOTHING_CHANGED, PASSWORD_CHANGED, PASSWORD_REFUSED_BY_SERVER } from "../_lib/password-texts";
import { resetReachOf } from "../_lib/people-links";
import { runCommand, type ActionResult } from "../_lib/run-command";
import { getSession } from "../_lib/session";
import { supabaseServer } from "../_lib/supabase";
import { invitationsReady, NOT_SET_UP, NOT_SET_UP_REFUSAL, passwordSignsIn, setAccountPassword } from "../_lib/supabase-admin";
import { lockedRefusal } from "../_lib/unlock";

const str = (v: unknown) => (typeof v === "string" ? v : "");

async function accessOf(store: DataStore, workspaceId: unknown, userId: Uuid) {
  const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
  return workspace ? { workspace, member: await store.workspaces.getMember(workspace.id, userId) } : null;
}

async function removeState(store: DataStore, workspaceId: unknown, actorId: Uuid, personId: unknown): Promise<RemovePersonState | null> {
  const access = await accessOf(store, workspaceId, actorId);
  if (!access) return null;
  const organizationId = access.workspace.organization_id;
  const person = typeof personId === "string" ? await store.users.get(personId) : null;
  return {
    access,
    person,
    members: await store.workspaces.listMembers(access.workspace.id),
    organization: await store.organizations.get(organizationId),
    personOrganizationMember: person ? await store.organizations.getMember(organizationId, person.id) : null,
    personOtherWorkspaceIds: person
      ? (await store.workspaces.listForUser(person.id)).filter((w) => w.organization_id === organizationId && w.id !== access.workspace.id).map((w) => w.id)
      : [],
  };
}

const NOT_FOUND = { ok: false as const, error: notFoundError("workspace") };
const NOT_READY = { ok: false as const, code: "forbidden" as const, message: NOT_SET_UP_REFUSAL };
const ONLINE_ONLY = { ok: false as const, code: "not_found" as const, message: "Not found." };

function done<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** A read before a write: the session, the workspace and its organization unlocked (F3). */
async function readAs<T>(workspaceId: unknown, read: (store: DataStore, userId: Uuid) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  const session = await getSession();
  if (!session) return { ok: false, code: "unauthenticated", message: "Your session has ended. Sign in again." };
  const store = getDataStore();
  const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
  if (!workspace) return { ok: false, code: "not_found", message: NOT_FOUND.error.message };
  const locked = await lockedRefusal(store, session.unlocked, workspace.organization_id);
  if (locked) return locked;
  return read(store, session.user.id);
}

export async function changeRoleAction(input: { workspaceId: string; userId: string; role: string }): Promise<ActionResult<{ toast: string }>> {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await accessOf(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const person = typeof input.userId === "string" ? await store.users.get(input.userId) : null;
      return changeRole(ctx, { access, person, members: await store.workspaces.listMembers(access.workspace.id) }, input);
    }),
  );
}

/** Remove: the confirmation's lines (item 12, P7). Writes nothing. */
export async function previewRemovePersonAction(input: { workspaceId: string; userId: string }): Promise<ActionResult<RemovePersonPreview>> {
  return readAs(input?.workspaceId, async (store, userId) => {
    const state = await removeState(store, input.workspaceId, userId, input.userId);
    if (!state) return { ok: false, code: "not_found", message: NOT_FOUND.error.message };
    const r = checkRemovePerson({ actorId: userId }, state, input);
    return r.ok ? r : { ok: false, code: r.error.code, message: r.error.message };
  });
}

export async function removePersonAction(input: { workspaceId: string; userId: string }): Promise<ActionResult<{ toast: string }>> {
  return done(
    await runCommand(async (ctx, store, user) => {
      const state = await removeState(store, input?.workspaceId, user.id, input?.userId);
      if (!state) return NOT_FOUND;
      const r = removePerson(ctx, state, input);
      return r.ok ? { ...r, value: { toast: r.value.toast } } : r;
    }),
  );
}

// ---- invitations (slice 33, AD-40) ----

export interface InvitationLink {
  link: string;
  email: string;
  role: InvitationRole;
  roleLabel: string;
  workspace: string;
}

/** "Create invitation link": a pending invitation for 7 days and its link, shown once. */
export async function createInvitationAction(input: { workspaceId: string; email: string; role: string }): Promise<ActionResult<InvitationLink>> {
  if (!invitationsReady()) return NOT_READY;
  const { token, tokenHash } = newLinkToken();
  const r = done(
    await runCommand(async (ctx, store, user) => {
      const access = await accessOf(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const state = {
        access,
        account: await store.users.getByEmail(normalizeEmail(str(input?.email))),
        members: await store.workspaces.listMembers(access.workspace.id),
        invitations: await store.invitations.listOpen(access.workspace.id),
      };
      const made = createInvitation(ctx, state, { workspaceId: input?.workspaceId, email: str(input?.email), role: str(input?.role), tokenHash });
      return made.ok ? { ...made, value: { ...made.value, workspace: access.workspace.name } } : made;
    }),
  );
  if (!r.ok) return r;
  const v = r.value;
  return { ok: true, value: { link: await linkFor("invite", token), email: v.email, role: v.role, roleLabel: ROLE_LABEL[v.role], workspace: v.workspace } };
}

/** "New link": the same invitation with a new link and 7 days again; the earlier link stops working. */
export async function renewInvitationAction(input: { workspaceId: string; invitationId: string }): Promise<ActionResult<InvitationLink>> {
  if (!invitationsReady()) return NOT_READY;
  const { token, tokenHash } = newLinkToken();
  const r = done(
    await runCommand(async (ctx, store, user) => {
      const access = await accessOf(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const invitation = typeof input?.invitationId === "string" ? await store.invitations.get(access.workspace.id, input.invitationId) : null;
      const made = renewInvitation(ctx, { access, invitation }, { workspaceId: input?.workspaceId, invitationId: input?.invitationId, tokenHash });
      return made.ok ? { ...made, value: { ...made.value, workspace: access.workspace.name } } : made;
    }),
  );
  if (!r.ok) return r;
  const v = r.value;
  return { ok: true, value: { link: await linkFor("invite", token), email: v.email, role: v.role, roleLabel: ROLE_LABEL[v.role], workspace: v.workspace } };
}

/** "Revoke": the link stops working and the row leaves the list. */
export async function revokeInvitationAction(input: { workspaceId: string; invitationId: string }): Promise<ActionResult<{ toast: string }>> {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await accessOf(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const invitation = typeof input?.invitationId === "string" ? await store.invitations.get(access.workspace.id, input.invitationId) : null;
      return revokeInvitation(ctx, { access, invitation }, input);
    }),
  );
}

// ---- passwords (slice 33, online only: P2.3, D1, D4) ----

/** "Password reset link" (D1): a one-time link for 24 hours, shown once; the person's earlier link stops working. */
export async function createResetLinkAction(input: { workspaceId: string; userId: string }): Promise<ActionResult<{ link: string; name: string }>> {
  if (!isPostgresMode()) return ONLINE_ONLY;
  if (!invitationsReady()) return NOT_READY;
  const { token, tokenHash } = newLinkToken();
  const r = done(
    await runCommand(async (ctx, store, user) => {
      const access = await accessOf(store, input?.workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const person = typeof input?.userId === "string" ? await store.users.get(input.userId) : null;
      return createPasswordReset(
        ctx,
        {
          access,
          person,
          members: await store.workspaces.listMembers(access.workspace.id),
          reach: person ? await resetReachOf(store, person.id, user.id) : { workspaces: [], organizations: [] },
          resets: person ? await store.passwordResets.listOfUser(person.id) : [],
        },
        { workspaceId: input?.workspaceId, userId: input?.userId, tokenHash },
      );
    }),
  );
  if (!r.ok) return r;
  return { ok: true, value: { link: await linkFor("reset", token), name: r.value.name } };
}

/**
 * "Change password…" (PT4, Q7, D4): the current password checked on a client of its own, the new one set with the
 * secret key; the person stays signed in here and elsewhere (D4, as D-58's organization password). Writes no row.
 */
export async function changePasswordAction(input: { current: string; password: string; passwordAgain: string }): Promise<ActionResult<{ toast: string }>> {
  if (!isPostgresMode()) return ONLINE_ONLY;
  if (!invitationsReady()) return { ok: false, code: "forbidden", message: NOT_SET_UP };
  const session = await getSession();
  if (!session) return { ok: false, code: "unauthenticated", message: "Your session has ended. Sign in again." };
  const current = str(input?.current);
  if (!current) return { ok: false, code: "invalid", message: ENTER_CURRENT_PASSWORD, fields: { current: ENTER_CURRENT_PASSWORD } };
  const weak = checkPersonPassword(str(input?.password), str(input?.passwordAgain));
  if (weak) return { ok: false, code: "invalid", message: weak.message, ...(weak.fields ? { fields: weak.fields } : {}) };
  const { data } = await (await supabaseServer()).auth.getClaims();
  const accountId = data?.claims.sub;
  if (!accountId || (await passwordSignsIn(session.user.email, current)) !== accountId) {
    return { ok: false, code: "forbidden", message: CURRENT_PASSWORD_WRONG, fields: { current: CURRENT_PASSWORD_WRONG } };
  }
  const set = await setAccountPassword(accountId, str(input?.password));
  if (!set.ok) {
    if (set.reason === "weak") return { ok: false, code: "invalid", message: PASSWORD_REFUSED_BY_SERVER, fields: { password: PASSWORD_REFUSED_BY_SERVER } };
    return { ok: false, code: "unexpected", message: NOTHING_CHANGED };
  }
  return { ok: true, value: { toast: PASSWORD_CHANGED } };
}
