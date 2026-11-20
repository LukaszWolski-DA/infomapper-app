import "server-only";
// What the invitation and reset commands read (slice 33), shared by the People tab, its actions and the two link pages.

import type { DataStore } from "@/data";
import type { AcceptState, RedeemResetState, ResetReach } from "@/domain/commands/invitations";
import type { Uuid } from "@/domain/ids";

/** A link's invitation and everything its page and Join read. */
export async function acceptStateFor(store: DataStore, tokenHash: string): Promise<AcceptState> {
  const invitation = await store.invitations.getByTokenHash(tokenHash);
  const workspace = invitation ? await store.workspaces.get(invitation.workspace_id) : null;
  const organizationId = workspace?.organization_id ?? null;
  const found = invitation ? await store.users.getByEmail(invitation.email) : null;
  // the Auth link (D5): Postgres never hands it on with the row; read for the page and the command only
  const authUserId = found ? await store.users.getAuthUserId(found.id) : null;
  const account = found && authUserId ? { ...found, auth_user_id: authUserId } : found;
  return {
    invitation,
    workspace,
    organization: organizationId ? await store.organizations.get(organizationId) : null,
    inviter: invitation ? await store.users.get(invitation.invited_by) : null,
    account,
    accountOrganizationMember: account && organizationId ? await store.organizations.getMember(organizationId, account.id) : null,
    accountWorkspaceIds: account && organizationId ? (await store.workspaces.listForUser(account.id)).filter((w) => w.organization_id === organizationId).map((w) => w.id) : [],
  };
}

/** A reset link's row and its person. */
export async function resetStateFor(store: DataStore, tokenHash: string): Promise<RedeemResetState> {
  const reset = await store.passwordResets.getByTokenHash(tokenHash);
  return { reset, person: reset ? await store.users.get(reset.app_user_id) : null };
}

/** Everything the person can reach, with the actor's role in each of the person's workspaces (D1). */
export async function resetReachOf(store: DataStore, personId: Uuid, actorId: Uuid): Promise<ResetReach> {
  const workspaces = await store.workspaces.listForUser(personId);
  return {
    workspaces: await Promise.all(
      workspaces.map(async (w) => ({
        workspaceId: w.id,
        organizationId: w.organization_id,
        personRole: (await store.workspaces.getMember(w.id, personId))?.role ?? "reader",
        actorRole: (await store.workspaces.getMember(w.id, actorId))?.role ?? null,
      })),
    ),
    organizations: await store.organizations.listMembershipsOfUsers([personId]),
  };
}
