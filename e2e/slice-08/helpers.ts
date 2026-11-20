// Slice 8's helpers: signing in with a password through the start page (`signInWithPassword`), and test data written as
// the server writes it, through the domain and the local adapter (`createOrganization`, `addPerson`, `changeRoleAs`;
// since slice 33 `addPerson` is `inviteAs` and `acceptAs`);
// step 5's People tab (`openPeople`, `personRow`).
import { createHash, randomBytes } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createLocalDataStore } from "../../src/data/local/store";
import { DEMO_PASSWORD, DEMO_PASSWORD_HASH } from "../../src/data/local/demo-password";
import { scryptHasher } from "../../src/data/password";
import { createOrganization as createOrganizationCommand, normalizeEmail } from "../../src/domain/commands/organization";
import { acceptInvitation, createInvitation } from "../../src/domain/commands/invitations";
import { changeRole as changeRoleCommand } from "../../src/domain/commands/people";
import { uuidv7 } from "../../src/domain/ids";
import type { WorkspaceRole } from "../../src/domain/types";
import { E2E_DB } from "../config";

export { DEMO_PASSWORD };
export { expectToast, SEED_IDS, signInAs, signOutViaMenu } from "../slice-00/helpers";

/**
 * Signs in through the start page's "Sign in" path: the e-mail, the organization when the person has several, the
 * password; waits for the workspace page.
 */
export async function signInWithPassword(page: Page, email: string, organization?: string, password: string = DEMO_PASSWORD) {
  await page.goto("/sign-in");
  const panel = page.getByTestId("panel-sign-in");
  await panel.getByTestId("input-sign-in-email").fill(email);
  await panel.getByTestId("button-sign-in-continue").click();
  const list = panel.getByTestId("list-sign-in-organizations");
  const field = panel.getByTestId("input-sign-in-password");
  await expect(list.or(field)).toBeVisible();
  if (await list.isVisible()) {
    if (!organization) throw new Error(`${email} has several organizations: name one`);
    await list.getByTestId("button-sign-in-organization").filter({ hasText: organization }).click();
  }
  await field.fill(password);
  await panel.getByTestId("button-sign-in").click();
  await expect(page.getByTestId("bar-top")).toBeVisible();
}

const store = () => createLocalDataStore(E2E_DB);

/**
 * Test data: an organization created as from the start page (item 8), with its owner, first workspace and password.
 * `demo-pass` uses the precomputed hash; any other password is hashed by the adapter.
 */
export async function createOrganization(o: { organization: string; name: string; email: string; password?: string; workspace?: string }) {
  const s = store();
  const password = o.password ?? DEMO_PASSWORD;
  const accessHash = password === DEMO_PASSWORD ? DEMO_PASSWORD_HASH : await scryptHasher.hash(password);
  const ctx = { actorId: uuidv7(), now: new Date().toISOString(), newId: () => uuidv7() };
  const input = { organizationName: o.organization, name: o.name, email: o.email, workspaceName: o.workspace ?? "First workspace", accessHash };
  const result = createOrganizationCommand(ctx, { accountWithEmail: await s.users.getByEmail(normalizeEmail(o.email)) }, input);
  if (!result.ok) throw new Error(result.error.message);
  const applied = await s.apply(result.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return result.value;
}

/** A link's token and its hash, as the server makes them (slice 33, `src/app/_lib/link-tokens.ts`). */
export function linkToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: createHash("sha256").update(token, "utf8").digest("hex") };
}

/**
 * Test data (slice 33): an invitation made as its owner or admin `byUserId` would; its link's token, which only the
 * link holds.
 */
export async function inviteAs(byUserId: string, workspaceId: string, email: string, role: Exclude<WorkspaceRole, "owner">) {
  const s = store();
  const workspace = await s.workspaces.get(workspaceId);
  if (!workspace) throw new Error(`no workspace ${workspaceId}`);
  const { token, tokenHash } = linkToken();
  const state = {
    access: { workspace, member: await s.workspaces.getMember(workspaceId, byUserId) },
    account: await s.users.getByEmail(normalizeEmail(email)),
    members: await s.workspaces.listMembers(workspaceId),
    invitations: await s.invitations.listOpen(workspaceId),
  };
  const result = createInvitation({ actorId: byUserId, now: new Date().toISOString(), newId: () => uuidv7() }, state, { workspaceId, email, role, tokenHash });
  if (!result.ok) throw new Error(result.error.message);
  const applied = await s.apply(result.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return { token, tokenHash, invitationId: result.value.invitationId };
}

/** Test data (slice 33): a link's invitation accepted as its Join does on the local adapter. Returns the person's id. */
export async function acceptAs(tokenHash: string, name: string) {
  const s = store();
  const invitation = await s.invitations.getByTokenHash(tokenHash);
  if (!invitation) throw new Error("no such invitation");
  const workspace = await s.workspaces.get(invitation.workspace_id);
  const organizationId = workspace!.organization_id;
  const account = await s.users.getByEmail(invitation.email);
  const state = {
    invitation,
    workspace,
    organization: await s.organizations.get(organizationId),
    inviter: await s.users.get(invitation.invited_by),
    account,
    accountOrganizationMember: account ? await s.organizations.getMember(organizationId, account.id) : null,
    accountWorkspaceIds: account ? (await s.workspaces.listForUser(account.id)).filter((w) => w.organization_id === organizationId).map((w) => w.id) : [],
  };
  const actorId = account?.id ?? uuidv7();
  const result = acceptInvitation({ actorId, now: new Date().toISOString(), newId: () => uuidv7() }, state, { tokenHash, ...(account ? {} : { name }), authUserId: null });
  if (!result.ok) throw new Error(result.error.message);
  const applied = await s.apply(result.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return result.value.userId;
}

/**
 * Test data: a person added to a workspace by its owner or admin `byUserId` (item 10; since slice 33 an invitation
 * made and accepted through the domain, as "Add person" was replaced). Returns their user id.
 */
export async function addPerson(byUserId: string, workspaceId: string, p: { name: string; email: string; role: Exclude<WorkspaceRole, "owner"> }) {
  const { tokenHash } = await inviteAs(byUserId, workspaceId, p.email, p.role);
  return acceptAs(tokenHash, p.name);
}

/** Test data: changes a person's role in a workspace as `byUserId` would (item 11). */
export async function changeRoleAs(byUserId: string, workspaceId: string, userId: string, role: WorkspaceRole) {
  const s = store();
  const workspace = await s.workspaces.get(workspaceId);
  if (!workspace) throw new Error(`no workspace ${workspaceId}`);
  const state = { access: { workspace, member: await s.workspaces.getMember(workspaceId, byUserId) }, person: await s.users.get(userId), members: await s.workspaces.listMembers(workspaceId) };
  const result = changeRoleCommand({ actorId: byUserId, now: new Date().toISOString(), newId: () => uuidv7() }, state, { workspaceId, userId, role });
  if (!result.ok) throw new Error(result.error.message);
  const applied = await s.apply(result.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
}

/** Opens a workspace's People tab. */
export async function openPeople(page: Page, workspaceId: string) {
  await page.goto(`/w/${workspaceId}?tab=people`);
  await expect(page.getByTestId("table-people")).toBeVisible();
}

/** A person's row on the People tab, by their name or e-mail. */
export const personRow = (page: Page, who: string) => page.getByTestId("row-person").filter({ hasText: who });

/**
 * Slice 33: "Invite person" on the open People tab: the e-mail, the role (Modeler when not given), "Create invitation
 * link"; the link the dialog shows, with the dialog left open (`closeLinkDialog`).
 */
export async function inviteInBox(page: Page, email: string, role?: Exclude<WorkspaceRole, "owner">): Promise<string> {
  const box = page.getByTestId("box-invite-person");
  await box.getByTestId("input-invite-email").fill(email);
  if (role) await box.getByTestId("select-invite-role").selectOption(role);
  await box.getByTestId("button-create-invitation").click();
  const dialog = page.getByTestId("dialog-link");
  await expect(dialog).toBeVisible();
  return dialog.getByTestId("text-link").innerText();
}

/** Slice 33: the link dialog's Done. */
export async function closeLinkDialog(page: Page) {
  await page.getByTestId("dialog-link").getByTestId("button-link-done").click();
  await expect(page.getByTestId("dialog-link")).toHaveCount(0);
}

/** Slice 33: an invitation link opened and joined locally (D3: a new person's name, nothing for an account); lands signed in. */
export async function joinByLink(page: Page, link: string, name?: string) {
  await page.goto(link);
  await expect(page.getByTestId("form-join")).toBeVisible();
  if (name !== undefined) await page.getByTestId("input-join-name").fill(name);
  await page.getByTestId("button-join").click();
  await expect(page.getByTestId("bar-top")).toBeVisible();
}
