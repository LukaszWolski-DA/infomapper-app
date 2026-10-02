import { describe, expect, it } from "vitest";
import { access, archived, canvas, ids, link, makeCtx, NOW, project } from "../__fixtures__/domain";
import { STALE_VERSION_MESSAGE } from "../errors";
import { addCanvasToProject, createCanvas, removeCanvasFromProject, renameCanvas } from "./canvas";

const { projectA, projectB, canvas1, canvas2 } = ids;

describe("createCanvas", () => {
  const state = { project: project(projectA), projectLinks: [link(projectA, canvas1, 0), link(projectA, canvas2, 4)] };

  it("creates an empty canvas as the project's last tab", () => {
    const r = createCanvas(makeCtx(), access("modeler"), state, { projectId: projectA, name: "Invoices" });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toMatchObject([
      { kind: "insert", table: "canvas", row: { id: r.value.canvasId, name: "Invoices", workspace_id: ids.ws, version: 1, created_at: NOW } },
      { kind: "insert", table: "project_canvas", row: { project_id: projectA, canvas_id: r.value.canvasId, sort_order: 5 } },
    ]);
    expect(r.writeSet.events).toHaveLength(2);
    expect(r.writeSet.events.every((e) => e.change_group_id === r.writeSet.changeGroupId && e.operation === "create")).toBe(true);
  });

  it("is refused to reviewers and readers, and in an archived workspace", () => {
    for (const role of ["reviewer", "reader"] as const) {
      expect(createCanvas(makeCtx(), access(role), state, { projectId: projectA, name: "X" })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
    expect(createCanvas(makeCtx(), access("owner", archived), state, { projectId: projectA, name: "X" })).toMatchObject({ ok: false, error: { code: "archived" } });
  });

  it("refuses an unknown, deleted or foreign project", () => {
    const tries = [
      { ...state, project: null },
      { ...state, project: project(projectA, { deleted_at: NOW }) },
      { ...state, project: project(projectA, { workspace_id: ids.org }) },
    ];
    for (const s of tries) {
      expect(createCanvas(makeCtx(), access("owner"), s, { projectId: projectA, name: "X" })).toMatchObject({ ok: false, error: { code: "not_found" } });
    }
    expect(createCanvas(makeCtx(), access("owner"), state, { projectId: projectB, name: "X" })).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("needs a name", () => {
    expect(createCanvas(makeCtx(), access("owner"), state, { projectId: projectA, name: " " })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });
});

describe("renameCanvas", () => {
  const state = { canvas: canvas(canvas1) };

  it("renames, bumps the version and logs before and after", () => {
    const r = renameCanvas(makeCtx(), access("modeler"), state, { canvasId: canvas1, expectedVersion: 2, name: "Customers" });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.canvas).toEqual({ ...canvas(canvas1), name: "Customers", version: 3, updated_at: NOW, updated_by: ids.actor });
    expect(r.writeSet.events).toMatchObject([
      { operation: "update", object_type: "canvas", object_id: canvas1, before_image: { name: "Customer & orders", version: 2 }, after_image: { name: "Customers", version: 3 } },
    ]);
  });

  it("refuses a stale version", () => {
    expect(renameCanvas(makeCtx(), access("owner"), state, { canvasId: canvas1, expectedVersion: 1, name: "X" })).toEqual({
      ok: false,
      error: { code: "stale_version", message: STALE_VERSION_MESSAGE },
    });
  });

  it("is refused to reviewers and in an archived workspace", () => {
    expect(renameCanvas(makeCtx(), access("reviewer"), state, { canvasId: canvas1, expectedVersion: 2, name: "X" })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(renameCanvas(makeCtx(), access("owner", archived), state, { canvasId: canvas1, expectedVersion: 2, name: "X" })).toMatchObject({ ok: false, error: { code: "archived" } });
  });

  it("refuses a deleted canvas and an empty name", () => {
    expect(renameCanvas(makeCtx(), access("owner"), { canvas: canvas(canvas1, { deleted_at: NOW }) }, { canvasId: canvas1, expectedVersion: 2, name: "X" })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(renameCanvas(makeCtx(), access("owner"), state, { canvasId: canvas1, expectedVersion: 2, name: "" })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });
});

describe("canvas in several projects (D-28)", () => {
  // canvas1 is in A and B; canvas2 only in B. A therefore has one canvas, B two.
  const links = [link(projectA, canvas1, 0), link(projectB, canvas1, 0), link(projectB, canvas2, 1)];
  const stateFor = (canvasId: string, projectId: string) => ({
    canvas: canvas(canvasId),
    project: project(projectId),
    canvasLinks: links.filter((l) => l.canvas_id === canvasId),
    projectLinks: links.filter((l) => l.project_id === projectId),
  });

  it("adds an existing canvas to another project as its last tab", () => {
    const r = addCanvasToProject(makeCtx(), access("modeler"), stateFor(canvas2, projectA), { canvasId: canvas2, projectId: projectA });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toMatchObject([{ kind: "insert", table: "project_canvas", row: { project_id: projectA, canvas_id: canvas2, sort_order: 1 } }]);
    expect(r.writeSet.events).toMatchObject([{ operation: "create", object_type: "project_canvas", object_id: canvas2, before_image: null }]);
  });

  it("refuses to add a canvas twice", () => {
    expect(addCanvasToProject(makeCtx(), access("owner"), stateFor(canvas1, projectA), { canvasId: canvas1, projectId: projectA })).toMatchObject({ ok: false, error: { code: "conflict" } });
  });

  it("removes a shared canvas from one project; the canvas itself is not touched", () => {
    const r = removeCanvasFromProject(makeCtx(), access("modeler"), stateFor(canvas1, projectB), { canvasId: canvas1, projectId: projectB });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toEqual([{ kind: "remove", table: "project_canvas", before: link(projectB, canvas1, 0) }]);
    expect(r.writeSet.events).toMatchObject([
      { operation: "delete", object_type: "project_canvas", object_id: canvas1, before_image: link(projectB, canvas1, 0), after_image: {} },
    ]);
  });

  it("refuses to take a canvas out of its last project", () => {
    expect(removeCanvasFromProject(makeCtx(), access("owner"), stateFor(canvas2, projectB), { canvasId: canvas2, projectId: projectB })).toMatchObject({
      ok: false,
      error: { code: "invalid", message: "A canvas belongs to at least one project." },
    });
  });

  it("refuses to leave a project without a canvas", () => {
    expect(removeCanvasFromProject(makeCtx(), access("owner"), stateFor(canvas1, projectA), { canvasId: canvas1, projectId: projectA })).toMatchObject({
      ok: false,
      error: { code: "invalid", message: "This project would have no canvas left." },
    });
  });

  it("refuses to remove a canvas that is not in the project", () => {
    expect(removeCanvasFromProject(makeCtx(), access("owner"), stateFor(canvas2, projectA), { canvasId: canvas2, projectId: projectA })).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("is refused to reviewers and readers, and in an archived workspace", () => {
    for (const role of ["reviewer", "reader"] as const) {
      expect(addCanvasToProject(makeCtx(), access(role), stateFor(canvas2, projectA), { canvasId: canvas2, projectId: projectA })).toMatchObject({ ok: false, error: { code: "forbidden" } });
      expect(removeCanvasFromProject(makeCtx(), access(role), stateFor(canvas1, projectB), { canvasId: canvas1, projectId: projectB })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
    expect(addCanvasToProject(makeCtx(), access("owner", archived), stateFor(canvas2, projectA), { canvasId: canvas2, projectId: projectA })).toMatchObject({ ok: false, error: { code: "archived" } });
    expect(removeCanvasFromProject(makeCtx(), access("owner", archived), stateFor(canvas1, projectB), { canvasId: canvas1, projectId: projectB })).toMatchObject({ ok: false, error: { code: "archived" } });
  });

  it("refuses a deleted canvas or project", () => {
    const s = stateFor(canvas2, projectA);
    expect(addCanvasToProject(makeCtx(), access("owner"), { ...s, canvas: canvas(canvas2, { deleted_at: NOW }) }, { canvasId: canvas2, projectId: projectA })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(addCanvasToProject(makeCtx(), access("owner"), { ...s, project: project(projectA, { deleted_at: NOW }) }, { canvasId: canvas2, projectId: projectA })).toMatchObject({ ok: false, error: { code: "not_found" } });
  });
});
