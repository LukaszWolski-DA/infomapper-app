import { describe, expect, it } from "vitest";
import { access, archived, canvas, canvasItem, frame, ids, link, makeCtx, note, NOW, pin, project } from "../__fixtures__/domain";
import type { Write } from "../changes";
import { STALE_VERSION_MESSAGE } from "../errors";
import { changeLabel } from "../model/change-label";
import type { WorkspaceRole } from "../types";
import { createProject, deleteProject, LAST_PROJECT_MESSAGE, PROJECT_NAME_REQUIRED, updateProject, type DeleteProjectState } from "./project";
import { isUndoable } from "./undo";
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
    // named by the command (slice 12a, F4): by its events the group read "Create canvas"
    expect(r.writeSet.label).toBe("Create project");
    expect(changeLabel(events)).toBe("Create canvas");
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
    expect(changeLabel(r.writeSet.events)).toBe("Change project description");
    const both = updateProject(makeCtx(), access("owner"), state, { ...ref, name: "P", description: "D" });
    if (!both.ok) throw new Error(both.error.message);
    expect(changeLabel(both.writeSet.events)).toBe("Change project");
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

describe("deleteProject (slice 12a, D-65)", () => {
  const canvas3 = "01900000-0000-7000-8000-000000002003";
  const reqCard = "01900000-0000-7000-8000-00000000c003";
  const sharedCard = "01900000-0000-7000-8000-00000000c004";
  /**
   * Project A has canvas 1 (only A: a card, a requirement card, a frame, a note), canvas 2 (shared with B, a card) and
   * canvas 3 (only A, CR-23's live canvas). A pins CR-23, B pins JIRA-481.
   */
  const world = (over: Partial<DeleteProjectState> = {}): DeleteProjectState => ({
    project: project(ids.projectA),
    projects: [project(ids.projectA), project(ids.projectB)],
    links: [link(ids.projectA, ids.canvas1, 0), link(ids.projectA, ids.canvas2, 1), link(ids.projectA, canvas3, 2), link(ids.projectB, ids.canvas2)],
    canvases: [canvas(ids.canvas1), canvas(ids.canvas2), canvas(canvas3, { name: "CR-23", live_label_id: ids.labelCr23 })],
    items: [
      canvasItem(ids.itemCustomer),
      canvasItem(reqCard, { entity_id: null, requirement_id: ids.req101 }),
      canvasItem(sharedCard, { canvas_id: ids.canvas2, entity_id: ids.salesOrder }),
    ],
    frames: [frame(ids.frameA)],
    notes: [note(ids.noteFree)],
    pins: [pin(ids.projectA, ids.labelCr23), pin(ids.projectB, ids.labelJira)],
    ...over,
  });
  const ref = { projectId: ids.projectA, expectedVersion: 1 };
  const run = (state = world(), role: WorkspaceRole = "modeler", ws = {}) => deleteProject(makeCtx(), access(role, ws), state, ref);
  /** A write as "kind table key": the id, or the link's pair. */
  const keyOf = (w: Write): string => {
    if (w.kind === "insert") return `insert ${w.table}`;
    const b = w.before as unknown as Record<string, string>;
    return `${w.kind} ${w.table} ${b.id ?? `${b.project_id}|${b.canvas_id ?? b.label_id}`}`;
  };

  it("deletes the project, its own canvases with their content, its links and pins; a shared canvas stays; one change group", () => {
    const r = run();
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ name: "Customer 360", deletedCanvasIds: [ids.canvas1, canvas3], keptCanvasIds: [ids.canvas2] });
    const { writes, events, changeGroupId } = r.writeSet;
    expect(writes.map(keyOf)).toEqual([
      `update note ${ids.noteFree}`,
      `update canvas_item ${ids.itemCustomer}`,
      `update canvas_item ${reqCard}`,
      `update frame ${ids.frameA}`,
      `update canvas ${ids.canvas1}`,
      `update canvas ${canvas3}`,
      `remove project_canvas ${ids.projectA}|${ids.canvas1}`,
      `remove project_canvas ${ids.projectA}|${ids.canvas2}`,
      `remove project_canvas ${ids.projectA}|${canvas3}`,
      `remove project_pinned_label ${ids.projectA}|${ids.labelCr23}`,
      `update project ${ids.projectA}`,
    ]);
    for (const w of writes) if (w.kind === "update") expect(w.row).toMatchObject({ deleted_at: NOW, version: (w.before as { version: number }).version + 1 });
    // a deleted live canvas keeps its label: the label's next "Open live" makes a new one (D-10)
    expect(writes.find((w) => w.kind === "update" && w.table === "canvas" && w.row.id === canvas3)).toMatchObject({ row: { live_label_id: ids.labelCr23 } });
    // the requirement itself, the model and the other project's pin are untouched (D-28)
    expect(new Set(writes.map((w) => w.table))).toEqual(new Set(["note", "canvas_item", "frame", "canvas", "project_canvas", "project_pinned_label", "project"]));
    expect(new Set(events.map((e) => e.change_group_id))).toEqual(new Set([changeGroupId]));
    expect(events.at(-1)).toMatchObject({ object_type: "project", operation: "delete", object_id: ids.projectA });
    expect(r.writeSet.label).toBe("Delete project Customer 360");
    expect(isUndoable(events)).toBe(true);
  });

  it("deletes no canvas when all are shared, and skips deleted rows", () => {
    const r = run(world({ links: [link(ids.projectA, ids.canvas2), link(ids.projectB, ids.canvas2)], notes: [note(ids.noteFree, { deleted_at: NOW })] }));
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toMatchObject({ deletedCanvasIds: [], keptCanvasIds: [ids.canvas2] });
    expect(r.writeSet.writes.map((w) => w.table)).toEqual(["project_canvas", "project_pinned_label", "project"]);
  });

  it("refuses the workspace's last live project", () => {
    expect(run(world({ projects: [project(ids.projectA), project(ids.projectB, { deleted_at: NOW })] }))).toEqual({ ok: false, error: { code: "invalid", message: LAST_PROJECT_MESSAGE } });
    expect(LAST_PROJECT_MESSAGE).toBe("A workspace needs at least one project.");
  });

  it("is for owners, admins and modelers, not in an archived workspace", () => {
    for (const role of ["owner", "admin", "modeler"] as const) expect(run(world(), role).ok).toBe(true);
    expect(run(world(), "reviewer")).toEqual({ ok: false, error: { code: "forbidden", message: "As a reviewer you cannot delete projects." } });
    expect(run(world(), "reader")).toEqual({ ok: false, error: { code: "forbidden", message: "As a reader you cannot delete projects." } });
    expect(run(world(), "owner", archived)).toMatchObject({ ok: false, error: { code: "archived" } });
  });

  it("refuses a stale version, a deleted or unknown project and bad input", () => {
    expect(deleteProject(makeCtx(), access("owner"), world(), { ...ref, expectedVersion: 2 })).toEqual({ ok: false, error: { code: "stale_version", message: STALE_VERSION_MESSAGE } });
    expect(run(world({ project: project(ids.projectA, { deleted_at: NOW }) }))).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(run(world({ project: null }))).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(deleteProject(makeCtx(), access("owner"), world(), { projectId: "x" })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });
});
