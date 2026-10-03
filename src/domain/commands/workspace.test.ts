import { describe, expect, it } from "vitest";
import { access, archived, ids, makeCtx, NOW, organization, organizationMember, workspace } from "../__fixtures__/domain";
import { STALE_VERSION_MESSAGE } from "../errors";
import { WORKSPACE_ROLES } from "../types";
import {
  archiveWorkspace,
  createWorkspace,
  FIRST_CANVAS_NAME,
  FIRST_PROJECT_NAME,
  unarchiveWorkspace,
  updateWorkspaceSettings,
} from "./workspace";

describe("createWorkspace", () => {
  const state = { organization: organization(), organizationMember: organizationMember() };

  it("creates the workspace, the creator as owner, a first project and a first canvas in one change group", () => {
    const ctx = makeCtx();
    const r = createWorkspace(ctx, state, { organizationId: ids.org, name: "  Insurance DWH " });
    if (!r.ok) throw new Error(r.error.message);
    const { writes, events, changeGroupId } = r.writeSet;

    expect(writes.map((w) => `${w.kind}:${w.table}`)).toEqual([
      "insert:workspace",
      "insert:workspace_member",
      "insert:project",
      "insert:canvas",
      "insert:project_canvas",
    ]);
    const [ws, mem, proj, canv, link] = writes.map((w) => (w.kind === "insert" ? w.row : null)) as never[];
    expect(ws).toMatchObject({
      id: r.value.workspaceId,
      organization_id: ids.org,
      name: "Insurance DWH",
      doc_language: "en",
      dv2_mode: false,
      four_eyes: false,
      archived_at: null,
      requirement_key_next: 101,
      version: 1,
      created_by: ids.actor,
      created_at: NOW,
      deleted_at: null,
    });
    expect(mem).toEqual({ workspace_id: r.value.workspaceId, user_id: ids.actor, role: "owner", added_by: ids.actor, created_at: NOW });
    expect(proj).toMatchObject({ id: r.value.projectId, workspace_id: r.value.workspaceId, name: FIRST_PROJECT_NAME });
    expect(canv).toMatchObject({ id: r.value.canvasId, workspace_id: r.value.workspaceId, name: FIRST_CANVAS_NAME });
    expect(link).toMatchObject({ project_id: r.value.projectId, canvas_id: r.value.canvasId, sort_order: 0 });

    expect(events).toHaveLength(5);
    for (const e of events) {
      expect(e).toMatchObject({
        change_group_id: changeGroupId,
        workspace_id: r.value.workspaceId,
        operation: "create",
        before_image: null,
        user_id: ids.actor,
        occurred_at: NOW,
        context_label_id: null,
      });
      expect(e.after_image).not.toBeNull();
    }
    expect(events[0]!.after_image).toEqual(ws);
    expect(events[1]!.object_id).toBe(ids.actor);
    expect(events[4]!.object_id).toBe(r.value.canvasId);
  });

  it("is refused to someone outside the organization", () => {
    const r = createWorkspace(makeCtx(), { ...state, organizationMember: null }, { organizationId: ids.org, name: "X" });
    expect(r.ok || r.error.code).toBe("forbidden");
  });

  it("needs a name", () => {
    const r = createWorkspace(makeCtx(), state, { organizationId: ids.org, name: "   " });
    expect(r.ok || r.error).toMatchObject({ code: "invalid", fields: { name: "Enter a name." } });
  });

  it("refuses an unknown or deleted organization", () => {
    expect(createWorkspace(makeCtx(), { ...state, organization: null }, { organizationId: ids.org, name: "X" })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    const deleted = { ...state, organization: organization({ deleted_at: NOW }) };
    expect(createWorkspace(makeCtx(), deleted, { organizationId: ids.org, name: "X" })).toMatchObject({ ok: false });
    expect(createWorkspace(makeCtx(), state, { organizationId: ids.otherOrg, name: "X" })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
  });
});

describe("updateWorkspaceSettings", () => {
  const input = { workspaceId: ids.ws, expectedVersion: 3, name: "Retail DWH", clientName: "", docLanguage: "pl", dv2Mode: true, fourEyes: true };

  it("updates the settings, bumps the version and logs before and after", () => {
    const ctx = makeCtx();
    const r = updateWorkspaceSettings(ctx, access("admin"), input);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.workspace).toMatchObject({
      name: "Retail DWH",
      client_name: null,
      doc_language: "pl",
      dv2_mode: true,
      four_eyes: true,
      description: null,
      version: 4,
      updated_at: NOW,
      updated_by: ids.actor,
    });
    const [event] = r.writeSet.events;
    expect(r.writeSet.events).toHaveLength(1);
    expect(event).toMatchObject({ operation: "update", object_type: "workspace", object_id: ids.ws, change_group_id: r.writeSet.changeGroupId });
    expect(event!.before_image).toEqual(workspace());
    expect(event!.after_image).toEqual(r.value.workspace);
  });

  it("changes only the fields that are given", () => {
    const r = updateWorkspaceSettings(makeCtx(), access("owner"), { workspaceId: ids.ws, expectedVersion: 3, fourEyes: true });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.workspace).toEqual({ ...workspace(), four_eyes: true, version: 4, updated_at: NOW, updated_by: ids.actor });
  });

  it("refuses a stale version without writing anything", () => {
    const r = updateWorkspaceSettings(makeCtx(), access("owner"), { ...input, expectedVersion: 2 });
    expect(r).toEqual({ ok: false, error: { code: "stale_version", message: STALE_VERSION_MESSAGE } });
  });

  it("is refused to modelers, reviewers and readers", () => {
    for (const role of ["modeler", "reviewer", "reader"] as const) {
      expect(updateWorkspaceSettings(makeCtx(), access(role), input)).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
  });

  it("is refused in an archived workspace", () => {
    expect(updateWorkspaceSettings(makeCtx(), access("owner", archived), input)).toMatchObject({ ok: false, error: { code: "archived" } });
  });

  it("validates the input", () => {
    const bad = [
      { ...input, name: "" },
      { ...input, docLanguage: "fr" },
      { ...input, expectedVersion: 0 },
      { ...input, unknownField: 1 },
      { ...input, workspaceId: "nope" },
    ];
    for (const b of bad) expect(updateWorkspaceSettings(makeCtx(), access("owner"), b)).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("refuses an input for another workspace", () => {
    const r = updateWorkspaceSettings(makeCtx(), access("owner"), { ...input, workspaceId: ids.org });
    expect(r).toMatchObject({ ok: false, error: { code: "not_found" } });
  });
});

describe("archiveWorkspace and unarchiveWorkspace (AD-09)", () => {
  it("the owner archives: archived_at and archived_by are set", () => {
    const r = archiveWorkspace(makeCtx(), access("owner"), { workspaceId: ids.ws, expectedVersion: 3 });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.workspace).toMatchObject({ archived_at: NOW, archived_by: ids.actor, version: 4 });
    expect(r.writeSet.events[0]).toMatchObject({ operation: "update", before_image: { archived_at: null } });
  });

  it("the owner unarchives: archived_at and archived_by are cleared", () => {
    const r = unarchiveWorkspace(makeCtx(), access("owner", archived), { workspaceId: ids.ws, expectedVersion: 3 });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.workspace).toMatchObject({ archived_at: null, archived_by: null, version: 4 });
  });

  it("nobody but the owner may archive or unarchive", () => {
    for (const role of WORKSPACE_ROLES.filter((x) => x !== "owner")) {
      expect(archiveWorkspace(makeCtx(), access(role), { workspaceId: ids.ws, expectedVersion: 3 })).toMatchObject({ ok: false, error: { code: "forbidden" } });
      expect(unarchiveWorkspace(makeCtx(), access(role, archived), { workspaceId: ids.ws, expectedVersion: 3 })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
  });

  it("an archived workspace cannot be archived again", () => {
    expect(archiveWorkspace(makeCtx(), access("owner", archived), { workspaceId: ids.ws, expectedVersion: 3 })).toMatchObject({ ok: false, error: { code: "archived" } });
  });

  it("refuses a stale version", () => {
    expect(archiveWorkspace(makeCtx(), access("owner"), { workspaceId: ids.ws, expectedVersion: 1 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(unarchiveWorkspace(makeCtx(), access("owner", archived), { workspaceId: ids.ws, expectedVersion: 4 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
  });
});
