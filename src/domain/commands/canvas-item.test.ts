import { describe, expect, it } from "vitest";
import { access, archived, canvas, canvasItem, entity, ids, makeCtx, NOW, sourceTable } from "../__fixtures__/domain";
import { placeManyOnCanvas, placeOnCanvas, removeFromCanvas, updateCanvasItem } from "./canvas-item";

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

describe("updateCanvasItem: move, collapse, row filter", () => {
  const state = { item: canvasItem() };
  const ref = { canvasItemId: itemCustomer, expectedVersion: 1 };

  it("saves the position when a drag ends (S1A-05)", () => {
    const r = updateCanvasItem(makeCtx(), access("modeler"), state, { ...ref, x: 512, y: 64 });
    expect(r).toMatchObject({ ok: true, value: { item: { x: 512, y: 64, version: 2 } } });
    expect(r.ok && r.writeSet.events).toMatchObject([{ object_type: "canvas_item", before_image: { x: 400, y: 120 }, after_image: { x: 512, y: 64 } }]);
  });

  it("collapses a card and sets its row filter", () => {
    expect(updateCanvasItem(makeCtx(), access("modeler"), state, { ...ref, collapsed: true, rowFilter: "keys" })).toMatchObject({
      ok: true,
      value: { item: { collapsed: true, row_filter: "keys" } },
    });
  });

  it("sets the card's width, 200–600 px in steps of 8, and back to the default (slice 1b, D-37)", () => {
    expect(updateCanvasItem(makeCtx(), access("modeler"), state, { ...ref, width: 344 })).toMatchObject({ ok: true, value: { item: { width: 344, version: 2 } } });
    expect(updateCanvasItem(makeCtx(), access("modeler"), { item: canvasItem(itemCustomer, { width: 344 }) }, { ...ref, width: null })).toMatchObject({
      ok: true,
      value: { item: { width: null } },
    });
    for (const width of [192, 608, 301]) {
      expect(updateCanvasItem(makeCtx(), access("modeler"), state, { ...ref, width })).toMatchObject({ ok: false, error: { code: "invalid" } });
    }
    expect(updateCanvasItem(makeCtx(), access("modeler"), state, { ...ref, width: null })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });

  it("refuses the labeled filter (labels come later), half a position and no change", () => {
    expect(updateCanvasItem(makeCtx(), access("owner"), state, { ...ref, rowFilter: "labeled" })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(updateCanvasItem(makeCtx(), access("owner"), state, { ...ref, x: 1 })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(updateCanvasItem(makeCtx(), access("owner"), state, { ...ref, x: 400, y: 120 })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });

  it("refuses a stale version and reviewers", () => {
    expect(updateCanvasItem(makeCtx(), access("owner"), state, { canvasItemId: itemCustomer, expectedVersion: 2, x: 1, y: 1 })).toMatchObject({
      ok: false,
      error: { code: "stale_version" },
    });
    expect(updateCanvasItem(makeCtx(), access("reviewer"), state, { ...ref, x: 1, y: 1 })).toMatchObject({ ok: false, error: { code: "forbidden" } });
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
