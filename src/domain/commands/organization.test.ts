import { describe, expect, it } from "vitest";
import { access, archived, ids, makeCtx, NOW, organization, organizationMember, T0 } from "../__fixtures__/domain";
import { SECRET_CHANGED } from "../changes";
import { ARCHIVED_MESSAGE, STALE_VERSION_MESSAGE } from "../errors";
import type { AppUser, OrganizationAccess } from "../types";
import {
  ACCOUNT_EXISTS_MESSAGE,
  changeOrganizationPassword,
  checkCreateOrganizationForm,
  checkNewOrganizationForm,
  checkNewPassword,
  createOrganization,
  createOrganizationForUser,
  normalizeEmail,
} from "./organization";
import { FIRST_CANVAS_NAME, FIRST_PROJECT_NAME } from "./workspace";

const HASH = "scrypt$15$8$1$c2FsdA$a2V5";
const user = (over: Partial<AppUser> = {}): AppUser => ({
  id: ids.actor,
  email: "lukasz@infomate.pl",
  display_name: "Łukasz Wolski",
  created_at: T0,
  last_seen_at: null,
  ...over,
});
const form = {
  organizationName: " Test Org ",
  name: " Jan Test ",
  email: "  Jan@Example.COM ",
  workspaceName: "First workspace",
  password: "correct horse",
  passwordAgain: "correct horse",
};
const input = { organizationName: form.organizationName, name: form.name, email: form.email, workspaceName: form.workspaceName, accessHash: HASH };

describe("the form's checks (item 6)", () => {
  it("trims names and lower-cases the e-mail address", () => {
    expect(normalizeEmail("  Jan@Example.COM ")).toBe("jan@example.com");
  });

  it("names each problem", () => {
    const problem = (over: object) => {
      const r = checkCreateOrganizationForm({ accountWithEmail: null }, { ...form, ...over });
      return r.ok ? null : r.error.message;
    };
    expect(problem({ organizationName: "  " })).toBe("Enter the organization's name.");
    expect(problem({ name: "" })).toBe("Enter your name.");
    expect(problem({ workspaceName: " " })).toBe("Enter the first workspace's name.");
    expect(problem({ email: " " })).toBe("Enter an e-mail address.");
    expect(problem({ email: "jan@example" })).toBe("Enter a valid e-mail address.");
    expect(problem({ password: "short", passwordAgain: "short" })).toBe("The password needs at least 8 characters.");
    expect(problem({ passwordAgain: "correct horsE" })).toBe("The passwords differ.");
    expect(problem({ password: "x".repeat(201), passwordAgain: "x".repeat(201) })).toBe("This password is too long; use at most 200 characters.");
    expect(problem({ name: "x".repeat(201) })).toBe("This name is too long; use at most 200 characters.");
    expect(problem({ email: `${"x".repeat(250)}@a.pl` })).toBe("This e-mail address is too long; use at most 254 characters.");
  });

  it("puts the password problems on their fields", () => {
    expect(checkNewPassword("short", "short")?.fields).toEqual({ password: "The password needs at least 8 characters." });
    expect(checkNewPassword("12345678", "12345679")?.fields).toEqual({ passwordAgain: "The passwords differ." });
    expect(checkNewPassword("12345678", "12345678")).toBeNull();
  });

  it("refuses an e-mail address that has an account, with the hint", () => {
    const r = checkCreateOrganizationForm({ accountWithEmail: user() }, form);
    expect(r).toEqual({ ok: false, error: { code: "conflict", message: ACCOUNT_EXISTS_MESSAGE, fields: { email: ACCOUNT_EXISTS_MESSAGE } } });
  });

  it("gives the summary (item 7, F6)", () => {
    expect(checkCreateOrganizationForm({ accountWithEmail: null }, form)).toEqual({
      ok: true,
      summary:
        "You are creating the organization Test Org with you (Jan Test, jan@example.com) as its owner, and the " +
        "workspace First workspace with an empty first project and canvas, and the 19 built-in classifications. People " +
        "sign in to Test Org with its link and this password.",
    });
    const fromMenu = checkNewOrganizationForm({ organizationName: "Second Org", workspaceName: "Main", password: "12345678", passwordAgain: "12345678" });
    expect(fromMenu).toMatchObject({ ok: true, summary: expect.stringContaining("Second Org with you as its owner, and the workspace Main with an empty first project") });
  });
});

describe("createOrganization (item 8)", () => {
  it("writes the person, the organization, its access, the owner's membership and the workspace in one change group", () => {
    const ctx = makeCtx(ids.someoneElse);
    const r = createOrganization(ctx, { accountWithEmail: null }, input);
    if (!r.ok) throw new Error(r.error.message);
    const { writes, events, changeGroupId } = r.writeSet;

    expect(writes.map((w) => `${w.kind}:${w.table}`)).toEqual([
      "insert:app_user",
      "insert:organization",
      "insert:organization_access",
      "insert:organization_member",
      "insert:workspace",
      "insert:workspace_member",
      "insert:project",
      "insert:canvas",
      "insert:project_canvas",
      ...Array<string>(19).fill("insert:classification"),
    ]);
    const row = (table: string) => {
      const w = writes.find((x) => x.table === table);
      return w?.kind === "insert" ? (w.row as unknown as Record<string, unknown>) : null;
    };
    expect(row("app_user")).toEqual({ id: ids.someoneElse, email: "jan@example.com", display_name: "Jan Test", created_at: NOW, last_seen_at: null });
    expect(row("organization")).toMatchObject({ id: r.value.organizationId, name: "Test Org", version: 1, created_by: ids.someoneElse });
    expect(row("organization_access")).toEqual({
      organization_id: r.value.organizationId,
      access_hash: HASH,
      changed_at: NOW,
      changed_by: ids.someoneElse,
      version: 1,
    });
    expect(row("organization_member")).toEqual({ organization_id: r.value.organizationId, user_id: ids.someoneElse, role: "owner", created_at: NOW });
    expect(row("workspace")).toMatchObject({ id: r.value.workspaceId, organization_id: r.value.organizationId, name: "First workspace" });
    expect(row("workspace_member")).toMatchObject({ user_id: ids.someoneElse, role: "owner" });
    expect(row("project")).toMatchObject({ id: r.value.projectId, name: FIRST_PROJECT_NAME });
    expect(row("canvas")).toMatchObject({ id: r.value.canvasId, name: FIRST_CANVAS_NAME });
    expect(r.value.userId).toBe(ids.someoneElse);

    expect(events).toHaveLength(writes.length);
    for (const e of events) {
      expect(e).toMatchObject({ change_group_id: changeGroupId, workspace_id: r.value.workspaceId, user_id: ids.someoneElse, operation: "create" });
    }
    const accessEvent = events.find((e) => e.object_type === "organization_access")!;
    expect(accessEvent.object_id).toBe(r.value.organizationId);
    expect(accessEvent.after_image?.access_hash).toBe(SECRET_CHANGED);
    expect(events.find((e) => e.object_type === "organization_member")!.object_id).toBe(ids.someoneElse);
    expect(JSON.stringify(events)).not.toContain(HASH);
  });

  it("refuses an e-mail address that has an account, and writes nothing", () => {
    const r = createOrganization(makeCtx(), { accountWithEmail: user({ email: "jan@example.com" }) }, input);
    expect(r).toMatchObject({ ok: false, error: { code: "conflict", message: ACCOUNT_EXISTS_MESSAGE } });
  });

  it("checks the fields again and needs a hash", () => {
    expect(createOrganization(makeCtx(), { accountWithEmail: null }, { ...input, organizationName: "" })).toMatchObject({ ok: false });
    expect(createOrganization(makeCtx(), { accountWithEmail: null }, { ...input, accessHash: "" })).toMatchObject({ ok: false });
    // the password itself never goes into the command
    expect(createOrganization(makeCtx(), { accountWithEmail: null }, { ...input, password: "correct horse" })).toMatchObject({ ok: false });
  });
});

describe("createOrganizationForUser (item 9)", () => {
  const menuInput = { organizationName: "Second Org", workspaceName: "First workspace", accessHash: HASH };

  it("writes the same rows without the person, with the signed-in person as owner", () => {
    const r = createOrganizationForUser(makeCtx(), { user: user() }, menuInput);
    if (!r.ok) throw new Error(r.error.message);
    const tables = r.writeSet.writes.map((w) => w.table);
    expect(tables).not.toContain("app_user");
    expect(tables.slice(0, 4)).toEqual(["organization", "organization_access", "organization_member", "workspace"]);
    expect(r.writeSet.events.every((e) => e.user_id === ids.actor && e.workspace_id === r.value.workspaceId)).toBe(true);
  });

  it("needs the signed-in person", () => {
    expect(createOrganizationForUser(makeCtx(), { user: null }, menuInput)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(createOrganizationForUser(makeCtx(), { user: user({ id: ids.someoneElse }) }, menuInput)).toMatchObject({ ok: false });
  });
});

describe("changeOrganizationPassword (item 13)", () => {
  const current: OrganizationAccess = { organization_id: ids.org, access_hash: "scrypt$old", changed_at: T0, changed_by: ids.someoneElse, version: 2 };
  const state = { access: access("reader"), organization: organization(), organizationMember: organizationMember({ role: "admin" }), current };
  const change = { workspaceId: ids.ws, organizationId: ids.org, accessHash: HASH, expectedVersion: 2 };

  it("writes the new hash with a marker in the change event, in the workspace's log", () => {
    const r = changeOrganizationPassword(makeCtx(), state, change);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toEqual([
      { kind: "update", table: "organization_access", before: current, row: { ...current, access_hash: HASH, changed_at: NOW, changed_by: ids.actor, version: 3 } },
    ]);
    const [e] = r.writeSet.events;
    expect(e).toMatchObject({ workspace_id: ids.ws, object_type: "organization_access", object_id: ids.org, operation: "update" });
    expect(e!.before_image?.access_hash).toBe(SECRET_CHANGED);
    expect(e!.after_image?.access_hash).toBe(SECRET_CHANGED);
    expect(JSON.stringify(r.writeSet.events)).not.toMatch(/scrypt\$/);
  });

  it("sets a first password for an organization that has none", () => {
    const r = changeOrganizationPassword(makeCtx(), { ...state, current: null }, { ...change, expectedVersion: null });
    expect(r.ok && r.writeSet.writes[0]).toMatchObject({ kind: "insert", row: { organization_id: ids.org, version: 1 } });
  });

  it("refuses a stale form, a member, an archived workspace and another organization", () => {
    expect(changeOrganizationPassword(makeCtx(), state, { ...change, expectedVersion: 1 })).toMatchObject({ ok: false, error: { message: STALE_VERSION_MESSAGE } });
    expect(changeOrganizationPassword(makeCtx(), { ...state, organizationMember: organizationMember() }, change)).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(changeOrganizationPassword(makeCtx(), { ...state, access: access("owner", archived) }, change)).toMatchObject({
      ok: false,
      error: { message: ARCHIVED_MESSAGE },
    });
    expect(changeOrganizationPassword(makeCtx(), state, { ...change, organizationId: ids.otherOrg })).toMatchObject({ ok: false, error: { code: "not_found" } });
  });
});
