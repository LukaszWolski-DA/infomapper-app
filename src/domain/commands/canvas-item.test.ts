import { describe, expect, it } from "vitest";
import { access, archived, canvas, canvasItem, entity, ids, makeCtx, NOW, sourceTable } from "../__fixtures__/domain";
import { STALE_VERSION_MESSAGE } from "../errors";
import { changeLabel } from "../model/change-label";
import {
  arrangeCanvasItems,
  moveCanvasItems,
  placeManyOnCanvas,
  placeOnCanvas,
  removeCanvasItems,
  removeFromCanvas,
  setCanvasItemWidths,
  updateCanvasItem,
} from "./canvas-item";

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

describe("several cards at once (slice 2a): move, arrange, widths, remove", () => {
  const second = "01900000-0000-7000-8000-00000000c003";
  const items = [
    canvasItem(itemCustomer, { x: 400, y: 120 }),
    canvasItem(ids.itemCrmCustomer, { x: 40, y: 40 }),
    canvasItem(second, { x: 800, y: 40, entity_id: ids.salesOrder }),
  ];
  const state = { canvas: canvas(), items };
  const ref = (id: string, over: object = {}) => ({ canvasItemId: id, expectedVersion: 1, ...over });

  it("moves a group in one change group; cards that do not move are left out", () => {
    const r = moveCanvasItems(makeCtx(), access("modeler"), state, {
      canvasId: canvas1,
      items: [ref(itemCustomer, { x: 408, y: 128 }), ref(ids.itemCrmCustomer, { x: 48, y: 48 }), ref(second, { x: 800, y: 40 })],
    });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ moved: 2 });
    expect(r.writeSet.writes).toMatchObject([
      { kind: "update", table: "canvas_item", row: { id: itemCustomer, x: 408, y: 128, version: 2, updated_at: NOW } },
      { kind: "update", table: "canvas_item", row: { id: ids.itemCrmCustomer, x: 48, y: 48, version: 2 } },
    ]);
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id))).toEqual(new Set([r.writeSet.changeGroupId]));
  });

  it("does not ask for the grid when moving (a group keeps its offsets), but does when arranging", () => {
    expect(moveCanvasItems(makeCtx(), access("owner"), state, { canvasId: canvas1, items: [ref(itemCustomer, { x: 403.5, y: 121 })] }).ok).toBe(true);
    expect(arrangeCanvasItems(makeCtx(), access("owner"), state, { canvasId: canvas1, items: [ref(itemCustomer, { x: 403, y: 120 })] })).toMatchObject({
      ok: false,
      error: { code: "invalid", message: "Positions lie on the 8 px grid." },
    });
    const r = arrangeCanvasItems(makeCtx(), access("owner"), state, { canvasId: canvas1, items: [ref(itemCustomer, { x: 40, y: 120 }), ref(second, { x: 40, y: 400 })] });
    expect(r.ok && r.writeSet.writes.map((w) => w.kind === "update" && w.table === "canvas_item" && [w.row.x, w.row.y])).toEqual([
      [40, 120],
      [40, 400],
    ]);
  });

  it("refuses a card of another canvas, a deleted or unknown card, a stale version, a card twice, and nothing to change", () => {
    const run = (refs: object[], s: object = {}) => moveCanvasItems(makeCtx(), access("owner"), { ...state, ...s }, { canvasId: canvas1, items: refs });
    const elsewhere = { items: [canvasItem(itemCustomer, { canvas_id: ids.canvas2 })] };
    expect(run([ref(itemCustomer, { x: 0, y: 0 })], elsewhere)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(run([ref(itemCustomer, { x: 0, y: 0 })], { items: [canvasItem(itemCustomer, { deleted_at: NOW })] })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(run([ref("01900000-0000-7000-8000-00000000c0ff", { x: 0, y: 0 })])).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(run([ref(itemCustomer, { x: 0, y: 0, expectedVersion: 7 })])).toMatchObject({ ok: false, error: { code: "stale_version", message: STALE_VERSION_MESSAGE } });
    expect(run([ref(itemCustomer, { x: 0, y: 0 }), ref(itemCustomer, { x: 8, y: 0 })])).toMatchObject({ ok: false, error: { message: "A card is listed twice." } });
    expect(run([])).toMatchObject({ ok: false, error: { message: "Select at least one card." } });
    expect(run([ref(itemCustomer, { x: 400, y: 120 })])).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(run([ref(itemCustomer, { x: 0, y: 0 })], { canvas: canvas(canvas1, { deleted_at: NOW }) })).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("sets several widths in one change group, within 200–600 px in steps of 8, null for the default", () => {
    const r = setCanvasItemWidths(makeCtx(), access("modeler"), state, {
      canvasId: canvas1,
      items: [ref(itemCustomer, { width: 312 }), ref(second, { width: null })],
    });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ changed: 1 });
    expect(r.writeSet.writes).toMatchObject([{ row: { id: itemCustomer, width: 312 } }]);
    for (const width of [192, 608, 301]) {
      expect(setCanvasItemWidths(makeCtx(), access("modeler"), state, { canvasId: canvas1, items: [ref(itemCustomer, { width })] }).ok).toBe(false);
    }
  });

  it("removes several cards in one change group; the elements stay in the model", () => {
    const r = removeCanvasItems(makeCtx(), access("modeler"), state, { canvasId: canvas1, items: [ref(itemCustomer), ref(second)] });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ removed: 2 });
    expect(r.writeSet.writes.map((w) => w.table)).toEqual(["canvas_item", "canvas_item"]);
    expect(r.writeSet.events.map((e) => e.operation)).toEqual(["delete", "delete"]);
    expect(changeLabel(r.writeSet.events)).toBe("Remove 2 cards");
  });

  it("is refused to reviewers and readers, and in an archived workspace, before reading the input", () => {
    const commands = [moveCanvasItems, arrangeCanvasItems, setCanvasItemWidths, removeCanvasItems];
    for (const command of commands) {
      for (const role of ["reviewer", "reader"] as const) {
        expect(command(makeCtx(), access(role), state, { canvasId: canvas1, items: [ref(itemCustomer, { x: 0, y: 0 })] })).toMatchObject({ ok: false, error: { code: "forbidden" } });
      }
      expect(command(makeCtx(), access("owner", archived), state, {})).toMatchObject({ ok: false, error: { code: "archived" } });
    }
  });
});
