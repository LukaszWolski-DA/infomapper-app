import { describe, expect, it } from "vitest";
import { access, archived, canvas, canvasItem, entity, frame, ids, makeCtx, NOW, sourceTable } from "../__fixtures__/domain";
import { STALE_VERSION_MESSAGE } from "../errors";
import { changeLabel } from "../model/change-label";
import { placeManyOnCanvas, placeOnCanvas, removeCanvasItems, removeFromCanvas, updateCanvasItem } from "./canvas-item";

const { canvas1, customer, crmCustomer, itemCustomer } = ids;

describe("placeOnCanvas", () => {
  const state = { canvas: canvas(), entity: entity(customer), sourceTable: sourceTable(), items: [] };
  const place = (input: object, s: object = {}, role: "owner" | "modeler" | "reviewer" = "owner") =>
    placeOnCanvas(makeCtx(), access(role), { ...state, ...s }, { canvasId: canvas1, x: 0, y: 0, ...input });

  it("places an entity card", () => {
    const r = place({ entityId: customer, x: 10, y: 20 }, {}, "modeler");
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toMatchObject([
      {
        kind: "insert",
        table: "canvas_item",
        row: { id: r.value.canvasItemId, canvas_id: canvas1, entity_id: customer, source_table_id: null, requirement_id: null, x: 10, y: 20, collapsed: false, row_filter: "all", width: null },
      },
    ]);
  });

  it("places a source table card", () => {
    const r = place({ sourceTableId: crmCustomer });
    expect(r.ok && r.writeSet.writes).toMatchObject([{ row: { entity_id: null, source_table_id: crmCustomer } }]);
  });

  it("needs exactly one target", () => {
    expect(place({})).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(place({ entityId: customer, sourceTableId: crmCustomer })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("refuses a second card for the same element, but not after the first was removed", () => {
    expect(place({ entityId: customer }, { items: [canvasItem()] })).toMatchObject({ ok: false, error: { code: "conflict", message: "It is already on this canvas." } });
    expect(place({ entityId: customer }, { items: [canvasItem(itemCustomer, { deleted_at: NOW })] }).ok).toBe(true);
  });

  it("refuses unknown or deleted targets and canvases", () => {
    expect(place({ entityId: customer }, { entity: entity(customer, { deleted_at: NOW }) })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(place({ sourceTableId: crmCustomer }, { sourceTable: null })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(place({ entityId: customer }, { canvas: null })).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("refuses positions that are not finite numbers", () => {
    expect(place({ entityId: customer, x: Infinity })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("is refused to reviewers and in an archived workspace", () => {
    expect(place({ entityId: customer }, {}, "reviewer")).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(placeOnCanvas(makeCtx(), access("owner", archived), state, { canvasId: canvas1, entityId: customer, x: 0, y: 0 })).toMatchObject({
      ok: false,
      error: { code: "archived" },
    });
  });
});

describe("placeManyOnCanvas (slice 1b, B-08)", () => {
  const state = { canvas: canvas(), entities: [entity(customer)], sourceTables: [sourceTable()], items: [] };
  const place = (cards: object[], s: object = {}, role: "owner" | "modeler" | "reviewer" = "owner") =>
    placeManyOnCanvas(makeCtx(), access(role), { ...state, ...s }, { canvasId: canvas1, cards });

  it("places several cards in one change group", () => {
    const r = place([
      { sourceTableId: crmCustomer, x: -400, y: 0 },
      { entityId: customer, x: 400, y: 0 },
    ]);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.canvasItemIds).toHaveLength(2);
    expect(r.writeSet.writes).toMatchObject([
      { kind: "insert", table: "canvas_item", row: { source_table_id: crmCustomer, x: -400, y: 0 } },
      { kind: "insert", table: "canvas_item", row: { entity_id: customer, x: 400, y: 0 } },
    ]);
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
  });

  it("refuses an element already on the canvas, twice in the list, unknown, or nothing at all", () => {
    expect(place([{ entityId: customer, x: 0, y: 0 }], { items: [canvasItem()] })).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect(place([{ entityId: customer, x: 0, y: 0 }, { entityId: customer, x: 0, y: 300 }])).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect(place([{ entityId: customer, x: 0, y: 0 }], { entities: [entity(customer, { deleted_at: NOW })] })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(place([])).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("is refused to reviewers", () => {
    expect(place([{ entityId: customer, x: 0, y: 0 }], {}, "reviewer")).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("updateCanvasItem: collapse, row filter", () => {
  const state = { item: canvasItem() };
  const ref = { canvasItemId: itemCustomer, expectedVersion: 1 };

  it("collapses a card and sets its row filter", () => {
    expect(updateCanvasItem(makeCtx(), access("modeler"), state, { ...ref, collapsed: true, rowFilter: "keys" })).toMatchObject({
      ok: true,
      value: { item: { collapsed: true, row_filter: "keys" } },
    });
  });

  it("refuses the labeled filter (labels come later), a position or width (moveOnCanvas, slice 2b) and no change", () => {
    expect(updateCanvasItem(makeCtx(), access("owner"), state, { ...ref, rowFilter: "labeled" })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(updateCanvasItem(makeCtx(), access("owner"), state, { ...ref, x: 1, y: 1 })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(updateCanvasItem(makeCtx(), access("owner"), state, { ...ref, width: 320 })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(updateCanvasItem(makeCtx(), access("owner"), state, { ...ref, collapsed: false })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });

  it("refuses a stale version and reviewers", () => {
    expect(updateCanvasItem(makeCtx(), access("owner"), state, { canvasItemId: itemCustomer, expectedVersion: 2, collapsed: true })).toMatchObject({
      ok: false,
      error: { code: "stale_version" },
    });
    expect(updateCanvasItem(makeCtx(), access("reviewer"), state, { ...ref, collapsed: true })).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("removeFromCanvas", () => {
  it("soft-deletes the card only (D-02)", () => {
    const r = removeFromCanvas(makeCtx(), access("modeler"), { item: canvasItem() }, { canvasItemId: itemCustomer, expectedVersion: 1 });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toEqual([
      { kind: "update", table: "canvas_item", before: canvasItem(), row: { ...canvasItem(), deleted_at: NOW, version: 2, updated_at: NOW, updated_by: ids.actor } },
    ]);
  });

  it("is refused to readers", () => {
    expect(removeFromCanvas(makeCtx(), access("reader"), { item: canvasItem() }, { canvasItemId: itemCustomer, expectedVersion: 1 })).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
  });
});

describe("removeCanvasItems (slice 2a)", () => {
  const second = "01900000-0000-7000-8000-00000000c003";
  const items = [canvasItem(itemCustomer), canvasItem(ids.itemCrmCustomer), canvasItem(second, { x: 800, y: 40, entity_id: ids.salesOrder })];
  const state = { canvas: canvas(), items };
  const ref = (id: string, over: object = {}) => ({ canvasItemId: id, expectedVersion: 1, ...over });

  it("removes several cards in one change group; the elements stay in the model", () => {
    const r = removeCanvasItems(makeCtx(), access("modeler"), state, { canvasId: canvas1, items: [ref(itemCustomer), ref(second)] });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ removed: 2 });
    expect(r.writeSet.writes.map((w) => w.table)).toEqual(["canvas_item", "canvas_item"]);
    expect(r.writeSet.events.map((e) => e.operation)).toEqual(["delete", "delete"]);
    expect(changeLabel(r.writeSet.events)).toBe("Remove 2 cards");
  });

  it("refuses a card of another canvas, an unknown card, a stale version, a card twice and nothing at all", () => {
    const run = (refs: object[], s: object = {}) => removeCanvasItems(makeCtx(), access("owner"), { ...state, ...s }, { canvasId: canvas1, items: refs });
    expect(run([ref(itemCustomer)], { items: [canvasItem(itemCustomer, { canvas_id: ids.canvas2 })] })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(run([ref("01900000-0000-7000-8000-00000000c0ff")])).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(run([ref(itemCustomer, { expectedVersion: 7 })])).toMatchObject({ ok: false, error: { code: "stale_version", message: STALE_VERSION_MESSAGE } });
    expect(run([ref(itemCustomer), ref(itemCustomer)])).toMatchObject({ ok: false, error: { message: "A card is listed twice." } });
    expect(run([])).toMatchObject({ ok: false, error: { message: "Select at least one card." } });
  });

  it("is refused to reviewers and readers, and in an archived workspace, before reading the input", () => {
    for (const role of ["reviewer", "reader"] as const) {
      expect(removeCanvasItems(makeCtx(), access(role), state, { canvasId: canvas1, items: [ref(itemCustomer)] })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
    expect(removeCanvasItems(makeCtx(), access("owner", archived), state, {})).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});

describe("a placed card joins the frame it lands in (slice 2b, D-05)", () => {
  const area = frame(ids.frameA, { x: 0, y: 0, width: 600, height: 400 });
  const base = { canvas: canvas(), entity: entity(ids.customer), sourceTable: null, items: [], frames: [area] };
  const place = (input: object) => placeOnCanvas(makeCtx(), access("modeler"), base, { canvasId: canvas1, entityId: ids.customer, ...input });

  it("joins the frame under the middle of its header and grows it, when the canvas gave its height", () => {
    const r = place({ x: 100, y: 300, height: 200, frames: [{ frameId: ids.frameA, expectedVersion: 1 }] });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toMatchObject([
      { kind: "insert", table: "canvas_item", row: { frame_id: ids.frameA } },
      { kind: "update", table: "frame", row: { id: ids.frameA, height: 300 + 200 + 24 } },
    ]);
  });

  it("joins none without its height or outside every frame, and needs the version of a frame it grows", () => {
    expect(place({ x: 100, y: 100 })).toMatchObject({ ok: true, writeSet: { writes: [{ row: { frame_id: null } }] } });
    expect(place({ x: 2000, y: 100, height: 200 })).toMatchObject({ ok: true, writeSet: { writes: [{ row: { frame_id: null } }] } });
    expect(place({ x: 100, y: 300, height: 200 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
  });

  describe("on a collapsed frame's block (slice 2c, Łukasz's step 1 answer 2)", () => {
    // a collapsed Sales concept frame with one member: its block is 280 × 118 at (0, 0); the frame is 600 × 400
    const sales = frame(ids.frameA, { kind: "concept", concept_id: ids.conceptSales, name: "Sales", color: null, x: 0, y: 0, width: 600, height: 400, collapsed: true });
    const member = canvasItem("01900000-0000-7000-8000-00000000c003", { entity_id: ids.salesOrder, x: 50, y: 60, frame_id: ids.frameA });
    const onBlock = { ...base, frames: [sales], items: [member] };
    const drop = (input: object, role: "modeler" | "reviewer" = "modeler") =>
      placeOnCanvas(makeCtx(), access(role), onBlock, { canvasId: canvas1, entityId: ids.customer, x: 20, y: 10, height: 200, frames: [{ frameId: ids.frameA, expectedVersion: 1 }], ...input });

    it("a drop from the left panel files the card into the frame and grows it", () => {
      const r = drop({ dragDrop: true });
      if (!r.ok) throw new Error(r.error.message);
      expect(r.writeSet.writes).toMatchObject([
        { kind: "insert", table: "canvas_item", row: { frame_id: ids.frameA, x: 32, y: 392 } }, // 400 − 8
        { kind: "update", table: "frame", row: { id: ids.frameA, height: 392 + 200 + 24, collapsed: true } },
      ]);
    });

    it("with the concept answered, the entity moves to the frame's concept in the same change", () => {
      const r = drop({ dragDrop: true, moveToConcepts: true });
      if (!r.ok) throw new Error(r.error.message);
      expect(r.writeSet.writes.find((w) => w.table === "entity")).toMatchObject({ row: { id: ids.customer, concept_id: ids.conceptSales } });
      expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    });

    it("a card the app places there (no drag) does not join the collapsed frame", () => {
      expect(drop({})).toMatchObject({ ok: true, writeSet: { writes: [{ row: { frame_id: null, x: 20, y: 10 } }] } });
    });
  });

  it("does the same for several cards placed at once", () => {
    const r = placeManyOnCanvas(makeCtx(), access("modeler"), { canvas: canvas(), entities: [entity(ids.customer)], sourceTables: [sourceTable()], items: [], frames: [area] }, {
      canvasId: canvas1,
      cards: [{ entityId: ids.customer, x: 100, y: 100, height: 100 }, { sourceTableId: ids.crmCustomer, x: 2000, y: 0, height: 100 }],
    });
    expect(r.ok && r.writeSet.writes.map((w) => (w.table === "canvas_item" && w.kind === "insert" ? w.row.frame_id : w.table))).toEqual([ids.frameA, null]);
  });
});
