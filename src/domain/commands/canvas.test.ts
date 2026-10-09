import { describe, expect, it } from "vitest";
import { access, archived, canvas, canvasItem, frame, ids, link, makeCtx, NOW, project } from "../__fixtures__/domain";
import { STALE_VERSION_MESSAGE } from "../errors";
import { changeLabel } from "../model/change-label";
import {
  addCanvasToProject,
  applyLookToAllCanvases,
  createCanvas,
  deleteCanvas,
  duplicateCanvas,
  LAST_CANVAS_MESSAGE,
  removeCanvasFromProject,
  renameCanvas,
  setCanvasLook,
} from "./canvas";
import { isUndoable } from "./undo";

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
      { operation: "delete", object_type: "project_canvas", object_id: canvas1, before_image: link(projectB, canvas1, 0), after_image: null },
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

describe("duplicateCanvas (slice 2a)", () => {
  const look = { background: "warm", grid: "lines", layer: "mappings" } as const;
  const items = [
    canvasItem(ids.itemCustomer, { x: 400, y: 120, width: 312, collapsed: true, row_filter: "mapped" }),
    canvasItem(ids.itemCrmCustomer, { x: 40, y: 40 }),
    canvasItem("01900000-0000-7000-8000-00000000c003", { deleted_at: NOW }),
  ];
  const state = {
    canvas: canvas(canvas1, { look }),
    project: project(projectA),
    projectLinks: [link(projectA, canvas1, 3), link(projectA, canvas2, 4)],
    items,
    frames: [],
  };

  it("copies the layout into a new canvas “{name} (copy)” right after the original, with the look and layer, in one change group", () => {
    const r = duplicateCanvas(makeCtx(), access("modeler"), state, { projectId: projectA, canvasId: canvas1 });
    if (!r.ok) throw new Error(r.error.message);
    const copyId = r.value.canvasId;
    expect(r.value.name).toBe("Customer & orders (copy)");
    expect(r.writeSet.writes).toMatchObject([
      { kind: "insert", table: "canvas", row: { id: copyId, name: "Customer & orders (copy)", look, live_label_id: null, version: 1 } },
      // the original's sort order; tabs with the same order follow when they were added (store.ts)
      { kind: "insert", table: "project_canvas", row: { project_id: projectA, canvas_id: copyId, sort_order: 3, added_at: NOW } },
      {
        kind: "insert",
        table: "canvas_item",
        row: { canvas_id: copyId, entity_id: ids.customer, x: 400, y: 120, width: 312, collapsed: true, row_filter: "mapped", frame_id: null, version: 1 },
      },
      { kind: "insert", table: "canvas_item", row: { canvas_id: copyId, source_table_id: ids.crmCustomer, x: 40, y: 40 } },
    ]);
    const copies = r.writeSet.writes.slice(2).map((w) => (w.kind === "insert" ? (w.row as { id: string }).id : ""));
    expect(copies).not.toContain(ids.itemCustomer);
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    expect(changeLabel(r.writeSet.events)).toBe("Duplicate canvas");
  });

  it("refuses a canvas that is not in the project, a deleted canvas, reviewers and readers", () => {
    expect(duplicateCanvas(makeCtx(), access("owner"), { ...state, projectLinks: [link(projectA, canvas2)] }, { projectId: projectA, canvasId: canvas1 })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    expect(duplicateCanvas(makeCtx(), access("owner"), { ...state, canvas: canvas(canvas1, { deleted_at: NOW }) }, { projectId: projectA, canvasId: canvas1 })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    for (const role of ["reviewer", "reader"] as const) {
      expect(duplicateCanvas(makeCtx(), access(role), state, { projectId: projectA, canvasId: canvas1 })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
  });

  it("copies the frames with new ids, and each card is in the copy of its frame (slice 2b)", () => {
    const frames = [
      frame(ids.frameA, { name: "Customer", kind: "concept", concept_id: ids.conceptCustomer, color: null, x: 360, y: 80, width: 400, height: 400 }),
      frame(ids.frameB, { name: "Gone", deleted_at: NOW }),
    ];
    const withFrames = { ...state, frames, items: [canvasItem(ids.itemCustomer, { x: 400, y: 120, frame_id: ids.frameA }), canvasItem(ids.itemCrmCustomer, { x: 40, y: 40 })] };
    const r = duplicateCanvas(makeCtx(), access("modeler"), withFrames, { projectId: projectA, canvasId: canvas1 });
    if (!r.ok) throw new Error(r.error.message);
    const inserted = (table: string) => r.writeSet.writes.flatMap((w) => (w.kind === "insert" && w.table === table ? [w.row as unknown as Record<string, unknown>] : []));
    const [copyFrame, ...more] = inserted("frame");
    expect(more).toHaveLength(0); // the deleted frame is not copied
    expect(copyFrame).toMatchObject({ canvas_id: r.value.canvasId, name: "Customer", kind: "concept", concept_id: ids.conceptCustomer, x: 360, y: 80, width: 400, height: 400, version: 1 });
    expect(copyFrame!.id).not.toBe(ids.frameA);
    expect(inserted("canvas_item").map((i) => i.frame_id)).toEqual([copyFrame!.id, null]);
    // frames are written before the cards that name them
    expect(r.writeSet.writes.findIndex((w) => w.table === "frame")).toBeLessThan(r.writeSet.writes.findIndex((w) => w.table === "canvas_item"));
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
  });

  it("keeps each frame's collapsed state in the copy (slice 2c, item 10)", () => {
    const frames = [frame(ids.frameA, { collapsed: true }), frame(ids.frameB, { x: 1000, collapsed: false })];
    const r = duplicateCanvas(makeCtx(), access("modeler"), { ...state, frames }, { projectId: projectA, canvasId: canvas1 });
    if (!r.ok) throw new Error(r.error.message);
    const copies = r.writeSet.writes.flatMap((w) => (w.kind === "insert" && w.table === "frame" ? [w.row as unknown as { x: number; collapsed: boolean }] : []));
    expect(copies.map((f) => [f.x, f.collapsed])).toEqual([
      [0, true],
      [1000, false],
    ]);
  });
});

describe("deleteCanvas (slice 2a, D-28)", () => {
  const items = [canvasItem(ids.itemCustomer), canvasItem(ids.itemCrmCustomer), canvasItem("01900000-0000-7000-8000-00000000c003", { deleted_at: NOW })];
  const base = {
    canvas: canvas(canvas1),
    project: project(projectA),
    canvasLinks: [link(projectA, canvas1)],
    projectLinks: [link(projectA, canvas1), link(projectA, canvas2)],
    items,
    frames: [],
  };
  const input = { projectId: projectA, canvasId: canvas1, expectedVersion: 2 };

  it("deletes a canvas that is only in this project: the canvas and its cards are soft-deleted, its link goes", () => {
    const r = deleteCanvas(makeCtx(), access("modeler"), base, input);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ deleted: true, otherProjectIds: [] });
    expect(r.writeSet.writes).toMatchObject([
      { kind: "update", table: "canvas_item", row: { id: ids.itemCustomer, deleted_at: NOW } },
      { kind: "update", table: "canvas_item", row: { id: ids.itemCrmCustomer, deleted_at: NOW } },
      { kind: "update", table: "canvas", row: { id: canvas1, deleted_at: NOW, version: 3 } },
      { kind: "remove", table: "project_canvas", before: { project_id: projectA, canvas_id: canvas1 } },
    ]);
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    expect(changeLabel(r.writeSet.events)).toBe("Delete canvas");
  });

  it("deletes the canvas's frames with it (slice 2b)", () => {
    const r = deleteCanvas(makeCtx(), access("modeler"), { ...base, frames: [frame(), frame(ids.frameB, { deleted_at: NOW })] }, input);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes.filter((w) => w.table === "frame")).toMatchObject([{ kind: "update", row: { id: ids.frameA, deleted_at: NOW } }]);
    expect(changeLabel(r.writeSet.events)).toBe("Delete canvas");
  });

  it("only takes a canvas out of this project when another project has it too", () => {
    const shared = { ...base, canvasLinks: [link(projectA, canvas1), link(projectB, canvas1)] };
    const r = deleteCanvas(makeCtx(), access("modeler"), shared, input);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ deleted: false, otherProjectIds: [projectB] });
    expect(r.writeSet.writes).toEqual([{ kind: "remove", table: "project_canvas", before: link(projectA, canvas1) }]);
  });

  it("refuses the project's last canvas, a stale version, a canvas not in the project", () => {
    expect(deleteCanvas(makeCtx(), access("owner"), { ...base, projectLinks: [link(projectA, canvas1)] }, input)).toMatchObject({
      ok: false,
      error: { code: "invalid", message: LAST_CANVAS_MESSAGE },
    });
    expect(deleteCanvas(makeCtx(), access("owner"), base, { ...input, expectedVersion: 1 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(deleteCanvas(makeCtx(), access("owner"), { ...base, canvasLinks: [link(projectB, canvas1)] }, input)).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("is refused to reviewers and readers, both for deleting and for taking out, and in an archived workspace", () => {
    const shared = { ...base, canvasLinks: [link(projectA, canvas1), link(projectB, canvas1)] };
    for (const role of ["reviewer", "reader"] as const) {
      for (const s of [base, shared]) expect(deleteCanvas(makeCtx(), access(role), s, input)).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
    expect(deleteCanvas(makeCtx(), access("owner", archived), base, input)).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});

describe("canvas look and layer mode (slice 2a, D-12, D-22)", () => {
  const state = { canvas: canvas(canvas1) };

  it("sets background, grid and layer with a new version and a change event, but is not an undo step", () => {
    const r = setCanvasLook(makeCtx(), access("modeler"), state, { canvasId: canvas1, expectedVersion: 2, background: "blue", layer: "relationships" });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.canvas).toMatchObject({ look: { background: "blue", grid: "dots", layer: "relationships" }, version: 3 });
    expect(r.writeSet.events).toMatchObject([{ object_type: "canvas", operation: "update" }]);
    expect(isUndoable(r.writeSet.events)).toBe(false);
  });

  it("refuses unknown values, no change, a stale version, reviewers and readers", () => {
    const set = (input: object, role: "owner" | "reviewer" | "reader" = "owner") =>
      setCanvasLook(makeCtx(), access(role), state, { canvasId: canvas1, expectedVersion: 2, ...input });
    expect(set({ background: "pink" })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(set({ grid: "dots", layer: "all" })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(set({ grid: "none", expectedVersion: 1 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    for (const role of ["reviewer", "reader"] as const) expect(set({ grid: "none" }, role)).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });

  it("“Use this look on all canvases” copies background and grid to every live canvas, keeps each layer mode, in one change group", () => {
    const third = "01900000-0000-7000-8000-000000002003";
    const canvases = [
      canvas(canvas1, { look: { background: "warm", grid: "lines", layer: "all" } }),
      canvas(canvas2, { look: { background: "grey", grid: "dots", layer: "mappings" } }),
      canvas(third, { look: { background: "warm", grid: "lines", layer: "relationships" } }),
      canvas("01900000-0000-7000-8000-000000002004", { deleted_at: NOW }),
    ];
    const r = applyLookToAllCanvases(makeCtx(), access("modeler"), { canvases }, { canvasId: canvas1 });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ changed: 1 });
    expect(r.writeSet.writes).toMatchObject([{ table: "canvas", row: { id: canvas2, look: { background: "warm", grid: "lines", layer: "mappings" } } }]);
    expect(isUndoable(r.writeSet.events)).toBe(false);
    expect(applyLookToAllCanvases(makeCtx(), access("modeler"), { canvases: canvases.slice(0, 1) }, { canvasId: canvas1 })).toMatchObject({
      ok: false,
      error: { message: "Every canvas already uses this look." },
    });
    expect(applyLookToAllCanvases(makeCtx(), access("reviewer"), { canvases }, { canvasId: canvas1 })).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});
