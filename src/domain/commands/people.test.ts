import { describe, expect, it } from "vitest";
import { access, archived, ids, makeCtx, member, NOW, organization, organizationMember, T0 } from "../__fixtures__/domain";
import { ARCHIVED_MESSAGE } from "../errors";
import type { AppUser, WorkspaceMember, WorkspaceRole } from "../types";
import {
  addPerson,
  changeRole,
  checkAddPerson,
  checkRemovePerson,
  OWN_REMOVAL_MESSAGE,
  OWN_ROLE_MESSAGE,
  OWNER_ONLY_CHANGE_MESSAGE,
  OWNER_ONLY_GIVE_MESSAGE,
  OWNER_ONLY_REMOVE_MESSAGE,
  removePerson,
  type AddPersonState,
  type RemovePersonState,
} from "./people";

const anna: AppUser = { id: ids.someoneElse, email: "anna@infomate.pl", display_name: "Anna Nowak", created_at: T0, last_seen_at: null };
const otherWs = "01900000-0000-7000-8000-000000000011";
const third = "01900000-0000-7000-8000-000000000102";

describe("addPerson (item 10)", () => {
  const state: AddPersonState = {
    access: access("admin"),
    organization: organization(),
    account: null,
    accountOrganizationMember: null,
    accountWorkspaceIds: [],
  };
  const input = { workspaceId: ids.ws, name: " Jan Test ", email: " Jan@Example.com", role: "reviewer" };

  it("a new person: the account, a member row in the organization and the workspace membership, in one change group", () => {
    const r = addPerson(makeCtx(), state, input);
    if (!r.ok) throw new Error(r.error.message);
    const [user, orgRow, wsRow] = r.writeSet.writes;
    expect(user).toMatchObject({ kind: "insert", table: "app_user", row: { email: "jan@example.com", display_name: "Jan Test", created_at: NOW } });
    const userId = r.value.userId;
    expect(orgRow).toEqual({ kind: "insert", table: "organization_member", row: { organization_id: ids.org, user_id: userId, role: "member", created_at: NOW } });
    expect(wsRow).toEqual({
      kind: "insert",
      table: "workspace_member",
      row: { workspace_id: ids.ws, user_id: userId, role: "reviewer", added_by: ids.actor, created_at: NOW },
    });
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    expect(r.writeSet.events.every((e) => e.workspace_id === ids.ws)).toBe(true);
    expect(r.value.summary).toEqual([
      "Jan Test (jan@example.com) gets the role Reviewer in Retail Co – DWH. They sign in with the link of InfoMate and its password.",
    ]);
    expect(r.value.toast).toBe("Added Jan Test to Retail Co – DWH as Reviewer.");
  });

  it("an account already in the organization: its name stays and is shown; no new organization row", () => {
    const known = { ...state, account: anna, accountOrganizationMember: organizationMember({ user_id: anna.id }), accountWorkspaceIds: [otherWs] };
    const r = addPerson(makeCtx(), known, { ...input, name: "A. Nowak", email: "anna@infomate.pl" });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes.map((w) => w.table)).toEqual(["workspace_member"]);
    expect(r.value.summary).toEqual([
      "Anna Nowak (anna@infomate.pl) gets the role Reviewer in Retail Co – DWH. They sign in with the link of InfoMate and its password.",
      "anna@infomate.pl already has an account as Anna Nowak; that name stays.",
    ]);
    expect(r.value.toast).toBe("Added Anna Nowak to Retail Co – DWH as Reviewer.");
  });

  it("an account from another organization: its name stays hidden (F11), and it becomes a member here", () => {
    const stranger = { ...state, account: anna };
    const preview = checkAddPerson(stranger, { ...input, email: "anna@infomate.pl" });
    expect(preview).toEqual({
      ok: true,
      value: {
        summary: [
          "anna@infomate.pl gets the role Reviewer in Retail Co – DWH. They sign in with the link of InfoMate and its password.",
          "anna@infomate.pl already has an account; they keep their own name.",
        ],
        toast: "Added anna@infomate.pl to Retail Co – DWH as Reviewer.",
      },
    });
    expect(JSON.stringify(preview)).not.toContain("Anna Nowak");
    const r = addPerson(makeCtx(), stranger, { ...input, email: "anna@infomate.pl" });
    expect(r.ok && r.writeSet.writes.map((w) => w.table)).toEqual(["organization_member", "workspace_member"]);
  });

  it("refuses someone already in the workspace", () => {
    const inside = { ...state, account: anna, accountOrganizationMember: organizationMember({ user_id: anna.id }), accountWorkspaceIds: [ids.ws] };
    expect(checkAddPerson(inside, { ...input, email: "anna@infomate.pl" })).toEqual({
      ok: false,
      error: { code: "conflict", message: "Anna Nowak is already in Retail Co – DWH." },
    });
  });

  it("offers Admin to Reader, not Owner; Modeler is the form's default", () => {
    expect(addPerson(makeCtx(), state, { ...input, role: "owner" })).toMatchObject({ ok: false, error: { code: "invalid" } });
    for (const role of ["admin", "modeler", "reader"]) expect(addPerson(makeCtx(), state, { ...input, role }).ok).toBe(true);
  });

  it("is for owners and admins, and never in an archived workspace", () => {
    for (const role of ["modeler", "reviewer", "reader"] as const) {
      expect(addPerson(makeCtx(), { ...state, access: access(role) }, input)).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
    expect(addPerson(makeCtx(), { ...state, access: access("owner", archived) }, input)).toMatchObject({ ok: false, error: { message: ARCHIVED_MESSAGE } });
  });

  it("checks the name and the e-mail address", () => {
    expect(checkAddPerson(state, { ...input, name: " " })).toMatchObject({ ok: false, error: { message: "Enter a name." } });
    expect(checkAddPerson(state, { ...input, email: "" })).toMatchObject({ ok: false, error: { message: "Enter an e-mail address." } });
    expect(checkAddPerson(state, { ...input, email: "jan" })).toMatchObject({ ok: false, error: { message: "Enter a valid e-mail address." } });
  });
});

const row = (userId: string, role: WorkspaceRole): WorkspaceMember => member(role, { user_id: userId });

describe("changeRole (item 11, F12)", () => {
  const members = [row(ids.actor, "owner"), row(ids.someoneElse, "modeler")];
  const state = { access: access("owner"), person: anna, members };
  const input = (role: WorkspaceRole, userId: string = anna.id) => ({ workspaceId: ids.ws, userId, role });

  it("updates the membership's role, with the prototype's toast", () => {
    const r = changeRole(makeCtx(), state, input("reviewer"));
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toEqual([{ kind: "update", table: "workspace_member", before: members[1], row: { ...members[1], role: "reviewer" } }]);
    expect(r.writeSet.events[0]).toMatchObject({ object_type: "workspace_member", object_id: anna.id, operation: "update", workspace_id: ids.ws });
    expect(r.value.toast).toBe("Anna Nowak is now Reviewer.");
  });

  it("only an owner gives Owner, and an admin cannot change an owner", () => {
    const asAdmin = { ...state, access: access("admin"), members: [row(ids.actor, "admin"), row(ids.someoneElse, "modeler"), row(third, "owner")] };
    expect(changeRole(makeCtx(), asAdmin, input("owner"))).toMatchObject({ ok: false, error: { message: OWNER_ONLY_GIVE_MESSAGE } });
    const owner = { ...anna, id: third };
    expect(changeRole(makeCtx(), { ...asAdmin, person: owner }, input("admin", third))).toMatchObject({ ok: false, error: { message: OWNER_ONLY_CHANGE_MESSAGE } });
    expect(changeRole(makeCtx(), asAdmin, input("reader")).ok).toBe(true);
    expect(changeRole(makeCtx(), state, input("owner")).ok).toBe(true);
  });

  it("nobody changes their own role", () => {
    const me = { ...anna, id: ids.actor };
    expect(changeRole(makeCtx(), { ...state, person: me }, input("admin", ids.actor))).toMatchObject({ ok: false, error: { message: OWN_ROLE_MESSAGE } });
  });

  it("the last owner keeps the role", () => {
    // reachable only when the stored rows say the actor is an owner but not in the list (a defence for the server)
    const lone = { ...state, members: [row(ids.someoneElse, "owner")] };
    expect(changeRole(makeCtx(), lone, input("admin"))).toMatchObject({ ok: false, error: { message: "Retail Co – DWH needs at least one owner." } });
  });

  it("refuses an unchanged role, someone not in the workspace, and roles without people rights", () => {
    expect(changeRole(makeCtx(), state, input("modeler"))).toMatchObject({ ok: false, error: { message: "Anna Nowak is Modeler already." } });
    expect(changeRole(makeCtx(), { ...state, members: [row(ids.actor, "owner")] }, input("reader"))).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(changeRole(makeCtx(), { ...state, access: access("modeler") }, input("reader"))).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("removePerson (item 12, P7, F9, F12)", () => {
  const members = [row(ids.actor, "owner"), row(ids.someoneElse, "modeler")];
  const state: RemovePersonState = {
    access: access("owner"),
    person: anna,
    members,
    organization: organization(),
    personOrganizationMember: organizationMember({ user_id: anna.id }),
    personOtherWorkspaceIds: [otherWs],
  };
  const input = (userId: string = anna.id) => ({ workspaceId: ids.ws, userId });

  it("removes the workspace membership; the organization membership stays while another workspace is left", () => {
    const r = removePerson(makeCtx(), state, input());
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toEqual([{ kind: "remove", table: "workspace_member", before: members[1] }]);
    expect(r.writeSet.events[0]).toMatchObject({ operation: "delete", object_id: anna.id, after_image: null });
    expect(r.value).toEqual({ confirmation: ["Anna Nowak loses access to Retail Co – DWH."], leavesOrganization: false, toast: "Anna Nowak no longer has access." });
  });

  it("from the last workspace, a member or an admin leaves the organization too, and the confirmation says so", () => {
    for (const role of ["member", "admin"] as const) {
      const last = { ...state, personOrganizationMember: organizationMember({ user_id: anna.id, role }), personOtherWorkspaceIds: [] };
      const r = removePerson(makeCtx(), last, input());
      if (!r.ok) throw new Error(r.error.message);
      expect(r.writeSet.writes.map((w) => `${w.kind}:${w.table}`)).toEqual(["remove:workspace_member", "remove:organization_member"]);
      expect(r.value.confirmation).toEqual([
        "Anna Nowak loses access to Retail Co – DWH.",
        "They are in no other workspace of InfoMate, so they leave InfoMate too.",
      ]);
      expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    }
  });

  it("a guest's last workspace removes only the workspace membership", () => {
    const guest = { ...state, personOrganizationMember: null, personOtherWorkspaceIds: [] };
    const r = removePerson(makeCtx(), guest, input());
    expect(r.ok && r.writeSet.writes.map((w) => w.table)).toEqual(["workspace_member"]);
    expect(r.ok && r.value.leavesOrganization).toBe(true);
  });

  it("refuses removing the organization's owner from their last workspace there (F9)", () => {
    const owner = { ...state, personOrganizationMember: organizationMember({ user_id: anna.id, role: "owner" }), personOtherWorkspaceIds: [] };
    expect(checkRemovePerson(makeCtx(), owner, input())).toEqual({
      ok: false,
      error: { code: "invalid", message: "Anna Nowak owns InfoMate, so they keep at least one workspace there." },
    });
    expect(removePerson(makeCtx(), { ...owner, personOtherWorkspaceIds: [otherWs] }, input()).ok).toBe(true);
  });

  it("nobody removes themselves; an admin cannot remove an owner; the last owner stays", () => {
    const me = { ...state, person: { ...anna, id: ids.actor }, personOrganizationMember: organizationMember() };
    expect(removePerson(makeCtx(), me, input(ids.actor))).toMatchObject({ ok: false, error: { message: OWN_REMOVAL_MESSAGE } });
    const asAdmin = { ...state, access: access("admin"), members: [row(ids.actor, "admin"), row(ids.someoneElse, "owner")] };
    expect(removePerson(makeCtx(), asAdmin, input())).toMatchObject({ ok: false, error: { message: OWNER_ONLY_REMOVE_MESSAGE } });
    const lone = { ...state, members: [row(ids.someoneElse, "owner")] };
    expect(removePerson(makeCtx(), lone, input())).toMatchObject({ ok: false, error: { message: "Retail Co – DWH needs at least one owner." } });
  });

  it("is refused to modelers, reviewers and readers, and in an archived workspace", () => {
    expect(removePerson(makeCtx(), { ...state, access: access("reviewer") }, input())).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(removePerson(makeCtx(), { ...state, access: access("owner", archived) }, input())).toMatchObject({ ok: false, error: { message: ARCHIVED_MESSAGE } });
  });
});
