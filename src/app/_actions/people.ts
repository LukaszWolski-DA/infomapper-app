"use server";

// People on a workspace's People tab (slice 8, items 10–12). Each runs a domain command through runCommand(), so the
// server refuses whatever the role, the archive or the lock does not allow, whatever the page showed. None is an undo
// step. The People tab's controls are in `w/[workspaceId]/_components/people.tsx`.

import { revalidatePath } from "next/cache";
import type { DataStore } from "@/data";
import { getDataStore } from "@/data";
import {
  addPerson,
  changeRole,
  checkAddPerson,
  checkRemovePerson,
  removePerson,
  type AddPersonPreview,
  type AddPersonState,
  type RemovePersonPreview,
  type RemovePersonState,
} from "@/domain/commands/people";
import { normalizeEmail } from "@/domain/commands/organization";
import { notFound as notFoundError } from "@/domain/errors";
import type { Uuid } from "@/domain/ids";
import { runCommand, type ActionResult } from "../_lib/run-command";
import { getSession } from "../_lib/session";
import { lockedRefusal } from "../_lib/unlock";

const str = (v: unknown) => (typeof v === "string" ? v : "");

async function accessOf(store: DataStore, workspaceId: unknown, userId: Uuid) {
  const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
  return workspace ? { workspace, member: await store.workspaces.getMember(workspace.id, userId) } : null;
}

async function addState(store: DataStore, workspaceId: unknown, userId: Uuid, email: unknown): Promise<AddPersonState | null> {
  const access = await accessOf(store, workspaceId, userId);
  if (!access) return null;
  const organizationId = access.workspace.organization_id;
  const account = await store.users.getByEmail(normalizeEmail(str(email)));
  const accountWorkspaceIds = account
    ? (await store.workspaces.listForUser(account.id)).filter((w) => w.organization_id === organizationId).map((w) => w.id)
    : [];
  return {
    access,
    organization: await store.organizations.get(organizationId),
    account,
    accountOrganizationMember: account ? await store.organizations.getMember(organizationId, account.id) : null,
    accountWorkspaceIds,
  };
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

export interface AddPersonFormInput {
  workspaceId: string;
  name: string;
  email: string;
  role: string;
}

/** "Add a person": the form's checks and the summary (item 10, F11). Writes nothing. */
export async function previewAddPersonAction(input: AddPersonFormInput): Promise<ActionResult<AddPersonPreview>> {
  return readAs(input?.workspaceId, async (store, userId) => {
    const state = await addState(store, input.workspaceId, userId, input.email);
    if (!state) return { ok: false, code: "not_found", message: NOT_FOUND.error.message };
    const r = checkAddPerson(state, input);
    return r.ok ? r : { ok: false, code: r.error.code, message: r.error.message, ...(r.error.fields ? { fields: r.error.fields } : {}) };
  });
}

export async function addPersonAction(input: AddPersonFormInput): Promise<ActionResult<{ toast: string }>> {
  return done(
    await runCommand(async (ctx, store, user) => {
      const state = await addState(store, input?.workspaceId, user.id, input?.email);
      if (!state) return NOT_FOUND;
      const r = addPerson(ctx, state, input);
      return r.ok ? { ...r, value: { toast: r.value.toast } } : r;
    }),
  );
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
