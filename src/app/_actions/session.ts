"use server";

// Signing in and out (slice 0; slice 8, P2–P4). The session is a signed cookie with the organizations unlocked in it
// (`writeSession`, F1). The development list signs in as a test user and unlocks every organization that user reaches;
// a password signs in to, or unlocks, one organization. The pages that use these come in step 4.

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDataStore, type DataStore } from "@/data";
import { scryptHasher } from "@/data/password";
import { normalizeEmail } from "@/domain/commands/organization";
import { isUuid, type Uuid } from "@/domain/ids";
import { safeReturnPath } from "@/domain/return-path";
import { isDevSignInEnabled } from "../_lib/dev-session";
import { workspaceHref } from "../_lib/paths";
import { LAST_WORKSPACE_COOKIE } from "../_lib/preferences";
import type { ActionResult } from "../_lib/run-command";
import { getSession, writeSession } from "../_lib/session";
import { DEV_SESSION_COOKIE } from "../_lib/dev-session";

const UNKNOWN_EMAIL_MESSAGE = "No organization uses this e-mail address.";
const wrongPassword = (organization: string) => `That password does not open ${organization}.`;

/** Development sign-in: signs in as the chosen test user, with every organization they reach unlocked (item 4). */
export async function signInAsDevUser(formData: FormData): Promise<void> {
  if (!isDevSignInEnabled()) notFound();
  const userId = formData.get("userId");
  const store = getDataStore();
  if (!isUuid(userId) || !(await store.users.get(userId))) redirect("/sign-in");
  const organizations = await store.organizations.listForUser(userId);
  await writeSession(userId, organizations.map((o) => o.id));
  redirect("/");
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(DEV_SESSION_COOKIE);
  redirect("/sign-in");
}

/** A person's live workspaces per organization: "belongs" = has a workspace there (P7 as answered, F8). */
async function workspacesByOrganization(store: DataStore, userId: Uuid): Promise<Map<Uuid, Uuid[]>> {
  const byOrg = new Map<Uuid, Uuid[]>();
  for (const w of await store.workspaces.listForUser(userId)) byOrg.set(w.organization_id, [...(byOrg.get(w.organization_id) ?? []), w.id]);
  return byOrg;
}

export interface SignInOrganization {
  id: Uuid;
  name: string;
  workspaceCount: number;
  /** A guest organization: the list says "guest" instead of the count (F21). */
  guest: boolean;
}

/**
 * The sign-in's second step (item 2): the organizations the e-mail address belongs to. A list of all organizations is
 * never shown; that an e-mail address reveals its organizations is a known limitation (P3).
 */
export async function organizationsForEmailAction(email: unknown): Promise<ActionResult<SignInOrganization[]>> {
  if (!isDevSignInEnabled()) return { ok: false, code: "not_found", message: "Not found." };
  if (typeof email !== "string" || !normalizeEmail(email)) return { ok: false, code: "invalid", message: "Enter an e-mail address." };
  const store = getDataStore();
  const user = await store.users.getByEmail(normalizeEmail(email));
  const byOrg = user ? await workspacesByOrganization(store, user.id) : new Map<Uuid, Uuid[]>();
  if (!user || byOrg.size === 0) return { ok: false, code: "not_found", message: UNKNOWN_EMAIL_MESSAGE };
  const memberships = await store.organizations.listMembershipsOfUsers([user.id]);
  const organizations: SignInOrganization[] = [];
  for (const [organizationId, workspaceIds] of byOrg) {
    const organization = await store.organizations.get(organizationId);
    if (!organization) continue;
    const guest = !memberships.some((m) => m.organization_id === organizationId);
    organizations.push({ id: organization.id, name: organization.name, workspaceCount: workspaceIds.length, guest });
  }
  return { ok: true, value: organizations };
}

/**
 * Signs in to an organization with its password, or unlocks it in the current session (items 2–5). The e-mail address
 * must belong to the organization (it has a workspace there). Lands on `next` when it is a page of that organization's
 * workspaces (F14), else on the last used workspace when it lies there, else the first (AD-07, F13).
 */
export async function signInWithPasswordAction(input: {
  email: string;
  organizationId: string;
  password: string;
  next?: string | null;
}): Promise<ActionResult<{ href: string }>> {
  if (!isDevSignInEnabled()) return { ok: false, code: "not_found", message: "Not found." };
  const store = getDataStore();
  const email = typeof input?.email === "string" ? normalizeEmail(input.email) : "";
  if (!email) return { ok: false, code: "invalid", message: "Enter an e-mail address.", fields: { email: "Enter an e-mail address." } };
  const user = await store.users.getByEmail(email);
  const organization = isUuid(input.organizationId) ? await store.organizations.get(input.organizationId) : null;
  const workspaceIds = user && organization ? ((await workspacesByOrganization(store, user.id)).get(organization.id) ?? []) : [];
  if (!user || !organization || workspaceIds.length === 0) {
    return { ok: false, code: "not_found", message: UNKNOWN_EMAIL_MESSAGE, fields: { email: UNKNOWN_EMAIL_MESSAGE } };
  }
  const access = await store.organizations.getAccess(organization.id);
  const password = typeof input.password === "string" ? input.password : "";
  if (!access || !(await scryptHasher.verify(password, access.access_hash))) {
    const message = wrongPassword(organization.name);
    return { ok: false, code: "forbidden", message, fields: { password: message } };
  }
  const current = await getSession();
  const unlocked = current?.user.id === user.id ? [...current.unlocked, organization.id] : [organization.id];
  await writeSession(user.id, unlocked);

  const inOrganization = new Set(workspaceIds);
  const back = safeReturnPath(input.next, inOrganization);
  if (back) return { ok: true, value: { href: back } };
  const last = (await cookies()).get(LAST_WORKSPACE_COOKIE)?.value;
  return { ok: true, value: { href: workspaceHref(last && inOrganization.has(last) ? last : workspaceIds[0]!) } };
}
