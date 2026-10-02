import { describe, expect, it } from "vitest";
import { access, archived, ids, makeCtx, NOW } from "../__fixtures__/domain";
import { createProject } from "./project";
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
