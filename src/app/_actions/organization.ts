"use server";

// Organizations (slice 8, items 6–9, 13). The typed passwords are checked by the domain, hashed here through the
// password adapter (F19) and never logged; the hash goes to the command and never back to the browser. The pages and
// dialogs that call these come in steps 4 and 5.

import { revalidatePath } from "next/cache";
import { scryptHasher } from "@/data/password";
import {
  changeOrganizationPassword,
  checkCreateOrganizationForm,
  checkNewOrganizationForm,
  checkNewPassword,
  createOrganization,
  createOrganizationForUser,
  normalizeEmail,
  ORGANIZATION_CREATED,
  PASSWORD_CHANGED,
} from "@/domain/commands/organization";
import type { DomainError } from "@/domain/errors";
import { uuidv7 } from "@/domain/ids";
import { getDataStore } from "@/data";
import { isDevSignInEnabled } from "../_lib/dev-session";
import { workspaceHref } from "../_lib/paths";
import { runCommand, runCommandAs, type ActionResult } from "../_lib/run-command";
import { getSession, writeSession } from "../_lib/session";

export interface CreateOrganizationFormInput {
  organizationName: string;
  name: string;
  email: string;
  workspaceName: string;
  password: string;
  passwordAgain: string;
}

export interface NewOrganizationFormInput {
  organizationName: string;
  workspaceName: string;
  password: string;
  passwordAgain: string;
}

const refused = (error: DomainError): { ok: false; code: DomainError["code"]; message: string; fields?: Record<string, string> } => ({
  ok: false,
  code: error.code,
  message: error.message,
  ...(error.fields ? { fields: error.fields } : {}),
});

const emailOf = (input: unknown) => (input && typeof input === "object" && typeof (input as { email?: unknown }).email === "string" ? normalizeEmail((input as { email: string }).email) : "");

/** The start page's form: its checks and the summary (items 6, 7). Writes nothing. */
export async function previewCreateOrganizationAction(input: CreateOrganizationFormInput): Promise<ActionResult<{ summary: string }>> {
  if (!isDevSignInEnabled()) return { ok: false, code: "not_found", message: "Not found." };
  const accountWithEmail = emailOf(input) ? await getDataStore().users.getByEmail(emailOf(input)) : null;
  const r = checkCreateOrganizationForm({ accountWithEmail }, input);
  return r.ok ? { ok: true, value: { summary: r.summary } } : refused(r.error);
}

/**
 * Creates an organization from the start page (item 8), without a session (F2): checks the form again, hashes the
 * password, writes everything in one change group, signs the new person in with the organization unlocked.
 */
export async function createOrganizationAction(input: CreateOrganizationFormInput): Promise<ActionResult<{ href: string; toast: string }>> {
  if (!isDevSignInEnabled()) return { ok: false, code: "not_found", message: "Not found." };
  const store = getDataStore();
  const accountWithEmail = emailOf(input) ? await store.users.getByEmail(emailOf(input)) : null;
  const checked = checkCreateOrganizationForm({ accountWithEmail }, input);
  if (!checked.ok) return refused(checked.error);
  const accessHash = await scryptHasher.hash(input.password);
  const { organizationName, name, email, workspaceName } = input;
  const result = await runCommandAs(uuidv7(), async (ctx) =>
    createOrganization(ctx, { accountWithEmail }, { organizationName, name, email, workspaceName, accessHash }),
  );
  if (!result.ok) return result;
  await writeSession(result.value.userId, [result.value.organizationId]);
  revalidatePath("/", "layout");
  return { ok: true, value: { href: workspaceHref(result.value.workspaceId), toast: ORGANIZATION_CREATED(input.organizationName.trim()) } };
}

/** "New organization…" in the organization menu: its checks and the summary (item 9). Writes nothing. */
export async function previewNewOrganizationAction(input: NewOrganizationFormInput): Promise<ActionResult<{ summary: string }>> {
  if (!(await getSession())) return { ok: false, code: "unauthenticated", message: "Your session has ended. Sign in again." };
  const r = checkNewOrganizationForm(input);
  return r.ok ? { ok: true, value: { summary: r.summary } } : refused(r.error);
}

/** Creates an organization for the signed-in person (item 9) and unlocks it in the session. */
export async function createOrganizationFromMenuAction(input: NewOrganizationFormInput): Promise<ActionResult<{ href: string; toast: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, code: "unauthenticated", message: "Your session has ended. Sign in again." };
  const checked = checkNewOrganizationForm(input);
  if (!checked.ok) return refused(checked.error);
  const accessHash = await scryptHasher.hash(input.password);
  const { organizationName, workspaceName } = input;
  const result = await runCommand(async (ctx, _store, user) => createOrganizationForUser(ctx, { user }, { organizationName, workspaceName, accessHash }));
  if (!result.ok) return result;
  await writeSession(session.user.id, [...session.unlocked, result.value.organizationId]);
  revalidatePath("/", "layout");
  return { ok: true, value: { href: workspaceHref(result.value.workspaceId), toast: ORGANIZATION_CREATED(input.organizationName.trim()) } };
}

/**
 * Changes the organization's password from a workspace's People tab (item 13). People who are signed in stay signed in
 * (a known limitation). `expectedVersion` is the access row's version the box read.
 */
export async function changeOrganizationPasswordAction(input: {
  workspaceId: string;
  password: string;
  passwordAgain: string;
  expectedVersion: number | null;
}): Promise<ActionResult<{ toast: string }>> {
  const weak = checkNewPassword(typeof input?.password === "string" ? input.password : "", typeof input?.passwordAgain === "string" ? input.passwordAgain : "");
  if (weak) return refused(weak);
  const accessHash = await scryptHasher.hash(input.password);
  const result = await runCommand(async (ctx, store, user) => {
    const workspace = typeof input.workspaceId === "string" ? await store.workspaces.get(input.workspaceId) : null;
    if (!workspace) return { ok: false, error: { code: "not_found", message: "This workspace does not exist." } };
    const organization = await store.organizations.get(workspace.organization_id);
    const r = changeOrganizationPassword(
      ctx,
      {
        access: { workspace, member: await store.workspaces.getMember(workspace.id, user.id) },
        organization,
        organizationMember: await store.organizations.getMember(workspace.organization_id, user.id),
        current: await store.organizations.getAccess(workspace.organization_id),
      },
      { workspaceId: workspace.id, organizationId: workspace.organization_id, accessHash, expectedVersion: input.expectedVersion },
    );
    return r.ok ? { ...r, value: { toast: PASSWORD_CHANGED(organization!.name) } } : r;
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
