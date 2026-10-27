// Slice 8's helpers: signing in with a password through the start page (`signInWithPassword`), and test data written as
// the server writes it, through the domain and the local adapter (`createOrganization`, `addPerson`).
import { expect, type Page } from "@playwright/test";
import { createLocalDataStore } from "../../src/data/local/store";
import { DEMO_PASSWORD, DEMO_PASSWORD_HASH } from "../../src/data/local/demo-password";
import { scryptHasher } from "../../src/data/password";
import { createOrganization as createOrganizationCommand, normalizeEmail } from "../../src/domain/commands/organization";
import { addPerson as addPersonCommand } from "../../src/domain/commands/people";
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

/** Test data: adds a person to a workspace as its owner or admin `byUserId` would (item 10). Returns their user id. */
export async function addPerson(byUserId: string, workspaceId: string, p: { name: string; email: string; role: Exclude<WorkspaceRole, "owner"> }) {
  const s = store();
  const workspace = await s.workspaces.get(workspaceId);
  if (!workspace) throw new Error(`no workspace ${workspaceId}`);
  const account = await s.users.getByEmail(normalizeEmail(p.email));
  const state = {
    access: { workspace, member: await s.workspaces.getMember(workspaceId, byUserId) },
    organization: await s.organizations.get(workspace.organization_id),
    account,
    accountOrganizationMember: account ? await s.organizations.getMember(workspace.organization_id, account.id) : null,
    accountWorkspaceIds: account ? (await s.workspaces.listForUser(account.id)).filter((w) => w.organization_id === workspace.organization_id).map((w) => w.id) : [],
  };
  const ctx = { actorId: byUserId, now: new Date().toISOString(), newId: () => uuidv7() };
  const result = addPersonCommand(ctx, state, { workspaceId, ...p });
  if (!result.ok) throw new Error(result.error.message);
  const applied = await s.apply(result.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return result.value.userId;
}
