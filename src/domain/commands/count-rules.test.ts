import { describe, expect, it } from "vitest";
import type { Write } from "../changes";
import { countChecks, countRefusal, needsOrganizationLock, type CountRows } from "./count-rules";

const O = "org-1";
const W1 = "ws-1";
const W2 = "ws-2";
const U = "user-1";
const V = "user-2";

function rows(patch: Partial<CountRows> = {}): CountRows {
  return {
    workspace: [
      { id: W1, name: "One", organization_id: O, infocube: true, deleted_at: null },
      { id: W2, name: "Two", organization_id: O, infocube: true, deleted_at: null },
    ],
    workspace_member: [
      { workspace_id: W1, user_id: U, role: "owner" },
      { workspace_id: W1, user_id: V, role: "owner" },
    ],
    project: [{ id: "p1", workspace_id: W1, deleted_at: null }],
    entity: [],
    canvas: [{ id: "c1", deleted_at: null }],
    project_canvas: [{ project_id: "p1", canvas_id: "c1" }],
    organization: [{ id: O, name: "InfoMate" }],
    organization_member: [],
    app_user: [
      { id: U, display_name: "Anna" },
      { id: V, display_name: "Marek" },
    ],
    ...patch,
  };
}

const member = (workspace_id: string, user_id: string, role = "modeler") => ({ workspace_id, user_id, role, added_by: null, created_at: "t" });
const w = (x: unknown) => x as Write;

describe("the count rules inside the write (slice 30, F5)", () => {
  it("needs no check for a write that touches nothing counted", () => {
    expect(countChecks([w({ kind: "insert", table: "note", row: { id: "n", workspace_id: W1 } })])).toEqual([]);
  });

  it("last owner: a workspace with members and no owner is refused", () => {
    const checks = countChecks([w({ kind: "update", table: "workspace_member", before: member(W1, U, "owner"), row: member(W1, U, "admin") })]);
    expect(countRefusal(rows(), checks)).toBeNull();
    const after = rows({ workspace_member: [{ workspace_id: W1, user_id: U, role: "admin" }, { workspace_id: W1, user_id: V, role: "admin" }] });
    expect(countRefusal(after, checks)).toEqual({ code: "invalid", message: "One needs at least one owner." });
  });

  it("last project: deleting the last live project is refused", () => {
    const checks = countChecks([w({ kind: "update", table: "project", before: { id: "p1", workspace_id: W1, deleted_at: null }, row: { id: "p1", workspace_id: W1, deleted_at: "t" } })]);
    expect(countRefusal(rows({ project: [{ id: "p1", workspace_id: W1, deleted_at: "t" }] }), checks)).toEqual({
      code: "invalid",
      message: "A workspace needs at least one project.",
    });
    expect(countRefusal(rows({ project: [{ id: "p1", workspace_id: W1, deleted_at: "t" }, { id: "p2", workspace_id: W1, deleted_at: null }] }), checks)).toBeNull();
  });

  it("InfoCube off: the turn-off and a create each get their own refusal", () => {
    const off = rows({
      workspace: [{ id: W1, name: "One", organization_id: O, infocube: false, deleted_at: null }],
      entity: [{ workspace_id: W1, deleted_at: null, model_level: "dimensional" }],
    });
    const turnOff = countChecks([w({ kind: "update", table: "workspace", before: { id: W1 }, row: { id: W1 } })]);
    expect(countRefusal(off, turnOff)?.code).toBe("invalid");
    const create = countChecks([w({ kind: "insert", table: "entity", row: { id: "e", workspace_id: W1 } })]);
    expect(countRefusal(off, create)?.code).toBe("forbidden");
    expect(countRefusal(rows({ entity: [{ workspace_id: W1, deleted_at: null, model_level: "logical" }] }), create)).toBeNull();
  });

  it("canvas links (D-28): a live canvas keeps a project and a live project keeps a canvas", () => {
    const removed = countChecks([w({ kind: "remove", table: "project_canvas", before: { project_id: "p1", canvas_id: "c1", workspace_id: W1 } })]);
    // the canvas left in no project
    expect(countRefusal(rows({ project_canvas: [] }), removed)?.message).toBe("A canvas belongs to at least one project.");
    // the canvas in another project, but the project left with no canvas
    const elsewhere = rows({ project: [{ id: "p1", workspace_id: W1, deleted_at: null }, { id: "p2", workspace_id: W1, deleted_at: null }], project_canvas: [{ project_id: "p2", canvas_id: "c1" }] });
    expect(countRefusal(elsewhere, removed)?.message).toBe("This project would have no canvas left.");
    // a deleted project and a deleted canvas count for nothing
    expect(countRefusal(rows({ project: [{ id: "p1", workspace_id: W1, deleted_at: "t" }, { id: "p0", workspace_id: W1, deleted_at: null }], canvas: [{ id: "c1", deleted_at: "t" }], project_canvas: [] }), removed)).toBeNull();
  });

  it("an organization's owner keeps a workspace there, across workspaces", () => {
    const removal = [w({ kind: "remove", table: "workspace_member", before: member(W2, U) })];
    expect(needsOrganizationLock(removal)).toBe(true);
    const checks = countChecks(removal);
    const owner = { organization_member: [{ organization_id: O, user_id: U, role: "owner" as const }] };
    // still in W1: allowed
    expect(countRefusal(rows(owner), checks)).toBeNull();
    // W1 gone meanwhile (another removal): refused with the command's message
    expect(countRefusal(rows({ ...owner, workspace_member: [{ workspace_id: W1, user_id: V, role: "owner" }] }), checks)).toEqual({
      code: "invalid",
      message: "Anna owns InfoMate, so they keep at least one workspace there.",
    });
  });

  it("an organization member's row goes with their last workspace there, and only then", () => {
    const keepsRow = countChecks([w({ kind: "remove", table: "workspace_member", before: member(W2, U) })]);
    const asMember = { organization_member: [{ organization_id: O, user_id: U, role: "member" as const }] };
    // another removal took W1 meanwhile: the row would stay without a workspace, so the write is built again
    expect(countRefusal(rows({ ...asMember, workspace_member: [] }), keepsRow)?.code).toBe("stale_version");
    expect(countRefusal(rows(asMember), keepsRow)).toBeNull();
    // the row removed with what the command took for the last workspace, while the person was added to another meanwhile
    const dropsRow = countChecks([
      w({ kind: "remove", table: "workspace_member", before: member(W2, U) }),
      w({ kind: "remove", table: "organization_member", before: { organization_id: O, user_id: U, role: "member", created_at: "t" } }),
    ]);
    expect(countRefusal(rows({ organization_member: [] }), dropsRow)?.code).toBe("stale_version");
    expect(countRefusal(rows({ organization_member: [], workspace_member: [] }), dropsRow)).toBeNull();
  });

  it("a write within one workspace needs no organization lock", () => {
    expect(needsOrganizationLock([w({ kind: "update", table: "project", before: {}, row: {} })])).toBe(false);
  });
});
