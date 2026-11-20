import { describe, expect, it } from "vitest";
import { access, archived, ids, makeCtx, member, NOW, organization, organizationMember, T0, workspace } from "../__fixtures__/domain";
import { ARCHIVED_MESSAGE } from "../errors";
import { SECRET_CHANGED, SECRET_UNCHANGED } from "../changes";
import type { AppUser, Invitation, PasswordReset } from "../types";
import {
  acceptInvitation,
  ACCOUNT_MISMATCH,
  ALREADY_INVITED,
  ALREADY_JOINED,
  ARCHIVED_JOIN,
  checkPersonPassword,
  createInvitation,
  createPasswordReset,
  INVITATION_GONE,
  INVITATION_REVOKED,
  invitationPage,
  invitationStatus,
  listedInvitations,
  PASSWORD_TOO_LONG,
  PASSWORD_TOO_SHORT,
  PASSWORDS_DIFFER,
  renewInvitation,
  RESET_FOR_GUEST,
  RESET_FOR_OWNER,
  RESET_FOR_SELF,
  RESET_GONE,
  RESET_OUT_OF_REACH,
  resetPage,
  resetRefusal,
  revokeInvitation,
  redeemPasswordReset,
  type AcceptState,
  type ResetLinkState,
} from "./invitations";

const H1 = "1".repeat(64);
const H2 = "2".repeat(64);
const AUTH = "0b6f1a52-3c3e-4f4e-9d0a-6f1d2a3b4c5d";
const anna: AppUser = { id: ids.someoneElse, email: "anna@infomate.pl", display_name: "Anna Nowak", created_at: T0, last_seen_at: null };
const me: AppUser = { id: ids.actor, email: "lukasz@infomate.pl", display_name: "Łukasz", created_at: T0, last_seen_at: null };
const otherWs = "01900000-0000-7000-8000-000000000011";
const newcomer = "01900000-0000-7000-8000-000000000199";

const invitation = (over: Partial<Invitation> = {}): Invitation => ({
  id: "01900000-0000-7000-8000-000000007001",
  workspace_id: ids.ws,
  email: "jan@example.com",
  role: "reviewer",
  token_hash: H1,
  invited_by: ids.actor,
  created_at: T0,
  // NOW is a day and a bit after T0: still within the 7 days
  expires_at: "2026-10-08T08:00:00.000Z",
  accepted_at: null,
  revoked_at: null,
  ...over,
});

describe("checkPersonPassword (F11)", () => {
  it("needs 10 to 72 characters and the same twice", () => {
    expect(checkPersonPassword("short", "short")?.message).toBe(PASSWORD_TOO_SHORT);
    expect(checkPersonPassword("x".repeat(73), "x".repeat(73))?.message).toBe(PASSWORD_TOO_LONG);
    expect(checkPersonPassword("long enough 1", "long enough 2")?.fields).toEqual({ passwordAgain: PASSWORDS_DIFFER });
    expect(checkPersonPassword("x".repeat(10), "x".repeat(10))).toBeNull();
    expect(checkPersonPassword("x".repeat(72), "x".repeat(72))).toBeNull();
  });
});

describe("invitationStatus and the list (D6)", () => {
  it("tells pending, expired, accepted and revoked apart; the list keeps the pending and the expired", () => {
    const expired = invitation({ id: "e", expires_at: NOW });
    const accepted = invitation({ id: "a", accepted_at: T0 });
    const revoked = invitation({ id: "r", revoked_at: T0 });
    expect([invitation(), expired, accepted, revoked].map((i) => invitationStatus(i, NOW))).toEqual(["pending", "expired", "accepted", "revoked"]);
    expect(listedInvitations([invitation(), expired, accepted, revoked]).map((i) => i.id)).toEqual([invitation().id, "e"]);
  });
});

describe("createInvitation (P2.1, P2.2)", () => {
  const state = { access: access("admin"), account: null, members: [member("admin")], invitations: [] as Invitation[] };
  const input = { workspaceId: ids.ws, email: " Jan@Example.com ", role: "reviewer", tokenHash: H1 };

  it("an Admin invites: one row, lower-case e-mail, 7 days, the hash in the event only as its marker", () => {
    const r = createInvitation(makeCtx(), state, input);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toEqual([
      {
        kind: "insert",
        table: "invitation",
        row: { id: r.value.invitationId, workspace_id: ids.ws, email: "jan@example.com", role: "reviewer", token_hash: H1, invited_by: ids.actor, created_at: NOW, expires_at: "2026-10-09T12:00:00.000Z", accepted_at: null, revoked_at: null },
      },
    ]);
    expect(r.value.expiresAt).toBe("2026-10-09T12:00:00.000Z");
    const [event] = r.writeSet.events;
    expect(event).toMatchObject({ workspace_id: ids.ws, object_type: "invitation", operation: "create" });
    expect(event!.after_image!.token_hash).toBe(SECRET_CHANGED);
  });

  it("modelers, reviewers and readers may not, nor anyone in an archived workspace", () => {
    for (const role of ["modeler", "reviewer", "reader"] as const) {
      const r = createInvitation(makeCtx(), { ...state, access: access(role) }, input);
      expect(r.ok ? null : r.error.code).toBe("forbidden");
    }
    const r = createInvitation(makeCtx(), { ...state, access: access("owner", archived) }, input);
    expect(r.ok ? null : r.error.message).toBe(ARCHIVED_MESSAGE);
  });

  it("never Owner", () => {
    const r = createInvitation(makeCtx(), state, { ...input, role: "owner" });
    expect(r.ok ? null : r.error.code).toBe("invalid");
  });

  it("refuses a member's e-mail and an e-mail already invited, also when that invitation expired", () => {
    const r1 = createInvitation(makeCtx(), { ...state, account: anna, members: [member("admin"), member("modeler", { user_id: anna.id })] }, { ...input, email: anna.email });
    expect(r1.ok ? null : r1.error.message).toBe(ALREADY_INVITED(anna.email));
    const r2 = createInvitation(makeCtx(), { ...state, invitations: [invitation({ expires_at: T0 })] }, input);
    expect(r2.ok ? null : r2.error).toEqual({ code: "conflict", message: ALREADY_INVITED("jan@example.com"), fields: { email: ALREADY_INVITED("jan@example.com") } });
    // a revoked or accepted one does not count
    expect(createInvitation(makeCtx(), { ...state, invitations: [invitation({ revoked_at: T0 }), invitation({ accepted_at: T0 })] }, input).ok).toBe(true);
  });

  it("refuses anything but a SHA-256 in hex as the hash", () => {
    const r = createInvitation(makeCtx(), state, { ...input, tokenHash: "the-token-itself" });
    expect(r.ok ? null : r.error.code).toBe("invalid");
  });
});

describe("renewInvitation and revokeInvitation (P2.2)", () => {
  const state = { access: access("owner"), invitation: invitation({ expires_at: T0 }) };

  it("New link: the same row, the new hash and 7 days from now, also for an expired one", () => {
    const r = renewInvitation(makeCtx(), state, { workspaceId: ids.ws, invitationId: invitation().id, tokenHash: H2 });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toEqual([{ kind: "update", table: "invitation", before: state.invitation, row: { ...state.invitation, token_hash: H2, expires_at: "2026-10-09T12:00:00.000Z" } }]);
    expect(r.writeSet.events[0]!.after_image!.token_hash).toBe(SECRET_CHANGED);
  });

  it("Revoke: the row's revoked_at, the prototype's toast", () => {
    const r = revokeInvitation(makeCtx(), state, { workspaceId: ids.ws, invitationId: invitation().id });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.toast).toBe(INVITATION_REVOKED("jan@example.com"));
    expect(r.writeSet.writes[0]).toMatchObject({ kind: "update", table: "invitation", row: { revoked_at: NOW } });
    expect(r.writeSet.events[0]!.after_image!.token_hash).toBe(SECRET_UNCHANGED);
  });

  it("an accepted or revoked invitation is gone; another workspace's is not found; a reader may not", () => {
    for (const gone of [invitation({ accepted_at: T0 }), invitation({ revoked_at: T0 }), invitation({ workspace_id: otherWs })]) {
      const r = revokeInvitation(makeCtx(), { ...state, invitation: gone }, { workspaceId: ids.ws, invitationId: gone.id });
      expect(r.ok ? null : r.error.code).toBe("not_found");
    }
    const r = renewInvitation(makeCtx(), { ...state, access: access("reader") }, { workspaceId: ids.ws, invitationId: invitation().id, tokenHash: H2 });
    expect(r.ok ? null : r.error.code).toBe("forbidden");
  });
});

describe("invitationPage and acceptInvitation (PT3, Q6)", () => {
  const base: AcceptState = {
    invitation: invitation(),
    workspace: workspace(),
    organization: organization(),
    inviter: me,
    account: null,
    accountOrganizationMember: null,
    accountWorkspaceIds: [],
  };

  it("the page: new, existing, the account to link online (D5), archived, and one gone page for every other case", () => {
    expect(invitationPage(base, H1, NOW, true)).toEqual({
      kind: "new",
      email: "jan@example.com",
      role: "reviewer",
      roleLabel: "Reviewer",
      workspaceId: ids.ws,
      workspace: "Retail Co – DWH",
      organization: "InfoMate",
      inviter: "Łukasz",
    });
    const known = { ...base, account: { ...anna, email: "jan@example.com" } };
    expect(invitationPage(known, H1, NOW, false).kind).toBe("existing");
    expect(invitationPage(known, H1, NOW, true).kind).toBe("account");
    expect(invitationPage({ ...known, account: { ...known.account, auth_user_id: AUTH } }, H1, NOW, true).kind).toBe("existing");
    expect(invitationPage({ ...base, workspace: workspace(archived) }, H1, NOW, true)).toEqual({ kind: "archived", workspace: "Retail Co – DWH" });
    for (const s of [
      { ...base, invitation: null },
      { ...base, invitation: invitation({ expires_at: NOW }) },
      { ...base, invitation: invitation({ accepted_at: T0 }) },
      { ...base, invitation: invitation({ revoked_at: T0 }) },
      { ...base, workspace: workspace({ deleted_at: T0 }) },
    ]) {
      expect(invitationPage(s, H1, NOW, true)).toEqual({ kind: "gone" });
    }
    // an altered link's hash finds nothing; one that finds another row is refused too
    expect(invitationPage(base, H2, NOW, true)).toEqual({ kind: "gone" });
  });

  it("a new person: the person (signed by their own id, with the Auth account online), a member row, the membership, the invitation accepted", () => {
    const r = acceptInvitation(makeCtx(newcomer), base, { tokenHash: H1, name: " Jan Test ", authUserId: AUTH });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ userId: newcomer, workspaceId: ids.ws, organizationId: ids.org });
    expect(r.writeSet.writes).toEqual([
      { kind: "insert", table: "app_user", row: { id: newcomer, email: "jan@example.com", display_name: "Jan Test", created_at: NOW, last_seen_at: null, auth_user_id: AUTH } },
      { kind: "insert", table: "organization_member", row: { organization_id: ids.org, user_id: newcomer, role: "member", created_at: NOW } },
      { kind: "insert", table: "workspace_member", row: { workspace_id: ids.ws, user_id: newcomer, role: "reviewer", added_by: ids.actor, created_at: NOW } },
      { kind: "update", table: "invitation", before: base.invitation, row: { ...base.invitation, accepted_at: NOW } },
    ]);
    expect(r.writeSet.events.every((e) => e.user_id === newcomer && e.workspace_id === ids.ws)).toBe(true);
    expect(r.writeSet.events[0]!.after_image!.auth_user_id).toBe(SECRET_CHANGED);
  });

  it("locally a new person has no Auth account: no auth_user_id on the row or in its event", () => {
    const r = acceptInvitation(makeCtx(newcomer), base, { tokenHash: H1, name: "Jan", authUserId: null });
    if (!r.ok) throw new Error(r.error.message);
    expect("auth_user_id" in (r.writeSet.writes[0] as { row: object }).row).toBe(false);
    expect("auth_user_id" in r.writeSet.events[0]!.after_image!).toBe(false);
  });

  it("a new person needs a name", () => {
    const r = acceptInvitation(makeCtx(newcomer), base, { tokenHash: H1, name: "  ", authUserId: null });
    expect(r.ok ? null : r.error.fields).toEqual({ name: "Enter your name." });
    const r2 = acceptInvitation(makeCtx(newcomer), base, { tokenHash: H1, authUserId: null });
    expect(r2.ok ? null : r2.error.fields).toEqual({ name: "Enter your name." });
  });

  it("an existing person in the organization: only the membership and the invitation; a guest stays a guest", () => {
    const jan = { ...anna, email: "jan@example.com", auth_user_id: AUTH };
    const linked = { ...base, account: jan, accountOrganizationMember: organizationMember({ user_id: jan.id }), accountWorkspaceIds: [otherWs] };
    const r = acceptInvitation(makeCtx(jan.id), linked, { tokenHash: H1, authUserId: AUTH });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes.map((w) => w.table)).toEqual(["workspace_member", "invitation"]);
    const guest = { ...linked, accountOrganizationMember: null };
    const g = acceptInvitation(makeCtx(jan.id), guest, { tokenHash: H1, authUserId: AUTH });
    expect(g.ok && g.writeSet.writes.map((w) => w.table)).toEqual(["workspace_member", "invitation"]);
  });

  it("D5: a person without an Auth account gets the account made for them linked", () => {
    const jan = { ...anna, email: "jan@example.com" };
    const r = acceptInvitation(makeCtx(jan.id), { ...base, account: jan }, { tokenHash: H1, authUserId: AUTH });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes[0]).toEqual({ kind: "update", table: "app_user", before: jan, row: { ...jan, auth_user_id: AUTH } });
    expect(r.writeSet.writes.map((w) => w.table)).toEqual(["app_user", "organization_member", "workspace_member", "invitation"]);
  });

  it("refuses another account, someone already in the workspace, an archived workspace and a gone link", () => {
    const jan = { ...anna, email: "jan@example.com", auth_user_id: AUTH };
    const known = { ...base, account: jan };
    expect(acceptInvitation(makeCtx(jan.id), known, { tokenHash: H1, authUserId: "0b6f1a52-3c3e-4f4e-9d0a-000000000000" })).toMatchObject({ ok: false, error: { message: ACCOUNT_MISMATCH } });
    expect(acceptInvitation(makeCtx(ids.actor), known, { tokenHash: H1, authUserId: AUTH })).toMatchObject({ ok: false, error: { message: ACCOUNT_MISMATCH } });
    expect(acceptInvitation(makeCtx(jan.id), { ...known, accountWorkspaceIds: [ids.ws] }, { tokenHash: H1, authUserId: AUTH })).toMatchObject({ ok: false, error: { message: ALREADY_JOINED("Retail Co – DWH") } });
    expect(acceptInvitation(makeCtx(newcomer), { ...base, workspace: workspace(archived) }, { tokenHash: H1, name: "Jan", authUserId: null })).toMatchObject({
      ok: false,
      error: { code: "archived", message: ARCHIVED_JOIN("Retail Co – DWH") },
    });
    expect(acceptInvitation(makeCtx(newcomer), { ...base, invitation: invitation({ revoked_at: T0 }) }, { tokenHash: H1, name: "Jan", authUserId: null })).toMatchObject({
      ok: false,
      error: { code: "not_found", message: INVITATION_GONE },
    });
  });
});

describe("resetRefusal (D1) and createPasswordReset (P2.3)", () => {
  const person = { ...anna };
  const reach = {
    workspaces: [{ workspaceId: ids.ws, organizationId: ids.org, personRole: "modeler" as const, actorRole: "admin" as const }],
    organizations: [organizationMember({ user_id: anna.id })],
  };
  const members = [member("admin"), member("modeler", { user_id: anna.id })];
  const state: ResetLinkState = { access: access("admin"), person, members, reach, resets: [] };
  const input = { workspaceId: ids.ws, userId: anna.id, tokenHash: H1 };

  it("an Admin for a modeler who is only in their workspaces: a live link for 24 hours", () => {
    const r = createPasswordReset(makeCtx(), state, input);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toEqual([
      {
        kind: "insert",
        table: "password_reset",
        row: { id: r.value.resetId, workspace_id: ids.ws, app_user_id: anna.id, token_hash: H1, created_by: ids.actor, created_at: NOW, expires_at: "2026-10-03T12:00:00.000Z", used_at: null, revoked_at: null },
      },
    ]);
    expect(r.value).toMatchObject({ name: "Anna Nowak", email: "anna@infomate.pl" });
    expect(r.writeSet.events[0]!.after_image!.token_hash).toBe(SECRET_CHANGED);
  });

  it("a new link revokes the person's earlier live one, and leaves used ones", () => {
    const live: PasswordReset = { id: "r1", workspace_id: ids.ws, app_user_id: anna.id, token_hash: H2, created_by: ids.actor, created_at: T0, expires_at: "2026-10-09T00:00:00.000Z", used_at: null, revoked_at: null };
    const used = { ...live, id: "r2", used_at: T0 };
    const r = createPasswordReset(makeCtx(), { ...state, resets: [live, used] }, input);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes.slice(0, 1)).toEqual([{ kind: "update", table: "password_reset", before: live, row: { ...live, revoked_at: NOW } }]);
    expect(r.writeSet.writes).toHaveLength(2);
  });

  it("not for oneself, a guest, or an Owner when an Admin", () => {
    expect(resetRefusal(ids.actor, access("admin"), me, [member("admin")], { workspaces: [], organizations: [organizationMember()] })?.message).toBe(RESET_FOR_SELF);
    expect(resetRefusal(ids.actor, access("admin"), person, members, { ...reach, organizations: [] })?.message).toBe(RESET_FOR_GUEST);
    const owner = [member("admin"), member("owner", { user_id: anna.id })];
    expect(resetRefusal(ids.actor, access("admin"), person, owner, reach)?.message).toBe(RESET_FOR_OWNER);
    // an Owner may, when the person is within reach
    const asOwner = { ...reach, workspaces: [{ ...reach.workspaces[0]!, personRole: "owner" as const, actorRole: "owner" as const }] };
    expect(resetRefusal(ids.actor, access("owner"), person, owner, asOwner)).toBeNull();
  });

  it("D1: not for someone with a workspace the actor does not rule, another organization, or the organization's owner or admin", () => {
    const out = RESET_OUT_OF_REACH("Anna Nowak");
    const elsewhere = (actorRole: "admin" | "modeler" | null, personRole: "modeler" | "owner") => ({
      ...reach,
      workspaces: [...reach.workspaces, { workspaceId: otherWs, organizationId: ids.org, personRole, actorRole }],
    });
    expect(resetRefusal(ids.actor, access("admin"), person, members, elsewhere(null, "modeler"))?.message).toBe(out);
    expect(resetRefusal(ids.actor, access("admin"), person, members, elsewhere("modeler", "modeler"))?.message).toBe(out);
    expect(resetRefusal(ids.actor, access("admin"), person, members, elsewhere("admin", "owner"))?.message).toBe(out);
    expect(resetRefusal(ids.actor, access("admin"), person, members, elsewhere("admin", "modeler"))).toBeNull();
    const otherOrg = { ...reach, organizations: [...reach.organizations, organizationMember({ user_id: anna.id, organization_id: ids.otherOrg })] };
    expect(resetRefusal(ids.actor, access("admin"), person, members, otherOrg)?.message).toBe(out);
    const guestElsewhere = { ...reach, workspaces: [...reach.workspaces, { workspaceId: otherWs, organizationId: ids.otherOrg, personRole: "reader" as const, actorRole: null }] };
    expect(resetRefusal(ids.actor, access("admin"), person, members, guestElsewhere)?.message).toBe(out);
    for (const role of ["owner", "admin"] as const) {
      const ruler = { ...reach, organizations: [organizationMember({ user_id: anna.id, role })] };
      expect(resetRefusal(ids.actor, access("owner"), person, members, ruler)?.message).toBe(out);
    }
  });

  it("refused for a modeler, in an archived workspace, and for someone not in the workspace", () => {
    expect(createPasswordReset(makeCtx(), { ...state, access: access("modeler") }, input)).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(createPasswordReset(makeCtx(), { ...state, access: access("admin", archived) }, input)).toMatchObject({ ok: false, error: { message: ARCHIVED_MESSAGE } });
    expect(createPasswordReset(makeCtx(), { ...state, members: [member("admin")] }, input)).toMatchObject({ ok: false, error: { code: "not_found" } });
  });
});

describe("resetPage and redeemPasswordReset (PT5)", () => {
  const reset: PasswordReset = { id: "r1", workspace_id: ids.ws, app_user_id: anna.id, token_hash: H1, created_by: ids.actor, created_at: T0, expires_at: "2026-10-03T00:00:00.000Z", used_at: null, revoked_at: null };

  it("the page shows the person's e-mail while the link is live; gone otherwise", () => {
    expect(resetPage({ reset, person: anna }, H1, NOW)).toEqual({ kind: "set", email: anna.email });
    for (const r of [{ ...reset, used_at: T0 }, { ...reset, revoked_at: T0 }, { ...reset, expires_at: NOW }]) expect(resetPage({ reset: r, person: anna }, H1, NOW)).toEqual({ kind: "gone" });
    expect(resetPage({ reset, person: anna }, H2, NOW)).toEqual({ kind: "gone" });
    expect(resetPage({ reset: null, person: null }, H1, NOW)).toEqual({ kind: "gone" });
  });

  it("Set password: the link used, signed by the person; an account made now is linked (D5)", () => {
    const r = redeemPasswordReset(makeCtx(anna.id), { reset, person: anna }, { tokenHash: H1, authUserId: AUTH });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toEqual([
      { kind: "update", table: "password_reset", before: reset, row: { ...reset, used_at: NOW } },
      { kind: "update", table: "app_user", before: anna, row: { ...anna, auth_user_id: AUTH } },
    ]);
    const linked = { ...anna, auth_user_id: AUTH };
    const again = redeemPasswordReset(makeCtx(anna.id), { reset, person: linked }, { tokenHash: H1, authUserId: AUTH });
    expect(again.ok && again.writeSet.writes.map((w) => w.table)).toEqual(["password_reset"]);
  });

  it("refuses a used link and another actor", () => {
    expect(redeemPasswordReset(makeCtx(anna.id), { reset: { ...reset, used_at: T0 }, person: anna }, { tokenHash: H1, authUserId: null })).toMatchObject({ ok: false, error: { message: RESET_GONE } });
    expect(redeemPasswordReset(makeCtx(ids.actor), { reset, person: anna }, { tokenHash: H1, authUserId: null })).toMatchObject({ ok: false, error: { message: ACCOUNT_MISMATCH } });
  });
});
