// Organization commands (slice 8, D-58): creating an organization, from the start page or for a signed-in person, and
// changing its password. Passwords never enter these commands: the server checks the typed ones with
// `checkNewPassword`, hashes them through its password adapter (src/data, F19) and hands over the hash, which the
// domain treats as opaque. None of these writes is an undo step (P10; `isUndoable` is false for every table here).

import { z } from "zod";
import { buildWriteSet, fail, newRowColumns, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound, staleVersion, type DomainError } from "../errors";
import type { Uuid } from "../ids";
import { BUILTIN_CLASSIFICATIONS } from "../model/classifications";
import { checkOrganizationAccess, type WorkspaceAccess } from "../permissions";
import type { AppUser, Organization, OrganizationAccess, OrganizationMember } from "../types";
import { parseInput, uuidSchema, versionSchema } from "../validation";
import { newWorkspaceRows } from "./workspace";

export const FIRST_WORKSPACE_NAME = "First workspace";
export const PASSWORD_MIN_LENGTH = 8;
/** Long enough for any passphrase; bounds the hashing work a typed password can ask for. */
export const PASSWORD_MAX_LENGTH = 200;
/** This slice's new forms only; existing renames keep slice 0's "no maximum length". */
export const NAME_MAX_LENGTH = 200;
export const EMAIL_MAX_LENGTH = 254;

// ---- the form's checks ----

/** The prototype's e-mail form (`renderWsHome`, the invite box). */
const EMAIL_FORM = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** An e-mail address as stored and compared: trimmed, lower case (`app_user_email_lower`). */
export const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

export const emailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(
    z
      .string()
      .min(1, "Enter an e-mail address.")
      .max(EMAIL_MAX_LENGTH, `This e-mail address is too long; use at most ${EMAIL_MAX_LENGTH} characters.`)
      .regex(EMAIL_FORM, "Enter a valid e-mail address."),
  );

const NAME_TOO_LONG = `This name is too long; use at most ${NAME_MAX_LENGTH} characters.`;
const PASSWORD_TOO_LONG = `This password is too long; use at most ${PASSWORD_MAX_LENGTH} characters.`;

/** A name in this slice's new forms: trimmed, not empty, at most 200 characters (existing renames have no maximum). */
export const newFormName = (empty: string) => z.string().trim().min(1, empty).max(NAME_MAX_LENGTH, NAME_TOO_LONG);
const organizationNameSchema = newFormName("Enter the organization's name.");
const personNameSchema = newFormName("Enter your name.");
const workspaceNameSchema = newFormName("Enter the first workspace's name.");
/** The hash the server's adapter made; the domain only checks that there is one. */
const accessHashSchema = z.string().min(1);

/**
 * The typed password and its repetition (item 6): at least 8 characters, both equal. Returns the problem, or null.
 * The server calls it before hashing; the commands below never see the password itself.
 */
export function checkNewPassword(password: string, again: string): DomainError | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return domainError("invalid", `The password needs at least ${PASSWORD_MIN_LENGTH} characters.`, { password: `The password needs at least ${PASSWORD_MIN_LENGTH} characters.` });
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return domainError("invalid", PASSWORD_TOO_LONG, { password: PASSWORD_TOO_LONG });
  }
  if (password !== again) return domainError("invalid", "The passwords differ.", { passwordAgain: "The passwords differ." });
  return null;
}

export const ACCOUNT_EXISTS_MESSAGE =
  "This e-mail address already has an account. Sign in and create the organization from the organization menu.";

// ---- creating an organization ----

const newOrganizationFields = {
  organizationName: organizationNameSchema,
  workspaceName: workspaceNameSchema,
};

const createOrganizationForm = z
  .object({ ...newOrganizationFields, name: personNameSchema, email: emailSchema, password: z.string(), passwordAgain: z.string() })
  .strict();
export type CreateOrganizationForm = z.input<typeof createOrganizationForm>;

const createOrganizationInput = z.object({ ...newOrganizationFields, name: personNameSchema, email: emailSchema, accessHash: accessHashSchema }).strict();
export type CreateOrganizationInput = z.input<typeof createOrganizationInput>;

const newOrganizationForm = z.object({ ...newOrganizationFields, password: z.string(), passwordAgain: z.string() }).strict();
export type NewOrganizationForm = z.input<typeof newOrganizationForm>;

const newOrganizationInput = z.object({ ...newOrganizationFields, accessHash: accessHashSchema }).strict();
export type NewOrganizationInput = z.input<typeof newOrganizationInput>;

/** What the start page's form needs from the data: the account that has the typed e-mail address, if any. */
export interface CreateOrganizationState {
  accountWithEmail: AppUser | null;
}

/**
 * Checks the start page's form (item 6) and returns the summary shown before anything is written (item 7). Writes
 * nothing; the server runs it again before hashing and creating.
 */
export function checkCreateOrganizationForm(
  state: CreateOrganizationState,
  input: unknown,
): { ok: true; summary: string } | { ok: false; error: DomainError } {
  const parsed = parseInput(createOrganizationForm, input);
  if (!parsed.ok) return parsed;
  const p = parsed.data;
  if (state.accountWithEmail) return fail(domainError("conflict", ACCOUNT_EXISTS_MESSAGE, { email: ACCOUNT_EXISTS_MESSAGE }));
  const weak = checkNewPassword(p.password, p.passwordAgain);
  if (weak) return fail(weak);
  return { ok: true, summary: createOrganizationSummary(p.organizationName, p.workspaceName, { name: p.name, email: p.email }) };
}

/** The same for "New organization…" in the organization menu (item 9): no person's fields. */
export function checkNewOrganizationForm(input: unknown): { ok: true; summary: string } | { ok: false; error: DomainError } {
  const parsed = parseInput(newOrganizationForm, input);
  if (!parsed.ok) return parsed;
  const p = parsed.data;
  const weak = checkNewPassword(p.password, p.passwordAgain);
  if (weak) return fail(weak);
  return { ok: true, summary: createOrganizationSummary(p.organizationName, p.workspaceName, null) };
}

/** Item 7's summary, with F6's first project and canvas; without the person's fields from the organization menu. */
export function createOrganizationSummary(organization: string, workspace: string, you: { name: string; email: string } | null): string {
  const owner = you ? `with you (${you.name}, ${you.email}) as its owner` : "with you as its owner";
  return (
    `You are creating the organization ${organization} ${owner}, and the workspace ${workspace} with an empty first ` +
    `project and canvas, and the ${BUILTIN_CLASSIFICATIONS.length} built-in classifications. People sign in to ` +
    `${organization} with its link and this password.`
  );
}

/** The toast after either way of creating an organization (the prototype's). */
export const ORGANIZATION_CREATED = (organization: string) => `Created ${organization} with an empty first workspace.`;

export interface CreatedOrganization {
  userId: Uuid;
  organizationId: Uuid;
  workspaceId: Uuid;
  projectId: Uuid;
  canvasId: Uuid;
}

/**
 * Creates an organization from the start page (item 8): the person, the organization, its access, the owner's
 * organization membership and the first workspace with its owner, first project and canvas and the built-in
 * classifications, in one change group in that workspace (Q4).
 *
 * There is no session yet (F2): `ctx.actorId` is the new person's id, made by the caller, so every change event is
 * signed by the person the command creates.
 */
export function createOrganization(
  ctx: CommandContext,
  state: CreateOrganizationState,
  input: unknown,
): CommandResult<CreatedOrganization> {
  const parsed = parseInput(createOrganizationInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const p = parsed.data;
  if (state.accountWithEmail) return fail(domainError("conflict", ACCOUNT_EXISTS_MESSAGE, { email: ACCOUNT_EXISTS_MESSAGE }));

  const user: AppUser = { id: ctx.actorId, email: p.email, display_name: p.name, created_at: ctx.now, last_seen_at: null };
  return newOrganization(ctx, p.organizationName, p.workspaceName, p.accessHash, [{ kind: "insert", table: "app_user", row: user }]);
}

/** "New organization…" for a signed-in person (item 9): the same rows without the person. */
export function createOrganizationForUser(
  ctx: CommandContext,
  state: { user: AppUser | null },
  input: unknown,
): CommandResult<CreatedOrganization> {
  if (!state.user || state.user.id !== ctx.actorId) return fail(notFound("person"));
  const parsed = parseInput(newOrganizationInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const p = parsed.data;
  return newOrganization(ctx, p.organizationName, p.workspaceName, p.accessHash, []);
}

function newOrganization(
  ctx: CommandContext,
  name: string,
  workspaceName: string,
  accessHash: string,
  personWrites: Write[],
): CommandResult<CreatedOrganization> {
  const organization: Organization = { ...newRowColumns(ctx), name };
  const access: OrganizationAccess = {
    organization_id: organization.id,
    access_hash: accessHash,
    changed_at: ctx.now,
    changed_by: ctx.actorId,
    version: 1,
  };
  const owner: OrganizationMember = { organization_id: organization.id, user_id: ctx.actorId, role: "owner", created_at: ctx.now };
  const workspace = newWorkspaceRows(ctx, organization.id, workspaceName);
  return {
    ok: true,
    value: {
      userId: ctx.actorId,
      organizationId: organization.id,
      workspaceId: workspace.workspaceId,
      projectId: workspace.projectId,
      canvasId: workspace.canvasId,
    },
    writeSet: buildWriteSet(ctx, workspace.workspaceId, [
      ...personWrites,
      { kind: "insert", table: "organization", row: organization },
      { kind: "insert", table: "organization_access", row: access },
      { kind: "insert", table: "organization_member", row: owner },
      ...workspace.writes,
    ]),
  };
}

// ---- changing the password ----

const changePasswordInput = z
  .object({ workspaceId: uuidSchema, organizationId: uuidSchema, accessHash: accessHashSchema, expectedVersion: versionSchema.nullable() })
  .strict();
export type ChangeOrganizationPasswordInput = z.input<typeof changePasswordInput>;

export interface ChangeOrganizationPasswordState {
  /** The actor in the workspace whose People tab is used; the change event goes into its log (item 17). */
  access: WorkspaceAccess;
  organization: Organization | null;
  organizationMember: OrganizationMember | null;
  /** The organization's current access row; null for an organization that has no password yet. */
  current: OrganizationAccess | null;
}

/** The summary before the change (item 13). */
export const CHANGE_PASSWORD_SUMMARY = "People who are signed in stay signed in; the next sign-in needs the new password.";
export const PASSWORD_CHANGED = (organization: string) => `Changed the password of ${organization}.`;

/**
 * Changes the organization's password (item 13): its owners and admins, not from an archived workspace (F17). The
 * change event's images carry a marker instead of the hash (`SECRET_COLUMNS`). `expectedVersion` is the access row's
 * version the form read, or null when it had none.
 */
export function changeOrganizationPassword(
  ctx: CommandContext,
  state: ChangeOrganizationPasswordState,
  input: unknown,
): CommandResult<{ organizationId: Uuid }> {
  const { access, organization, organizationMember, current } = state;
  if (!organization) return fail(notFound("organization"));
  const denied = checkOrganizationAccess(access, organization, organizationMember);
  if (denied) return fail(denied);
  const parsed = parseInput(changePasswordInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const p = parsed.data;
  if (p.workspaceId !== access.workspace.id || p.organizationId !== organization.id) return fail(notFound("organization"));
  if (p.expectedVersion !== (current?.version ?? null)) return fail(staleVersion());

  const write: Write = current
    ? {
        kind: "update",
        table: "organization_access",
        before: current,
        row: { ...current, access_hash: p.accessHash, changed_at: ctx.now, changed_by: ctx.actorId, version: current.version + 1 },
      }
    : {
        kind: "insert",
        table: "organization_access",
        row: { organization_id: organization.id, access_hash: p.accessHash, changed_at: ctx.now, changed_by: ctx.actorId, version: 1 },
      };
  return { ok: true, value: { organizationId: organization.id }, writeSet: buildWriteSet(ctx, access.workspace.id, [write]) };
}
