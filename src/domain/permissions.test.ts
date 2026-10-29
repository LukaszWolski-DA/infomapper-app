import { describe, expect, it } from "vitest";
import { access, archived, ids, organization, organizationMember, workspace } from "./__fixtures__/domain";
import { ARCHIVED_MESSAGE } from "./errors";
import {
  can,
  checkCreateWorkspace,
  checkOrganizationAccess,
  checkPermission,
  isGuest,
  WORKSPACE_ACTIONS,
  type WorkspaceAction,
} from "./permissions";
import { WORKSPACE_ROLES, type WorkspaceRole } from "./types";

// Expected matrix (AD-05, prototype "What each role can do").
const expected: Record<WorkspaceRole, WorkspaceAction[]> = {
  owner: [...WORKSPACE_ACTIONS].filter((a) => a !== "workspace.unarchive"),
  admin: [
    "workspace.view", "workspace.edit_settings", "project.create", "project.edit", "canvas.create", "canvas.rename", "canvas.edit_projects",
    "canvas.edit_items", "canvas.edit_look", "canvas.delete", "model.edit", "mapping.set_status", "label.edit", "note.edit",
    "requirement.edit", "requirement.set_status", "people.edit",
  ],
  modeler: [
    "workspace.view", "project.create", "project.edit", "canvas.create", "canvas.rename", "canvas.edit_projects", "canvas.edit_items",
    "canvas.edit_look", "canvas.delete", "model.edit", "mapping.set_status", "label.edit", "note.edit",
    "requirement.edit", "requirement.set_status",
  ],
  // Slice 3a: reviewers work on notes as modelers do (Łukasz's step 0 answer 1); labels are for editors (answer 2).
  // Slice 4a: reviewers change a requirement's status only (AD-05).
  reviewer: ["workspace.view", "mapping.set_status", "note.edit", "requirement.set_status"],
  reader: ["workspace.view"],
};

describe("role permissions (AD-05)", () => {
  for (const role of WORKSPACE_ROLES) {
    for (const action of WORKSPACE_ACTIONS) {
      const allowed = expected[role].includes(action);
      it(`${role} ${allowed ? "may" : "may not"} ${action}`, () => {
        expect(can(access(role), action)).toBe(allowed);
      });
    }
  }

  it("names the role and the action when refusing", () => {
    expect(checkPermission(access("reviewer"), "project.create")).toEqual({
      code: "forbidden",
      message: "As a reviewer you cannot create projects.",
    });
    expect(checkPermission(access("admin"), "workspace.archive")?.message).toBe("As an admin you cannot archive this workspace.");
    expect(checkPermission(access("reviewer"), "label.edit")?.message).toBe("As a reviewer you cannot change labels.");
    expect(checkPermission(access("reader"), "note.edit")?.message).toBe("As a reader you cannot change notes.");
  });

  it("words the requirement refusals for the role (slice 4a, PRD item 12)", () => {
    expect(checkPermission(access("reviewer"), "requirement.edit")?.message).toBe("As a reviewer you can only change a requirement's status.");
    expect(checkPermission(access("reader"), "requirement.edit")?.message).toBe("As a reader you cannot change requirements.");
    expect(checkPermission(access("reader"), "requirement.set_status")?.message).toBe("As a reader you cannot change requirements.");
    expect(checkPermission(access("owner", { archived_at: "2026-10-01T00:00:00.000Z" }), "requirement.set_status")?.message).toBe(ARCHIVED_MESSAGE);
  });

  it("refuses everything to non-members", () => {
    for (const action of WORKSPACE_ACTIONS) {
      expect(checkPermission(access(null), action)?.code).toBe("forbidden");
    }
  });

  it("does not accept a membership of another workspace", () => {
    const a = access("owner");
    a.member = { ...a.member!, workspace_id: ids.otherOrg };
    expect(checkPermission(a, "workspace.view")?.code).toBe("forbidden");
  });

  it("treats a deleted workspace as not found", () => {
    expect(checkPermission(access("owner", { deleted_at: "2026-10-01T00:00:00.000Z" }), "workspace.view")?.code).toBe(
      "not_found",
    );
  });
});

describe("archived workspace (AD-09)", () => {
  it("refuses every change, for every role, with the archived message", () => {
    for (const role of WORKSPACE_ROLES) {
      for (const action of WORKSPACE_ACTIONS.filter((a) => a !== "workspace.view" && a !== "workspace.unarchive")) {
        expect(checkPermission(access(role, archived), action)).toEqual({ code: "archived", message: ARCHIVED_MESSAGE });
      }
    }
  });

  it("can still be viewed by every member", () => {
    for (const role of WORKSPACE_ROLES) expect(can(access(role, archived), "workspace.view")).toBe(true);
  });

  it("can be unarchived by the owner only", () => {
    expect(can(access("owner", archived), "workspace.unarchive")).toBe(true);
    for (const role of WORKSPACE_ROLES.filter((r) => r !== "owner")) {
      expect(checkPermission(access(role, archived), "workspace.unarchive")?.code).toBe("forbidden");
    }
  });

  it("cannot unarchive a workspace that is not archived", () => {
    expect(checkPermission(access("owner"), "workspace.unarchive")?.code).toBe("invalid");
  });
});

describe("creating a workspace", () => {
  it("is allowed to members of the organization, whatever their organization role", () => {
    for (const role of ["owner", "admin", "member"] as const) {
      expect(checkCreateWorkspace(ids.org, organizationMember({ role }))).toBeNull();
    }
  });

  it("is refused to people outside the organization (guests)", () => {
    expect(checkCreateWorkspace(ids.org, null)?.code).toBe("forbidden");
    expect(checkCreateWorkspace(ids.org, organizationMember({ organization_id: ids.otherOrg }))?.code).toBe("forbidden");
  });
});

describe("guests (AD-01)", () => {
  const ws = workspace();
  it("a member of the workspace's organization is not a guest", () => {
    expect(isGuest(ws, ids.actor, [organizationMember()])).toBe(false);
  });

  it("a member of another organization only is a guest", () => {
    expect(isGuest(ws, ids.actor, [organizationMember({ organization_id: ids.otherOrg })])).toBe(true);
    expect(isGuest(ws, ids.actor, [])).toBe(true);
  });
});

describe("people (slice 8)", () => {
  it("modelers, reviewers and readers are told they cannot change who has access", () => {
    expect(checkPermission(access("modeler"), "people.edit")?.message).toBe("As a modeler you cannot change who has access.");
    expect(checkPermission(access("reader"), "people.edit")?.message).toBe("As a reader you cannot change who has access.");
  });

  it("an archived workspace refuses people changes (AD-09)", () => {
    expect(checkPermission(access("owner", archived), "people.edit")?.message).toBe(ARCHIVED_MESSAGE);
  });
});

describe("changing the organization's password (slice 8, P8, F17)", () => {
  const org = organization();

  it("is for the organization's owners and admins, whatever their role in the workspace", () => {
    for (const role of ["owner", "admin"] as const) {
      expect(checkOrganizationAccess(access("reader"), org, organizationMember({ role }))).toBeNull();
    }
  });

  it("is refused to its members, to guests and to people of another organization", () => {
    const text = "Only the owners and admins of InfoMate can change its password.";
    expect(checkOrganizationAccess(access("owner"), org, organizationMember({ role: "member" }))?.message).toBe(text);
    expect(checkOrganizationAccess(access("owner"), org, null)?.message).toBe(text);
    expect(checkOrganizationAccess(access("owner"), org, organizationMember({ role: "owner", organization_id: ids.otherOrg }))?.message).toBe(text);
  });

  it("needs a membership of the workspace, which must belong to the organization", () => {
    expect(checkOrganizationAccess(access(null), org, organizationMember({ role: "owner" }))?.code).toBe("forbidden");
    expect(checkOrganizationAccess(access("owner", { organization_id: ids.otherOrg }), org, organizationMember({ role: "owner" }))?.code).toBe("not_found");
  });

  it("is refused from an archived workspace", () => {
    expect(checkOrganizationAccess(access("owner", archived), org, organizationMember({ role: "owner" }))?.message).toBe(ARCHIVED_MESSAGE);
  });
});
