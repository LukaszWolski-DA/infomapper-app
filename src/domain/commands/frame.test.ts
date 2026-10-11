import { describe, expect, it } from "vitest";
import {
  access,
  archived,
  canvas,
  canvasItem,
  concept,
  entity,
  frame,
  ids,
  makeCtx,
  note,
  NOW,
  sourceSystem,
  sourceTable,
} from "../__fixtures__/domain";
import type { CommandResult, WriteSet } from "../changes";
import { STALE_VERSION_MESSAGE } from "../errors";
import { changeLabel } from "../model/change-label";
import type { CanvasItem, Entity, Frame } from "../types";
import {
  arrangeCanvasIntoFrames,
  createFrame,
  deleteFrame,
  fitFrameToContent,
  moveOnCanvas,
  putCardsInNewFrame,
  resizeFrame,
  setAllFramesCollapsed,
  setFrameCollapsed,
  updateFrame,
} from "./frame";
import { revertChangeGroup, type WorkspaceRows } from "./undo";

const { canvas1, customer, salesOrder, itemCustomer, itemCrmCustomer, frameA, frameB, conceptCustomer, conceptSales, crm } = ids;
const itemOrder = "01900000-0000-7000-8000-00000000c003";
const itemAddress = "01900000-0000-7000-8000-00000000c004";
const address = "01900000-0000-7000-8000-000000004003";

const customerCard = (over: Partial<CanvasItem> = {}) => canvasItem(itemCustomer, over);
const tableCard = (over: Partial<CanvasItem> = {}) => canvasItem(itemCrmCustomer, { x: 1200, y: 120, ...over });
const orderCard = (over: Partial<CanvasItem> = {}) => canvasItem(itemOrder, { entity_id: salesOrder, x: 400, y: 1000, ...over });
const addressCard = (over: Partial<CanvasItem> = {}) => canvasItem(itemAddress, { entity_id: address, x: 100, y: 400, ...over });

const model = {
  entities: [entity(customer), entity(salesOrder), entity(address, { name: "Customer Address", concept_id: conceptCustomer })],
  sourceTables: [sourceTable()],
  concepts: [concept(conceptCustomer), concept(conceptSales)],
  sourceSystems: [sourceSystem()],
};

const ref = (i: CanvasItem) => ({ canvasItemId: i.id, expectedVersion: i.version });
const sized = (i: CanvasItem, height = 200) => ({ ...ref(i), height });
const fref = (f: Frame) => ({ frameId: f.id, expectedVersion: f.version });

function ok<T>(r: CommandResult<T>): { value: T; writeSet: WriteSet } {
  if (!r.ok) throw new Error(r.error.message);
  return r;
}

/** The row each write leaves, by table and id. */
const written = (ws: WriteSet): Record<string, Record<string, unknown>> =>
  Object.fromEntries(ws.writes.flatMap((w) => (w.kind === "remove" ? [] : [[`${w.table}:${(w.row as { id: string }).id}`, w.row as unknown as Record<string, unknown>]])));

const refusedAsStale = { ok: false, error: { code: "stale_version", message: STALE_VERSION_MESSAGE } };

describe("createFrame", () => {
  const items = [customerCard(), tableCard(), orderCard({ frame_id: frameB })];
  const state = { canvas: canvas(), frames: [frame(frameB, { x: 0, y: 900, width: 800, height: 600 })], items };
  const create = (input: object = {}, role: "modeler" | "reviewer" = "modeler", ws = {}) =>
    createFrame(makeCtx(), access(role, ws), state, { canvasId: canvas1, x: 0, y: 0, width: 1600, height: 1600, cards: items.map((i) => sized(i)), ...input });

  it("draws a free frame “New frame” in the first free colour that takes the free cards fully inside it (D-06)", () => {
    const r = ok(create());
    const rows = written(r.writeSet);
    expect(rows[`frame:${r.value.frameId}`]).toMatchObject({ canvas_id: canvas1, name: "New frame", kind: "free", color: "#7C8998", x: 0, y: 0, width: 1600, height: 1600, collapsed: false, version: 1 });
    expect(rows[`canvas_item:${itemCustomer}`]).toMatchObject({ frame_id: r.value.frameId, version: 2 });
    expect(rows[`canvas_item:${itemCrmCustomer}`]).toMatchObject({ frame_id: r.value.frameId });
    expect(rows[`canvas_item:${itemOrder}`]).toBeUndefined(); // in another frame
    expect(r.value).toMatchObject({ claimed: 2, versions: { [r.value.frameId]: 1, [itemCustomer]: 2, [itemCrmCustomer]: 2 } });
    expect(r.writeSet.events.every((e) => e.change_group_id === r.writeSet.changeGroupId)).toBe(true);
  });

  it("does not take a card that sticks out, or whose height it was not given", () => {
    expect(ok(create({ width: 1400 })).value.claimed).toBe(1); // the table card ends at 1456
    expect(ok(create({ cards: [sized(customerCard(), 2000), sized(tableCard())] })).value.claimed).toBe(1);
    expect(ok(create({ cards: [] })).value.claimed).toBe(0);
  });

  it("refuses when a card it takes changed since the user saw it", () => {
    expect(create({ cards: [{ ...sized(customerCard()), expectedVersion: 7 }] })).toMatchObject(refusedAsStale);
  });

  it("is at least 160 × 96 px", () => {
    expect(create({ width: 150 })).toMatchObject({ ok: false, error: { code: "invalid", message: "A frame is at least 160 px wide." } });
    expect(create({ height: 90 })).toMatchObject({ ok: false, error: { code: "invalid", message: "A frame is at least 96 px high." } });
  });

  it("is refused to reviewers, in an archived workspace, and on a deleted canvas", () => {
    expect(create({}, "reviewer")).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(create({}, "modeler", archived)).toMatchObject({ ok: false, error: { code: "archived" } });
    expect(createFrame(makeCtx(), access("modeler"), { ...state, canvas: canvas(canvas1, { deleted_at: NOW }) }, { canvasId: canvas1, x: 0, y: 0, width: 400, height: 400, cards: [] })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
  });
});

describe("updateFrame", () => {
  const state = (f: Frame = frame(frameA, { name: "New frame" })) => ({ frame: f, concepts: model.concepts, sourceSystems: model.sourceSystems });
  const update = (input: object, f?: Frame, role: "modeler" | "reader" = "modeler") =>
    updateFrame(makeCtx(), access(role), state(f), { frameId: frameA, expectedVersion: 1, ...input });

  it("renames a frame", () => {
    expect(ok(update({ name: "  Orders  " })).value.frame).toMatchObject({ name: "Orders", version: 2 });
  });

  it("makes it stand for a concept, taking the concept's name while it is still “New frame”", () => {
    expect(ok(update({ kind: "concept", conceptId: conceptSales })).value.frame).toMatchObject({ kind: "concept", concept_id: conceptSales, source_system_id: null, name: "Sales" });
  });

  it("takes the new name only from “New frame” or the previous concept's or system's name; a typed name is kept", () => {
    expect(ok(update({ kind: "concept", conceptId: conceptSales }, frame(frameA, { name: "Orders" }))).value.frame.name).toBe("Orders");
    expect(ok(update({ kind: "source_system", sourceSystemId: crm }, frame(frameA, { name: "Area" }))).value.frame.name).toBe("Area");
    const renamed = frame(frameA, { kind: "concept", concept_id: conceptCustomer, name: "Our customers", color: null });
    expect(ok(update({ conceptId: conceptSales }, renamed)).value.frame.name).toBe("Our customers");
    const customerFrame = frame(frameA, { kind: "concept", concept_id: conceptCustomer, name: "Customer", color: null });
    expect(ok(update({ conceptId: conceptSales }, customerFrame)).value.frame.name).toBe("Sales");
    expect(ok(update({ kind: "source_system", sourceSystemId: crm }, customerFrame)).value.frame).toMatchObject({ kind: "source_system", source_system_id: crm, concept_id: null, name: "CRM" });
    expect(ok(update({ kind: "concept", conceptId: conceptSales, name: "Mine" })).value.frame.name).toBe("Mine");
  });

  it("makes it a free area again, keeping the name and its colour or taking the first free colour", () => {
    const customerFrame = frame(frameA, { kind: "concept", concept_id: conceptCustomer, name: "Customer", color: null });
    expect(ok(update({ kind: "free" }, customerFrame)).value.frame).toMatchObject({ kind: "free", concept_id: null, name: "Customer", color: "#7C8998" });
    expect(ok(update({ kind: "free", color: "#C0437A" }, customerFrame)).value.frame.color).toBe("#C0437A");
  });

  it("changes a free frame's colour among the six free colours only", () => {
    expect(ok(update({ color: "#2F7DD1" })).value.frame.color).toBe("#2F7DD1");
    expect(update({ color: "#123456" })).toMatchObject({ ok: false, error: { code: "invalid", message: "Choose one of the frame colours." } });
    expect(update({ kind: "concept", conceptId: conceptSales, color: "#2F7DD1" })).toMatchObject({ ok: false, error: { message: "Only a free frame has its own colour." } });
  });

  it("needs a live concept or system, and only the one that fits the kind", () => {
    expect(update({ kind: "concept" })).toMatchObject({ ok: false, error: { code: "invalid", message: "Choose a concept." } });
    expect(update({ kind: "source_system" })).toMatchObject({ ok: false, error: { code: "invalid", message: "Choose a source system." } });
    expect(updateFrame(makeCtx(), access("modeler"), { ...state(), concepts: [concept(conceptSales, { deleted_at: NOW })] }, { frameId: frameA, expectedVersion: 1, kind: "concept", conceptId: conceptSales })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    expect(update({ kind: "concept", sourceSystemId: crm })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(update({ conceptId: conceptSales })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("refuses nothing to change, a stale version, a deleted frame and readers", () => {
    expect(update({ name: "New frame" })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(update({ name: "X", expectedVersion: 2 })).toMatchObject(refusedAsStale);
    expect(update({ name: "X" }, frame(frameA, { deleted_at: NOW }))).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(update({ name: "X" }, undefined, "reader")).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("moveOnCanvas: frames (D-14)", () => {
  const fA = frame(frameA);
  const inA = customerCard({ frame_id: frameA });
  const items = [inA, tableCard()];
  const state = { canvas: canvas(), frames: [fA], items };
  const move = (input: object) =>
    moveOnCanvas(makeCtx(), access("modeler"), { ...state, entities: model.entities, concepts: model.concepts }, { canvasId: canvas1, frames: [], items: [], ...input });

  it("moves a frame with every card in it, in one change group", () => {
    const r = ok(move({ frames: [{ ...fref(fA), x: 100, y: 48 }], items: [ref(inA)] }));
    const rows = written(r.writeSet);
    expect(rows[`frame:${frameA}`]).toMatchObject({ x: 100, y: 48, width: 800, version: 2 });
    expect(rows[`canvas_item:${itemCustomer}`]).toMatchObject({ x: 500, y: 168, frame_id: frameA });
    expect(rows[`canvas_item:${itemCrmCustomer}`]).toBeUndefined();
    expect(r.value).toMatchObject({ moved: 2, versions: { [frameA]: 2, [itemCustomer]: 2 } });
  });

  it("moves a card in a moved frame with its frame, whatever position it was given", () => {
    const r = ok(move({ frames: [{ ...fref(fA), x: 8, y: 0 }], items: [{ ...ref(inA), x: 9999, y: 9999 }] }));
    expect(written(r.writeSet)[`canvas_item:${itemCustomer}`]).toMatchObject({ x: 408, y: 120 });
  });

  it("moves frames and loose cards together (group drag, nudge)", () => {
    const r = ok(move({ frames: [{ ...fref(fA), x: 8, y: 8 }], items: [ref(inA), { ...sized(tableCard()), x: 1208, y: 128 }] }));
    expect(r.value.moved).toBe(3);
  });

  it("refuses when a card in the frame was not seen at its version", () => {
    expect(move({ frames: [{ ...fref(fA), x: 8, y: 0 }] })).toMatchObject(refusedAsStale);
    expect(move({ frames: [{ ...fref(fA), x: 8, y: 0 }], items: [{ ...ref(inA), expectedVersion: 3 }] })).toMatchObject(refusedAsStale);
    expect(move({ frames: [{ ...fref(fA), expectedVersion: 4, x: 8, y: 0 }], items: [ref(inA)] })).toMatchObject(refusedAsStale);
  });

  it("moves the free notes in a moved frame with it, not pinned notes or notes in other frames (slice 3a, item 9)", () => {
    const inFrame = note(ids.noteFree, { x: 100, y: 100, frame_id: frameA });
    const elsewhere = note("01900000-0000-7000-8000-00000000d003", { x: 2000, y: 100, frame_id: frameB });
    const pinned = note(ids.notePinned);
    const r = moveOnCanvas(
      makeCtx(),
      access("modeler"),
      { ...state, notes: [inFrame, elsewhere, pinned], entities: model.entities, concepts: model.concepts },
      { canvasId: canvas1, frames: [{ ...fref(fA), x: 16, y: 8 }], items: [ref(inA)] },
    );
    const rows = written(ok(r).writeSet);
    expect(rows[`note:${ids.noteFree}`]).toMatchObject({ x: 116, y: 108, frame_id: frameA, version: 2 });
    expect(rows[`note:${elsewhere.id}`]).toBeUndefined();
    expect(rows[`note:${ids.notePinned}`]).toBeUndefined();
    expect(ok(r).value.versions[ids.noteFree]).toBe(2);
    expect(changeLabel(ok(r).writeSet.events)).toBe("Move frame");
  });

  it("refuses unknown frames and cards, and nothing to change", () => {
    expect(move({ frames: [{ frameId: frameB, expectedVersion: 1, x: 0, y: 0 }] })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(move({ frames: [{ ...fref(fA), x: 0, y: 0 }], items: [ref(inA)] })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(move({ frames: [{ ...fref(fA), x: 8 }] })).toMatchObject({ ok: false, error: { code: "invalid", message: "A position needs x and y." } });
  });
});

describe("moveOnCanvas: drops (D-05)", () => {
  const salesFrame = frame(frameA, { kind: "concept", concept_id: conceptSales, name: "Sales", color: null, x: 0, y: 0, width: 800, height: 400 });
  const items = [customerCard({ x: 2000, y: 0 }), tableCard()];
  const state = { canvas: canvas(), frames: [salesFrame], items, entities: model.entities, concepts: model.concepts };
  const drop = (input: object, role: "modeler" | "reviewer" = "modeler") =>
    moveOnCanvas(makeCtx(), access(role), state, { canvasId: canvas1, frames: [fref(salesFrame)], items: [], ...input });

  it("puts a dropped card in the frame under its header and grows the frame to hold it", () => {
    const r = ok(drop({ items: [{ ...sized(items[0]!, 300), x: 400, y: 200 }] }));
    const rows = written(r.writeSet);
    expect(rows[`canvas_item:${itemCustomer}`]).toMatchObject({ x: 400, y: 200, frame_id: frameA });
    expect(rows[`frame:${frameA}`]).toMatchObject({ x: 0, y: 0, width: 800, height: 200 + 300 + 24 });
  });

  it("asks about an entity of another concept that joined a concept frame, and moves it only when told (one change group)", () => {
    const asked = ok(drop({ items: [{ ...sized(items[0]!), x: 100, y: 100 }] }));
    expect(asked.value).toMatchObject({ questions: [{ cardId: itemCustomer, entityId: customer, conceptId: conceptSales }], movedToConcepts: 0 });
    expect(asked.writeSet.writes.some((w) => w.table === "entity")).toBe(false);

    const moved = ok(drop({ items: [{ ...sized(items[0]!), x: 100, y: 100 }], moveToConcepts: true }));
    expect(moved.value).toMatchObject({ moved: 1, questions: [], movedToConcepts: 1 });
    expect(written(moved.writeSet)[`entity:${customer}`]).toMatchObject({ concept_id: conceptSales, version: 2 });
    expect(new Set(moved.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
  });

  it("does not ask again about an entity that stays in its frame", () => {
    const inSales = { ...state, items: [customerCard({ x: 100, y: 100, frame_id: frameA })] };
    const r = ok(moveOnCanvas(makeCtx(), access("modeler"), inSales, { canvasId: canvas1, frames: [fref(salesFrame)], items: [{ ...sized(inSales.items[0]!), x: 108, y: 100 }] }));
    expect(r.value.questions).toEqual([]);
  });

  it("takes a card out of its frame when it is dropped outside every frame", () => {
    const inSales = { ...state, items: [customerCard({ x: 100, y: 100, frame_id: frameA })] };
    const r = ok(moveOnCanvas(makeCtx(), access("modeler"), inSales, { canvasId: canvas1, frames: [fref(salesFrame)], items: [{ ...sized(inSales.items[0]!), x: 3000, y: 100 }] }));
    expect(written(r.writeSet)[`canvas_item:${itemCustomer}`]).toMatchObject({ x: 3000, frame_id: null });
    expect(written(r.writeSet)[`frame:${frameA}`]).toBeUndefined();
  });

  it("moves a dropped frame with its cards and recomputes only the loose cards", () => {
    const inSales = { ...state, items: [customerCard({ x: 100, y: 100, frame_id: frameA }), tableCard({ x: 2000, y: 0 })] };
    const r = ok(
      moveOnCanvas(makeCtx(), access("modeler"), inSales, {
        canvasId: canvas1,
        frames: [{ ...fref(salesFrame), x: 2000, y: 0 }],
        items: [ref(inSales.items[0]!), { ...sized(inSales.items[1]!), x: 2008, y: 0 }],
      }),
    );
    const rows = written(r.writeSet);
    expect(rows[`canvas_item:${itemCustomer}`]).toMatchObject({ x: 2100, y: 100, frame_id: frameA });
    expect(rows[`canvas_item:${itemCrmCustomer}`]).toMatchObject({ x: 2008, frame_id: frameA });
    expect(rows[`frame:${frameA}`]).toMatchObject({ x: 1984, y: -40 }); // grew to hold the table card (24 px left, 40 above)
  });

  it("needs the height of a dropped card, and the frame it grows at the version the user saw", () => {
    expect(drop({ items: [{ ...ref(items[0]!), x: 100, y: 100 }] })).toMatchObject({ ok: false, error: { message: "A moved card needs its height." } });
    expect(drop({ frames: [], items: [{ ...sized(items[0]!), x: 100, y: 300 }] })).toMatchObject(refusedAsStale); // the frame grows
  });

  it("is refused to reviewers", () => {
    expect(drop({ items: [{ ...sized(items[0]!), x: 100, y: 100 }] }, "reviewer")).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("moveOnCanvas: card widths, nudges and arranging (slice 2b answer 1)", () => {
  const fA = frame(frameA, { width: 400, height: 400 });
  const card = customerCard({ x: 100, y: 100 });
  const state = { canvas: canvas(), frames: [fA], items: [card], entities: model.entities, concepts: model.concepts };
  const move = (input: object) => moveOnCanvas(makeCtx(), access("modeler"), state, { canvasId: canvas1, frames: [fref(fA)], items: [], ...input });

  it("a card made wider joins the frame under its header again and the frame grows to hold it", () => {
    const r = ok(move({ items: [{ ...sized(card), width: 400 }] }));
    const rows = written(r.writeSet);
    expect(rows[`canvas_item:${itemCustomer}`]).toMatchObject({ width: 400, frame_id: frameA, x: 100 });
    expect(rows[`frame:${frameA}`]).toMatchObject({ width: 100 + 400 + 24 });
  });

  it("checks widths: 200–600 px in steps of 8, null for the default", () => {
    for (const width of [192, 608, 301]) expect(move({ items: [{ ...sized(card), width }] })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(ok(move({ items: [{ ...sized(customerCard({ x: 100, y: 100, width: 320 })), width: null }] })).writeSet.writes).toBeDefined();
  });

  it("asks for the 8 px grid only when arranging", () => {
    expect(move({ items: [{ ...sized(card), x: 103, y: 100 }], onGrid: true })).toMatchObject({ ok: false, error: { message: "Positions lie on the 8 px grid." } });
    expect(move({ items: [{ ...sized(card), x: 103, y: 100 }] }).ok).toBe(true);
  });

  it("returns the questions without moving an entity unless told, so nudges and arranging only mark it", () => {
    const sales = frame(frameA, { kind: "concept", concept_id: conceptSales, name: "Sales", color: null, width: 400, height: 400 });
    const r = ok(moveOnCanvas(makeCtx(), access("modeler"), { ...state, frames: [sales], items: [customerCard({ x: 2000, y: 0 })] }, {
      canvasId: canvas1,
      frames: [fref(sales)],
      items: [{ ...sized(customerCard()), x: 8, y: 8 }],
    }));
    expect(r.value.questions).toHaveLength(1);
    expect(r.writeSet.writes.some((w) => w.table === "entity")).toBe(false);
  });
});

describe("fitFrameToContent", () => {
  const fA = frame(frameA, { x: 0, y: 0, width: 2000, height: 2000 });
  const member = customerCard({ x: 400, y: 120, frame_id: frameA });
  const free = tableCard({ x: 1200, y: 40 });
  const state = { canvas: canvas(), frames: [fA], items: [member, free] };
  const fit = (input: object = {}) => fitFrameToContent(makeCtx(), access("modeler"), state, { frameId: frameA, expectedVersion: 1, cards: [sized(member, 300), sized(free)], ...input });

  it("draws the frame around its cards: 32 px at the sides, 40 above, 32 below; then decides membership as a resize does", () => {
    const r = ok(fit());
    expect(written(r.writeSet)[`frame:${frameA}`]).toMatchObject({ x: 368, y: 80, width: 256 + 64, height: 300 + 72 });
    expect(written(r.writeSet)[`canvas_item:${itemCrmCustomer}`]).toBeUndefined();
  });

  it("refuses an empty frame and a member it was not given", () => {
    expect(fitFrameToContent(makeCtx(), access("modeler"), { ...state, items: [free] }, { frameId: frameA, expectedVersion: 1, cards: [] })).toMatchObject({
      ok: false,
      error: { message: "This frame is empty. Drag cards into it first." },
    });
    expect(fit({ cards: [sized(free)] })).toMatchObject(refusedAsStale);
  });
});

describe("resizeFrame (D-06)", () => {
  const fA = frame(frameA, { width: 1000, height: 1000 });
  const fB = frame(frameB, { x: 0, y: 2000, width: 2000, height: 2000 });
  const member = customerCard({ x: 600, y: 100, frame_id: frameA });
  const free = tableCard({ x: 1200, y: 100 });
  const ofB = orderCard({ x: 100, y: 2100, frame_id: frameB });
  const state = { canvas: canvas(), frames: [fA, fB], items: [member, free, ofB] };
  const resize = (input: object) =>
    resizeFrame(makeCtx(), access("modeler"), state, { frameId: frameA, expectedVersion: 1, width: 1000, height: 1000, cards: [member, free, ofB].map(ref), ...input });

  it("releases cards that end up outside and takes free cards that end up inside", () => {
    const smaller = ok(resize({ width: 600 }));
    expect(written(smaller.writeSet)[`canvas_item:${itemCustomer}`]).toMatchObject({ frame_id: null });
    expect(smaller.value).toMatchObject({ joined: 0, left: 1 });
    const bigger = ok(resize({ width: 1600 }));
    expect(written(bigger.writeSet)[`canvas_item:${itemCrmCustomer}`]).toMatchObject({ frame_id: frameA });
    expect(written(bigger.writeSet)[`frame:${frameA}`]).toMatchObject({ x: 0, y: 0, width: 1600, height: 1000 });
  });

  it("never takes cards of another frame", () => {
    const r = ok(resize({ height: 3000 }));
    expect(written(r.writeSet)[`canvas_item:${itemOrder}`]).toBeUndefined();
  });

  it("is at least 160 × 96, and refuses stale frames and cards", () => {
    expect(resize({ width: 100 })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(resize({ width: 600, cards: [] })).toMatchObject(refusedAsStale);
    expect(resize({ width: 600, expectedVersion: 2 })).toMatchObject(refusedAsStale);
    expect(resize({})).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });
});

describe("deleteFrame", () => {
  const fA = frame(frameA, { name: "Orders" });
  const member = customerCard({ frame_id: frameA });
  const state = { canvas: canvas(), frames: [fA], items: [member, tableCard()] };

  it("deletes the frame and keeps its cards in place, in no frame", () => {
    const r = ok(deleteFrame(makeCtx(), access("modeler"), state, { frameId: frameA, expectedVersion: 1, cards: [ref(member)] }));
    const rows = written(r.writeSet);
    expect(rows[`frame:${frameA}`]).toMatchObject({ deleted_at: NOW });
    expect(rows[`canvas_item:${itemCustomer}`]).toMatchObject({ frame_id: null, x: 400, y: 120, deleted_at: null });
    expect(r.value).toEqual({ name: "Orders", released: 1 });
    expect(r.writeSet.events.find((e) => e.object_type === "frame")?.operation).toBe("delete");
  });

  it("refuses when a card in it was not seen", () => {
    expect(deleteFrame(makeCtx(), access("modeler"), state, { frameId: frameA, expectedVersion: 1, cards: [] })).toMatchObject(refusedAsStale);
  });
});

describe("putCardsInNewFrame", () => {
  const items = [customerCard({ x: 400, y: 120 }), addressCard({ x: 800, y: 200, frame_id: frameB }), tableCard(), orderCard()];
  const state = { canvas: canvas(), frames: [frame(frameB, { x: 700, y: 100, width: 600, height: 600 })], items, ...model };
  const put = (cards: CanvasItem[], heights: number[] = cards.map(() => 200)) =>
    putCardsInNewFrame(makeCtx(), access("modeler"), state, { canvasId: canvas1, cards: cards.map((c, i) => sized(c, heights[i])) });

  it("makes a concept frame around entities of one concept, also taking a card from another frame", () => {
    const r = ok(put([items[0]!, items[1]!], [200, 300]));
    const rows = written(r.writeSet);
    expect(rows[`frame:${r.value.frameId}`]).toMatchObject({ kind: "concept", concept_id: conceptCustomer, name: "Customer", color: null, x: 368, y: 80, width: 800 + 256 - 400 + 64, height: 500 - 120 + 72 });
    expect(rows[`canvas_item:${itemAddress}`]).toMatchObject({ frame_id: r.value.frameId });
    expect(r.value).toMatchObject({ kind: "concept", cards: 2 });
  });

  it("makes a source frame around tables of one system, and a free frame around a mix", () => {
    expect(ok(put([items[2]!])).writeSet.writes[0]).toMatchObject({ table: "frame", row: { kind: "source_system", source_system_id: crm, name: "CRM", color: null } });
    expect(ok(put([items[0]!, items[3]!])).writeSet.writes[0]).toMatchObject({ table: "frame", row: { kind: "free", name: "New frame", color: "#7C8998" } });
    expect(ok(put([items[0]!, items[2]!])).value.kind).toBe("free");
  });

  it("from a card it also takes free cards fully inside the new frame (answer 4); from a selection it does not", () => {
    const inside = canvasItem(itemOrder, { entity_id: salesOrder, x: 400, y: 200 });
    const s2 = { ...state, items: [customerCard({ x: 400, y: 120 }), inside] };
    const fromCard = ok(putCardsInNewFrame(makeCtx(), access("modeler"), s2, { canvasId: canvas1, cards: [sized(s2.items[0]!, 600)], others: [sized(inside, 100)] }));
    expect(written(fromCard.writeSet)[`canvas_item:${itemOrder}`]).toMatchObject({ frame_id: fromCard.value.frameId });
    const fromSelection = ok(putCardsInNewFrame(makeCtx(), access("modeler"), s2, { canvasId: canvas1, cards: [sized(s2.items[0]!, 600)] }));
    expect(written(fromSelection.writeSet)[`canvas_item:${itemOrder}`]).toBeUndefined();
  });

  it("needs at least one card on the canvas", () => {
    expect(put([])).toMatchObject({ ok: false, error: { message: "Select at least one card." } });
    expect(put([canvasItem(itemOrder, { id: "01900000-0000-7000-8000-00000000c099" })])).toMatchObject({ ok: false, error: { code: "not_found" } });
  });
});

describe("arrangeCanvasIntoFrames (prototype arrangeLayout)", () => {
  const free = frame(frameA, { name: "Notes area", x: 5000, y: 5000 });
  const old = frame(frameB, { kind: "concept", concept_id: conceptSales, name: "Sales", color: null });
  const items = [customerCard({ frame_id: frameA }), addressCard(), orderCard({ frame_id: frameB }), tableCard()];
  const state = { canvas: canvas(), frames: [free, old], items, ...model };
  const arrange = (input: object = {}) =>
    arrangeCanvasIntoFrames(makeCtx(), access("modeler"), state, { canvasId: canvas1, frames: [fref(free), fref(old)], cards: items.map((i) => sized(i)), ...input });

  it("rebuilds concept and source frames, keeps free frames, and puts every card in its new frame", () => {
    const r = ok(arrange());
    const frames = r.writeSet.writes.filter((w) => w.table === "frame");
    expect(frames.filter((w) => w.kind === "insert").map((w) => [(w.row as Frame).kind, (w.row as Frame).name, (w.row as Frame).x, (w.row as Frame).y])).toEqual([
      ["source_system", "CRM", 0, 0],
      ["concept", "Customer", 320 + 240, 0],
      ["concept", "Sales", 560, 504 + 96], // Customer: two cards of 200 in one column, 40 + 432 + 32
    ]);
    const rows = written(r.writeSet);
    expect(rows[`frame:${frameB}`]).toMatchObject({ deleted_at: NOW });
    expect(rows[`frame:${frameA}`]).toBeUndefined();
    const crmFrame = (frames[0]!.row as Frame).id;
    expect(rows[`canvas_item:${itemCrmCustomer}`]).toMatchObject({ x: 32, y: 40, frame_id: crmFrame });
    // Customer and Customer Address by name, one column (two entities)
    expect(rows[`canvas_item:${itemCustomer}`]).toMatchObject({ x: 592, y: 40, frame_id: (frames[1]!.row as Frame).id });
    expect(rows[`canvas_item:${itemAddress}`]).toMatchObject({ x: 592, y: 272 });
    expect(r.value.frames).toBe(3);
  });

  it("orders a system's tables as the left panel does: by database.schema group, in order of first appearance, then by name", () => {
    const t = (n: number, name: string, schema: string) => sourceTable({ id: `01900000-0000-7000-8000-0000000051${n}0`, name, schema_name: schema });
    const tables = [t(1, "a_table", "sales"), t(2, "b_table", "inv"), t(3, "c_table", "sales")];
    const cards = tables.map((tb, i) => canvasItem(`01900000-0000-7000-8000-00000000d${i}00`, { entity_id: null, source_table_id: tb.id, x: 0, y: i * 300 }));
    const r = ok(
      arrangeCanvasIntoFrames(makeCtx(), access("modeler"), { ...state, items: cards, frames: [], sourceTables: tables }, { canvasId: canvas1, frames: [], cards: cards.map((c) => sized(c, 96)) }),
    );
    const ys = Object.fromEntries(r.value.cards.map((c) => [c.id, c.y]));
    // sales: a_table, c_table; then inv: b_table (96 high, 32 apart)
    expect([ys[cards[0]!.id], ys[cards[2]!.id], ys[cards[1]!.id]]).toEqual([40, 168, 296]);
  });

  it("needs every card of the canvas and every frame it deletes, at the versions the user saw", () => {
    expect(arrange({ cards: items.slice(1).map((i) => sized(i)) })).toMatchObject(refusedAsStale);
    expect(arrange({ frames: [fref(free)] })).toMatchObject(refusedAsStale);
  });

  it("refuses an empty canvas", () => {
    expect(arrangeCanvasIntoFrames(makeCtx(), access("modeler"), { ...state, items: [], frames: [] }, { canvasId: canvas1, frames: [], cards: [] })).toMatchObject({
      ok: false,
      error: { message: "There is nothing on this canvas to arrange." },
    });
  });
});

// ---- permissions (item 19): reviewers and readers may select, zoom and select a frame's cards, which write nothing ----

describe("frame writes and roles (item 19)", () => {
  const fA = frame(frameA);
  const member = customerCard({ frame_id: frameA });
  const state = { canvas: canvas(), frames: [fA], items: [member, tableCard()], ...model };
  const cards = state.items.map((i) => sized(i));
  const writes: [string, (role: "reviewer" | "reader") => CommandResult<unknown>][] = [
    ["create", (role) => createFrame(makeCtx(), access(role), state, { canvasId: canvas1, x: 0, y: 0, width: 480, height: 320, cards })],
    ["update", (role) => updateFrame(makeCtx(), access(role), { frame: fA, ...model }, { frameId: frameA, expectedVersion: 1, name: "X" })],
    ["move", (role) => moveOnCanvas(makeCtx(), access(role), state, { canvasId: canvas1, frames: [{ ...fref(fA), x: 8, y: 8 }], items: [] })],
    ["resize", (role) => resizeFrame(makeCtx(), access(role), state, { frameId: frameA, expectedVersion: 1, width: 600, height: 600, cards: state.items.map(ref) })],
    ["fit", (role) => fitFrameToContent(makeCtx(), access(role), state, { frameId: frameA, expectedVersion: 1, cards })],
    ["delete", (role) => deleteFrame(makeCtx(), access(role), state, { frameId: frameA, expectedVersion: 1, cards: [ref(member)] })],
    ["put in a new frame", (role) => putCardsInNewFrame(makeCtx(), access(role), state, { canvasId: canvas1, cards: [sized(tableCard())] })],
    ["arrange", (role) => arrangeCanvasIntoFrames(makeCtx(), access(role), state, { canvasId: canvas1, frames: [fref(fA)], cards })],
  ];

  it("refuses every frame write to reviewers and readers with the domain's message", () => {
    for (const role of ["reviewer", "reader"] as const) {
      for (const [name, run] of writes) {
        const r = run(role);
        expect(r, `${name} as ${role}`).toMatchObject({ ok: false, error: { code: "forbidden" } });
        if (!r.ok) expect(r.error.message, `${name} as ${role}`).toMatch(/change what is on a canvas/);
      }
    }
  });
});

// ---- collapsed frames (slice 2c, D-07) ----

describe("setFrameCollapsed", () => {
  const set = (collapsed: boolean, f: Frame = frame(frameA), role: "modeler" | "reviewer" | "reader" = "modeler", ws = {}) =>
    setFrameCollapsed(makeCtx(), access(role, ws), { frame: f }, { frameId: frameA, expectedVersion: f.version, collapsed });

  it("collapses a frame and expands it again; nothing else is written", () => {
    const collapsed = ok(set(true));
    expect(collapsed.writeSet.writes).toHaveLength(1);
    expect(collapsed.value.frame).toMatchObject({ collapsed: true, version: 2, x: 0, y: 0, width: 800, height: 600 });
    expect(collapsed.writeSet.events[0]).toMatchObject({ object_type: "frame", operation: "update" });
    expect(ok(set(false, frame(frameA, { collapsed: true }))).value.frame).toMatchObject({ collapsed: false });
  });

  it("refuses nothing to change, a stale version, a deleted frame, reviewers, readers and an archived workspace", () => {
    expect(set(false)).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(setFrameCollapsed(makeCtx(), access("modeler"), { frame: frame(frameA) }, { frameId: frameA, expectedVersion: 7, collapsed: true })).toMatchObject(refusedAsStale);
    expect(set(true, frame(frameA, { deleted_at: NOW }))).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(set(true, frame(frameA), "reviewer")).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(set(true, frame(frameA), "reader")).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(set(true, frame(frameA), "modeler", archived)).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});

describe("setAllFramesCollapsed", () => {
  const fA = frame(frameA), fB = frame(frameB, { collapsed: true, x: 1000 });
  const gone = frame("01900000-0000-7000-8000-00000000f0ff", { deleted_at: NOW });
  const state = { canvas: canvas(), frames: [fA, fB, gone], items: [] };
  const all = (collapsed: boolean, frames = [fref(fA), fref(fB)], role: "modeler" | "reviewer" = "modeler") =>
    setAllFramesCollapsed(makeCtx(), access(role), state, { canvasId: canvas1, frames, collapsed });

  it("collapses every live frame of the canvas in one change group, leaving those already collapsed", () => {
    const r = ok(all(true));
    expect(r.value.frames).toBe(1);
    expect(written(r.writeSet)[`frame:${frameA}`]).toMatchObject({ collapsed: true });
    expect(written(r.writeSet)[`frame:${frameB}`]).toBeUndefined();
    const expanded = ok(all(false));
    expect(expanded.value.frames).toBe(1);
    expect(written(expanded.writeSet)[`frame:${frameB}`]).toMatchObject({ collapsed: false });
  });

  it("needs every frame it changes at the version the user saw, and refuses reviewers", () => {
    expect(all(true, [fref(fB)])).toMatchObject(refusedAsStale);
    expect(all(true, undefined, "reviewer")).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(setAllFramesCollapsed(makeCtx(), access("modeler"), { ...state, frames: [fB] }, { canvasId: canvas1, frames: [fref(fB)], collapsed: true })).toMatchObject({
      ok: false,
      error: { message: "Nothing to change." },
    });
  });
});

describe("collapsed frames and the other frame commands (slice 2c)", () => {
  // a collapsed concept frame (Sales) with one member; its block is 280 × blockHeight(1) = 118 at (0, 0)
  const sales = frame(frameA, { kind: "concept", concept_id: conceptSales, name: "Sales", color: null, x: 0, y: 0, width: 800, height: 386, collapsed: true });
  const member = orderCard({ x: 100, y: 100, frame_id: frameA });
  const loose = customerCard({ x: 2000, y: 0 });
  const state = { canvas: canvas(), frames: [sales], items: [member, loose], entities: model.entities, concepts: model.concepts };
  const drop = (at: { x: number; y: number }, extra: object = {}) =>
    moveOnCanvas(makeCtx(), access("modeler"), state, { canvasId: canvas1, frames: [fref(sales)], items: [{ ...sized(loose), ...at }], ...extra });

  it("a drag drop on the block files the card at the frame's bottom (snapped), grows the frame and asks the concept question", () => {
    const r = ok(drop({ x: 20, y: 10 }, { dragDrop: true }));
    const rows = written(r.writeSet);
    expect(rows[`canvas_item:${itemCustomer}`]).toMatchObject({ x: 32, y: 376, frame_id: frameA }); // 386 − 8 = 378 → 376
    expect(rows[`frame:${frameA}`]).toMatchObject({ height: 376 + 200 + 24, collapsed: true });
    expect(r.value.questions).toEqual([{ cardId: itemCustomer, entityId: customer, conceptId: conceptSales }]);
  });

  it("without a drag drop (nudge, align, line up) a card on the block does not join, and the frame's hidden area takes nothing", () => {
    expect(written(ok(drop({ x: 20, y: 10 })).writeSet)[`canvas_item:${itemCustomer}`]).toMatchObject({ x: 20, y: 10, frame_id: null });
    expect(written(ok(drop({ x: 400, y: 200 }, { dragDrop: true })).writeSet)[`canvas_item:${itemCustomer}`]).toMatchObject({ x: 400, frame_id: null });
  });

  it("moving the collapsed frame carries its hidden cards", () => {
    const r = ok(moveOnCanvas(makeCtx(), access("modeler"), state, { canvasId: canvas1, frames: [{ ...fref(sales), x: 80, y: 40 }], items: [ref(member)] }));
    expect(written(r.writeSet)[`canvas_item:${itemOrder}`]).toMatchObject({ x: 180, y: 140, frame_id: frameA });
  });

  it("resizing and fitting are refused while the frame is collapsed", () => {
    const msg = { ok: false, error: { code: "invalid", message: "Expand the frame first." } };
    expect(resizeFrame(makeCtx(), access("modeler"), state, { frameId: frameA, expectedVersion: 1, width: 900, height: 400, cards: [ref(member), ref(loose)] })).toMatchObject(msg);
    expect(fitFrameToContent(makeCtx(), access("modeler"), state, { frameId: frameA, expectedVersion: 1, cards: [sized(member), sized(loose)] })).toMatchObject(msg);
  });

  it("“Arrange into frames” rebuilds concept and source frames expanded; a collapsed free frame keeps its state (assumption)", () => {
    const freeCollapsed = frame(frameB, { name: "Notes", x: 5000, y: 5000, collapsed: true });
    const r = ok(
      arrangeCanvasIntoFrames(makeCtx(), access("modeler"), { ...state, frames: [sales, freeCollapsed], ...model }, {
        canvasId: canvas1,
        frames: [fref(sales), fref(freeCollapsed)],
        cards: [sized(member), sized(loose)],
      }),
    );
    const built = r.writeSet.writes.filter((w) => w.kind === "insert" && w.table === "frame").map((w) => (w.kind === "insert" ? (w.row as Frame) : null)!);
    expect(built.length).toBeGreaterThan(0);
    expect(built.every((f) => f.collapsed === false)).toBe(true);
    expect(written(r.writeSet)[`frame:${frameB}`]).toBeUndefined();
  });
});

// ---- undo (AD-13): one step restores a frame and its cards together ----

type Rows = { -readonly [T in keyof WorkspaceRows]: WorkspaceRows[T][number][] };

function rowsOf(items: CanvasItem[], frames: Frame[], entities: Entity[] = model.entities): Rows {
  return {
    project: [],
    canvas: [canvas()],
    project_canvas: [],
    concept: model.concepts,
    entity: entities,
    attribute: [],
    relationship: [],
    source_system: model.sourceSystems,
    source_table: model.sourceTables,
    source_column: [],
    mapping: [],
    mapping_input: [],
    canvas_item: items,
    frame: frames,
    label: [],
    label_link: [],
    project_pinned_label: [],
    note: [],
  };
}

function apply(rows: Rows, ws: WriteSet): Rows {
  const next = structuredClone(rows) as unknown as Record<string, Record<string, unknown>[]>;
  for (const w of ws.writes) {
    if (w.kind === "remove") continue;
    const list = next[w.table]!;
    const row = structuredClone(w.row) as unknown as Record<string, unknown>;
    const i = list.findIndex((r) => r.id === row.id);
    if (i === -1) list.push(row);
    else list[i] = row;
  }
  return next as unknown as Rows;
}

const undo = (rows: Rows, ws: WriteSet) => {
  const r = revertChangeGroup(makeCtx(), access("modeler"), { events: ws.events, rows }, "undo");
  if (!r.ok) throw new Error(r.error.message);
  return apply(rows, r.writeSet);
};

describe("undo of frame steps", () => {
  it("one undo step expands a collapsed frame again (slice 2c)", () => {
    const fA = frame(frameA);
    const before = rowsOf([], [fA]);
    const collapsed = ok(setFrameCollapsed(makeCtx(), access("modeler"), { frame: fA }, { frameId: frameA, expectedVersion: 1, collapsed: true }));
    const after = undo(apply(before, collapsed.writeSet), collapsed.writeSet);
    expect(after.frame[0]).toMatchObject({ collapsed: false });
  });

  it("takes a drawn frame away and frees the cards it took", () => {
    const before = rowsOf([customerCard()], []);
    const created = ok(createFrame(makeCtx(), access("modeler"), { canvas: canvas(), frames: [], items: before.canvas_item }, { canvasId: canvas1, x: 0, y: 0, width: 800, height: 600, cards: [sized(customerCard())] }));
    const after = undo(apply(before, created.writeSet), created.writeSet);
    expect(after.frame[0]).toMatchObject({ deleted_at: NOW });
    expect(after.canvas_item[0]).toMatchObject({ frame_id: null });
  });

  it("brings a deleted frame back with its cards", () => {
    const fA = frame(frameA);
    const member = customerCard({ frame_id: frameA });
    const before = rowsOf([member], [fA]);
    const deleted = ok(deleteFrame(makeCtx(), access("modeler"), { canvas: canvas(), frames: [fA], items: [member] }, { frameId: frameA, expectedVersion: 1, cards: [ref(member)] }));
    const after = undo(apply(before, deleted.writeSet), deleted.writeSet);
    expect(after.frame[0]).toMatchObject({ deleted_at: null, name: "Area" });
    expect(after.canvas_item[0]).toMatchObject({ frame_id: frameA });
  });

  it("puts back a drop and the concept change it made together", () => {
    const sales = frame(frameA, { kind: "concept", concept_id: conceptSales, name: "Sales", color: null });
    const card = customerCard({ x: 2000, y: 0 });
    const before = rowsOf([card], [sales]);
    const dropped = ok(
      moveOnCanvas(makeCtx(), access("modeler"), { canvas: canvas(), frames: [sales], items: [card], entities: model.entities, concepts: model.concepts }, {
        canvasId: canvas1,
        frames: [fref(sales)],
        items: [{ ...sized(card), x: 100, y: 100 }],
        moveToConcepts: true,
      }),
    );
    const after = undo(apply(before, dropped.writeSet), dropped.writeSet);
    expect(after.canvas_item[0]).toMatchObject({ x: 2000, y: 0, frame_id: null });
    expect(after.entity.find((e) => e.id === customer)).toMatchObject({ concept_id: conceptCustomer });
  });

  it("refuses to undo a drawn frame that a card joined afterwards", () => {
    const before = rowsOf([customerCard(), tableCard({ x: 3000 })], []);
    const created = ok(createFrame(makeCtx(), access("modeler"), { canvas: canvas(), frames: [], items: before.canvas_item }, { canvasId: canvas1, x: 0, y: 0, width: 800, height: 600, cards: [] }));
    const withFrame = apply(before, created.writeSet);
    const newFrame = withFrame.frame[0]!;
    const table = withFrame.canvas_item[1]!;
    const dropped = ok(
      moveOnCanvas(makeCtx(), access("modeler"), { canvas: canvas(), frames: [newFrame], items: withFrame.canvas_item, entities: model.entities, concepts: model.concepts }, {
        canvasId: canvas1,
        frames: [fref(newFrame)],
        items: [{ ...sized(table), x: 100, y: 100 }],
      }),
    );
    const later = apply(withFrame, dropped.writeSet);
    expect(revertChangeGroup(makeCtx(), access("modeler"), { events: created.writeSet.events, rows: later }, "undo")).toMatchObject({ ok: false, error: { code: "conflict" } });
  });
});
