import { describe, expect, it } from "vitest";
import { access, archived, ids, organizationMember, workspace } from "./__fixtures__/domain";
import { ARCHIVED_MESSAGE } from "./errors";
import { can, checkCreateWorkspace, checkPermission, isGuest, WORKSPACE_ACTIONS, type WorkspaceAction } from "./permissions";
import { WORKSPACE_ROLES, type WorkspaceRole } from "./types";

// Expected matrix (AD-05, prototype "What each role can do").
const expected: Record<WorkspaceRole, WorkspaceAction[]> = {
  owner: [...WORKSPACE_ACTIONS].filter((a) => a !== "workspace.unarchive"),
  admin: [
    "workspace.view", "workspace.edit_settings", "project.create", "canvas.create", "canvas.rename", "canvas.edit_projects",
    "canvas.edit_items", "canvas.edit_look", "canvas.delete", "model.edit", "mapping.set_status", "label.edit", "note.edit",
  ],
  modeler: [
    "workspace.view", "project.create", "canvas.create", "canvas.rename", "canvas.edit_projects", "canvas.edit_items",
    "canvas.edit_look", "canvas.delete", "model.edit", "mapping.set_status", "label.edit", "note.edit",
  ],
  // Slice 3a: reviewers work on notes as modelers do (Łukasz's step 0 answer 1); labels are for editors (answer 2).
  reviewer: ["workspace.view", "mapping.set_status", "note.edit"],
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
