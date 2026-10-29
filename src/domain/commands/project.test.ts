import { describe, expect, it } from "vitest";
import { access, archived, ids, makeCtx, NOW, project } from "../__fixtures__/domain";
import { STALE_VERSION_MESSAGE } from "../errors";
import { changeLabel } from "../model/change-label";
import { createProject, PROJECT_NAME_REQUIRED, updateProject } from "./project";
import { FIRST_CANVAS_NAME } from "./workspace";

describe("createProject", () => {
  it("creates the project with a first canvas, in one change group", () => {
    const r = createProject(makeCtx(), access("modeler"), { workspaceId: ids.ws, name: " Finance " });
    if (!r.ok) throw new Error(r.error.message);
    const { writes, events, changeGroupId } = r.writeSet;
    expect(writes.map((w) => `${w.kind}:${w.table}`)).toEqual(["insert:project", "insert:canvas", "insert:project_canvas"]);
    expect(writes[0]).toMatchObject({ row: { id: r.value.projectId, workspace_id: ids.ws, name: "Finance", version: 1, created_at: NOW } });
    expect(writes[1]).toMatchObject({ row: { id: r.value.canvasId, name: FIRST_CANVAS_NAME, look: { background: "grey", grid: "dots", layer: "all" } } });
    expect(writes[2]).toMatchObject({ row: { project_id: r.value.projectId, canvas_id: r.value.canvasId, sort_order: 0, added_by: ids.actor } });
    expect(events.map((e) => e.operation)).toEqual(["create", "create", "create"]);
    expect(new Set(events.map((e) => e.change_group_id))).toEqual(new Set([changeGroupId]));
  });

  it("is allowed to owner, admin and modeler only", () => {
    for (const role of ["owner", "admin", "modeler"] as const) {
      expect(createProject(makeCtx(), access(role), { workspaceId: ids.ws, name: "P" }).ok).toBe(true);
    }
    for (const role of ["reviewer", "reader"] as const) {
      expect(createProject(makeCtx(), access(role), { workspaceId: ids.ws, name: "P" })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
  });

  it("is refused in an archived workspace", () => {
    expect(createProject(makeCtx(), access("owner", archived), { workspaceId: ids.ws, name: "P" })).toMatchObject({ ok: false, error: { code: "archived" } });
  });

  it("needs a name and the right workspace", () => {
    expect(createProject(makeCtx(), access("owner"), { workspaceId: ids.ws, name: "" })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(createProject(makeCtx(), access("owner"), { workspaceId: ids.org, name: "P" })).toMatchObject({ ok: false, error: { code: "not_found" } });
  });
});

describe("updateProject (slice 9, D-59)", () => {
  const state = { project: project(ids.projectA) };
  const ref = { projectId: ids.projectA, expectedVersion: 1 };

  it("renames, bumps the version and logs before and after, in one change group", () => {
    const r = updateProject(makeCtx(), access("modeler"), state, { ...ref, name: "  Customer 360 2026 " });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.project).toEqual({ ...project(ids.projectA), name: "Customer 360 2026", version: 2, updated_at: NOW, updated_by: ids.actor });
    expect(r.writeSet.events).toMatchObject([
      { operation: "update", object_type: "project", object_id: ids.projectA, before_image: { name: "Customer 360", version: 1 }, after_image: { name: "Customer 360 2026", version: 2 } },
    ]);
    expect(changeLabel(r.writeSet.events)).toBe("Rename project");
  });

  it("keeps the description's lines, trims it and stores an empty one as null", () => {
    const r = updateProject(makeCtx(), access("owner"), state, { ...ref, description: "  One line.\nAnother line.  " });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.project).toMatchObject({ name: "Customer 360", description: "One line.\nAnother line." });
    expect(changeLabel(r.writeSet.events)).toBe("Change project");
    const emptied = updateProject(makeCtx(), access("owner"), { project: project(ids.projectA, { description: "Old" }) }, { ...ref, description: "   " });
    if (!emptied.ok) throw new Error(emptied.error.message);
    expect(emptied.value.project.description).toBeNull();
  });

  it("refuses an empty name with D-59's text; no length rule; the same name as another project is fine (F9)", () => {
    expect(updateProject(makeCtx(), access("owner"), state, { ...ref, name: "   " })).toEqual({
      ok: false,
      error: { code: "invalid", message: PROJECT_NAME_REQUIRED, fields: { name: PROJECT_NAME_REQUIRED } },
    });
    expect(PROJECT_NAME_REQUIRED).toBe("A project needs a name.");
    expect(updateProject(makeCtx(), access("owner"), state, { ...ref, name: "x".repeat(500) }).ok).toBe(true);
    expect(updateProject(makeCtx(), access("owner"), state, { ...ref, name: "Order management" }).ok).toBe(true);
  });

  it("refuses nothing to change, a stale version and a deleted project", () => {
    expect(updateProject(makeCtx(), access("owner"), state, { ...ref, name: "Customer 360", description: "" })).toMatchObject({ ok: false, error: { code: "invalid", message: "Nothing to change." } });
    expect(updateProject(makeCtx(), access("owner"), state, ref)).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(updateProject(makeCtx(), access("owner"), state, { ...ref, expectedVersion: 2, name: "X" })).toEqual({ ok: false, error: { code: "stale_version", message: STALE_VERSION_MESSAGE } });
    expect(updateProject(makeCtx(), access("owner"), { project: project(ids.projectA, { deleted_at: NOW }) }, { ...ref, name: "X" })).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("is allowed to owner, admin and modeler only, and refused in an archived workspace", () => {
    for (const role of ["owner", "admin", "modeler"] as const) expect(updateProject(makeCtx(), access(role), state, { ...ref, name: "X" }).ok).toBe(true);
    for (const role of ["reviewer", "reader"] as const) {
      expect(updateProject(makeCtx(), access(role), state, { ...ref, name: "X" })).toMatchObject({ ok: false, error: { code: "forbidden", message: expect.stringContaining("edit projects") } });
    }
    expect(updateProject(makeCtx(), access("owner", archived), state, { ...ref, name: "X" })).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});
