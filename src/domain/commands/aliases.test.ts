// Slice 11 (D-64): an alias through updateEntity and updateAttribute, the canvas's names or aliases with the cards'
// exceptions it clears, a card's exception, their undo and redo, and the alias in a paste.

import { describe, expect, it } from "vitest";
import { access, archived, attribute, canvas, canvasItem, concept, entity, ids, makeCtx, NOW } from "../__fixtures__/domain";
import type { CommandResult, WriteSet } from "../changes";
import { STALE_VERSION_MESSAGE } from "../errors";
import { namesControl } from "../model/aliases";
import { changeLabel } from "../model/change-label";
import type { Attribute, Canvas, CanvasItem } from "../types";
import { updateAttribute, pasteAttribute } from "./attribute";
import { CANVAS_NAMES_LABEL, setCanvasNames } from "./canvas";
import { ALIASES_ON_ENTITY_CARDS, CARD_NAMES_LABEL, updateCanvasItem } from "./canvas-item";
import { updateEntity } from "./entity";
import { revertChangeGroup, UNDOABLE_TABLES, type UndoableTable, type WorkspaceRows } from "./undo";

const { customer, salesOrder, customerId, email, canvas1, itemCustomer, itemCrmCustomer } = ids;
const address = "01900000-0000-7000-8000-000000004003";
const itemOrder = "01900000-0000-7000-8000-00000000c003";
const itemAddress = "01900000-0000-7000-8000-00000000c004";
const itemOther = "01900000-0000-7000-8000-00000000c005";

function ok<T>(r: CommandResult<T>): { value: T; writeSet: WriteSet } {
  if (!r.ok) throw new Error(r.error.message);
  return r;
}
const refused = (code: string) => ({ ok: false, error: { code } });
const nothing = { ok: false, error: { code: "invalid", message: "Nothing to change." } };
const roles = ["reviewer", "reader"] as const;

// ---- the alias (items 1, 6) ----

describe("an entity's alias", () => {
  const state = (over: Parameters<typeof entity>[1] = {}) => ({ entity: entity(customer, over), entities: [entity(customer, over)], concept: null });
  const ref = { entityId: customer, expectedVersion: 1 };

  it("is saved trimmed, in one change group, named “Change entity alias” in the undo history", () => {
    const r = ok(updateEntity(makeCtx(), access("modeler"), state(), { ...ref, alias: "  Klient " }));
    expect(r.value.entity).toMatchObject({ name: "Customer", alias: "Klient", version: 2 });
    expect(r.writeSet.events).toHaveLength(1);
    expect(r.writeSet.events[0]).toMatchObject({ object_type: "entity", before_image: { alias: null }, after_image: { alias: "Klient" } });
    expect(changeLabel(r.writeSet.events)).toBe("Change entity alias");
  });

  it("is cleared by an empty or blank text, stored as null; the same alias again is nothing to change", () => {
    for (const alias of ["", "   ", null]) {
      expect(ok(updateEntity(makeCtx(), access("modeler"), state({ alias: "Klient" }), { ...ref, alias })).value.entity.alias).toBeNull();
    }
    expect(updateEntity(makeCtx(), access("modeler"), state({ alias: "Klient" }), { ...ref, alias: " Klient" })).toMatchObject(nothing);
    expect(updateEntity(makeCtx(), access("modeler"), state(), { ...ref, alias: "" })).toMatchObject(nothing);
  });

  it("may repeat another entity's alias or a name, with no warning", () => {
    const other = entity(salesOrder, { alias: "Klient" });
    const r = ok(updateEntity(makeCtx(), access("modeler"), { entity: entity(customer), entities: [entity(customer), other], concept: null }, { ...ref, alias: "Klient" }));
    expect(r.value.warning).toBeNull();
    expect(ok(updateEntity(makeCtx(), access("modeler"), state(), { ...ref, alias: "Sales Order" })).value.warning).toBeNull();
  });

  it("has the name's rights: refused to reviewers and readers, in an archived workspace, and at a stale version", () => {
    for (const role of roles) expect(updateEntity(makeCtx(), access(role), state(), { ...ref, alias: "Klient" })).toMatchObject(refused("forbidden"));
    expect(updateEntity(makeCtx(), access("owner", archived), state(), { ...ref, alias: "Klient" })).toMatchObject(refused("archived"));
    expect(updateEntity(makeCtx(), access("owner"), state(), { ...ref, expectedVersion: 7, alias: "Klient" })).toMatchObject(refused("stale_version"));
  });
});

describe("an attribute's alias", () => {
  const ref = { attributeId: customerId, expectedVersion: 1 };
  const state = (over: Partial<Attribute> = {}, rows: Attribute[] = []) => {
    const a = attribute(customerId, over);
    return { attribute: a, attributes: [a, ...rows] };
  };

  it("is saved trimmed, in one change group, named “Change attribute alias”; empty clears it", () => {
    const r = ok(updateAttribute(makeCtx(), access("modeler"), state(), { ...ref, alias: " Numer klienta " }));
    expect(r.value.attribute).toMatchObject({ name: "customer_id", alias: "Numer klienta", version: 2 });
    expect(r.writeSet.events).toHaveLength(1);
    expect(changeLabel(r.writeSet.events)).toBe("Change attribute alias");
    expect(ok(updateAttribute(makeCtx(), access("modeler"), state({ alias: "Numer klienta" }), { ...ref, alias: "" })).value.attribute.alias).toBeNull();
    expect(updateAttribute(makeCtx(), access("modeler"), state({ alias: "Numer klienta" }), { ...ref, alias: "Numer klienta" })).toMatchObject(nothing);
  });

  it("is a copy's own: allowed on a copy with a link, and an original's alias reaches no copy (P10)", () => {
    const copy = attribute(email, { name: "customer_id", copied_from_attribute_id: customerId, data_type: "integer", type_length: null, is_pii: false });
    const onCopy = ok(updateAttribute(makeCtx(), access("modeler"), { attribute: copy, attributes: [attribute(customerId), copy] }, { attributeId: email, expectedVersion: 1, alias: "Kopia" }));
    expect(onCopy.value.attribute).toMatchObject({ alias: "Kopia", copied_from_attribute_id: customerId });
    const onOriginal = ok(updateAttribute(makeCtx(), access("modeler"), state({}, [copy]), { ...ref, alias: "Numer klienta" }));
    expect(onOriginal.writeSet.writes).toHaveLength(1);
    expect(onOriginal.writeSet.followers).toBeUndefined();
  });

  it("has the name's rights: refused to reviewers and readers and in an archived workspace", () => {
    for (const role of roles) expect(updateAttribute(makeCtx(), access(role), state(), { ...ref, alias: "x" })).toMatchObject(refused("forbidden"));
    expect(updateAttribute(makeCtx(), access("owner", archived), state(), { ...ref, alias: "x" })).toMatchObject(refused("archived"));
  });
});

describe("pasteAttribute and the alias (P10, D-63's addition)", () => {
  it("copies the original's alias once, with the name and definition", () => {
    const original = attribute(customerId, { alias: "Numer klienta" });
    const r = ok(pasteAttribute(makeCtx(), access("modeler"), { entity: entity(salesOrder), original, attributes: [original] }, { entityId: salesOrder, attributeId: customerId }));
    const w = r.writeSet.writes[0]!;
    if (w.kind !== "insert" || w.table !== "attribute") throw new Error("not an attribute insert");
    expect(w.row).toMatchObject({ name: "customer_id", alias: "Numer klienta", copied_from_attribute_id: customerId });
    // an original without an alias gives a copy without one
    const plain = attribute(customerId);
    const p = ok(pasteAttribute(makeCtx(), access("modeler"), { entity: entity(salesOrder), original: plain, attributes: [plain] }, { entityId: salesOrder, attributeId: customerId }));
    expect((p.writeSet.writes[0] as { row: Attribute }).row.alias).toBeNull();
  });
});

// ---- a card's exception (items 3, 9) ----

const customerCard = (over: Partial<CanvasItem> = {}) => canvasItem(itemCustomer, over);
const orderCard = (over: Partial<CanvasItem> = {}) => canvasItem(itemOrder, { entity_id: salesOrder, x: 800, ...over });
const addressCard = (over: Partial<CanvasItem> = {}) => canvasItem(itemAddress, { entity_id: address, x: 100, y: 600, ...over });
const tableCard = (over: Partial<CanvasItem> = {}) => canvasItem(itemCrmCustomer, { x: 1200, ...over });
const ref = (i: CanvasItem) => ({ canvasItemId: i.id, expectedVersion: i.version });

describe("a card's names or aliases (updateCanvasItem)", () => {
  const set = (item: CanvasItem, input: object, over: { canvas?: Canvas | null; role?: Parameters<typeof access>[0]; ws?: object } = {}) =>
    updateCanvasItem(makeCtx(), access(over.role ?? "modeler", over.ws ?? {}), { item, canvas: over.canvas === undefined ? canvas() : over.canvas }, { ...ref(item), ...input });

  it("stores an exception that differs from the canvas's mode, one change group, named after what the card shows", () => {
    const r = ok(set(customerCard(), { entityNames: "alias" }));
    expect(r.value.item).toMatchObject({ entity_names: "alias", attribute_names: null, version: 2 });
    expect(r.writeSet.events).toHaveLength(1);
    expect(r.writeSet.label).toBe(CARD_NAMES_LABEL.entity.alias);
    const a = ok(set(customerCard(), { attributeNames: "alias" }));
    expect(a.value.item).toMatchObject({ entity_names: null, attribute_names: "alias" });
    expect(a.writeSet.label).toBe("Show attribute aliases on card");
    // on a canvas that shows aliases, the card's “Name” is the exception
    const n = ok(set(customerCard(), { entityNames: "name" }, { canvas: canvas(canvas1, { entity_names: "alias" }) }));
    expect(n.value.item.entity_names).toBe("name");
    expect(n.writeSet.label).toBe("Show entity name on card");
  });

  it("stores an exception equal to the canvas's mode as null, and clears one that way", () => {
    // equal to the canvas's mode from the start: nothing to store
    expect(set(customerCard(), { entityNames: "name" })).toMatchObject(nothing);
    expect(set(customerCard(), { attributeNames: "alias" }, { canvas: canvas(canvas1, { attribute_names: "alias" }) })).toMatchObject(nothing);
    // an exception set back to the canvas's mode is cleared
    const cleared = ok(set(customerCard({ entity_names: "alias" }), { entityNames: "name" }));
    expect(cleared.value.item.entity_names).toBeNull();
    expect(cleared.writeSet.label).toBe(CARD_NAMES_LABEL.entity.name);
    const viaNull = ok(set(customerCard({ attribute_names: "name" }), { attributeNames: null }, { canvas: canvas(canvas1, { attribute_names: "alias" }) }));
    expect(viaNull.value.item.attribute_names).toBeNull();
    expect(viaNull.writeSet.label).toBe(CARD_NAMES_LABEL.attribute.alias);
  });

  it("is refused on table and requirement cards, and without the card's canvas", () => {
    expect(set(tableCard(), { entityNames: "alias" })).toMatchObject({ ok: false, error: { code: "invalid", message: ALIASES_ON_ENTITY_CARDS } });
    const req = canvasItem(itemOther, { entity_id: null, requirement_id: ids.req101 });
    expect(set(req, { attributeNames: "alias" })).toMatchObject({ ok: false, error: { message: ALIASES_ON_ENTITY_CARDS } });
    expect(set(customerCard(), { entityNames: "alias" }, { canvas: null })).toMatchObject(refused("not_found"));
    expect(set(customerCard(), { entityNames: "alias" }, { canvas: canvas(ids.canvas2) })).toMatchObject(refused("not_found"));
  });

  it("is for editors: refused to reviewers and readers, in an archived workspace, at a stale version", () => {
    for (const role of roles) expect(set(customerCard(), { entityNames: "alias" }, { role })).toMatchObject(refused("forbidden"));
    expect(set(customerCard(), { entityNames: "alias" }, { role: "owner", ws: archived })).toMatchObject(refused("archived"));
    expect(updateCanvasItem(makeCtx(), access("modeler"), { item: customerCard(), canvas: canvas() }, { canvasItemId: itemCustomer, expectedVersion: 9, entityNames: "alias" })).toMatchObject(refused("stale_version"));
    expect(set(customerCard(), { entityNames: "both" })).toMatchObject(refused("invalid"));
  });

  it("keeps the earlier changes' undo names: a row filter alone is still “Filter card rows”", () => {
    const r = ok(set(customerCard(), { rowFilter: "mapped" }));
    expect(r.writeSet.label).toBeUndefined();
    expect(changeLabel(r.writeSet.events)).toBe("Filter card rows");
  });
});

// ---- the canvas's mode (item 8) ----

type Rows = { [T in UndoableTable]: unknown[] };
function apply(rows: Rows, ws: WriteSet): Rows {
  const next = structuredClone(rows) as unknown as Record<string, { id: string }[]>;
  for (const w of ws.writes) {
    if (w.kind === "remove") continue;
    const list = next[w.table]!;
    const row = structuredClone(w.row) as unknown as { id: string };
    const i = list.findIndex((r) => r.id === row.id);
    if (i === -1) list.push(row);
    else list[i] = row;
  }
  return next as unknown as Rows;
}
const revert = (rows: Rows, events: WriteSet["events"], mode: "undo" | "redo") => {
  const r = ok(revertChangeGroup(makeCtx(), access("modeler"), { events, rows: rows as unknown as WorkspaceRows }, mode));
  return { rows: apply(rows, r.writeSet), writeSet: r.writeSet };
};
const view = (rows: Rows) => rows as unknown as { canvas: Canvas[]; canvas_item: CanvasItem[] };

describe("the canvas's names or aliases (setCanvasNames)", () => {
  const items = [customerCard({ entity_names: "alias" }), orderCard({ attribute_names: "alias" }), addressCard(), tableCard()];
  const names = (input: object, over: { canvas?: Canvas; items?: CanvasItem[]; role?: Parameters<typeof access>[0]; ws?: object; cards?: object[] } = {}) => {
    const list = over.items ?? items;
    return setCanvasNames(makeCtx(), access(over.role ?? "modeler", over.ws ?? {}), { canvas: over.canvas ?? canvas(), items: list }, {
      canvasId: canvas1,
      cards: over.cards ?? list.map(ref),
      ...input,
    });
  };

  it("sets the canvas's mode and clears every card's exception in that dimension only, in one change group", () => {
    const r = ok(names({ dimension: "entity", mode: "alias" }));
    expect(r.writeSet.writes.map((w) => `${w.table}:${(w as { row: { id: string } }).row.id}`)).toEqual([`canvas:${canvas1}`, `canvas_item:${itemCustomer}`]);
    expect(r.value.canvas).toMatchObject({ entity_names: "alias", attribute_names: null, version: 3 });
    expect((r.writeSet.writes[1] as { row: CanvasItem }).row).toMatchObject({ entity_names: null, attribute_names: null });
    expect(r.value).toMatchObject({ cards: 1, versions: { [canvas1]: 3, [itemCustomer]: 2 } });
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    expect(r.writeSet.label).toBe(CANVAS_NAMES_LABEL.entity.alias);
  });

  it("the mixed case: an exception equal to the new mode is cleared too, and the canvas row is written only when its mode changes", () => {
    // the canvas shows aliases; Customer's card shows names: “indeterminate”, a click shows aliases everywhere
    const mixed = [customerCard({ entity_names: "name" }), orderCard()];
    const onAliases = canvas(canvas1, { entity_names: "alias" });
    expect(namesControl(onAliases, mixed, "entity")).toBe("mixed");
    const r = ok(names({ dimension: "entity", mode: "alias" }, { canvas: onAliases, items: mixed }));
    expect(r.writeSet.writes).toHaveLength(1);
    expect(r.writeSet.writes[0]).toMatchObject({ table: "canvas_item", row: { id: itemCustomer, entity_names: null } });
    expect(r.value).toMatchObject({ canvas: onAliases, cards: 1 });
    expect(namesControl(r.value.canvas, [(r.writeSet.writes[0] as { row: CanvasItem }).row, mixed[1]!], "entity")).toBe("alias");
    // a card whose exception already equals the new mode is cleared as well: it would follow the canvas anyway
    const same = ok(names({ dimension: "attribute", mode: "alias" }));
    expect(same.writeSet.writes.map((w) => w.table)).toEqual(["canvas", "canvas_item"]);
    expect(same.writeSet.writes[1]).toMatchObject({ row: { id: itemOrder, attribute_names: null } });
  });

  it("stores names as null, the canvas's default", () => {
    const r = ok(names({ dimension: "attribute", mode: "name" }, { canvas: canvas(canvas1, { attribute_names: "alias" }), items: [addressCard()] }));
    expect(r.value.canvas.attribute_names).toBeNull();
    expect(r.writeSet.label).toBe("Show attribute names");
  });

  it("writes nothing when the mode is set and no card has an exception there", () => {
    expect(names({ dimension: "entity", mode: "name" }, { items: [addressCard(), orderCard({ attribute_names: "alias" })] })).toMatchObject(nothing);
    expect(names({ dimension: "attribute", mode: "alias" }, { canvas: canvas(canvas1, { attribute_names: "alias" }), items: [customerCard({ entity_names: "alias" })] })).toMatchObject(nothing);
  });

  it("checks the cards it clears, all or nothing, but not the canvas row's version (F2)", () => {
    const stale = { ok: false, error: { code: "stale_version", message: STALE_VERSION_MESSAGE } };
    expect(names({ dimension: "entity", mode: "alias" }, { cards: [{ ...ref(items[0]!), expectedVersion: 5 }] })).toMatchObject(stale);
    expect(names({ dimension: "entity", mode: "alias" }, { cards: [] })).toMatchObject(stale);
    // cards it does not clear may be missing or stale
    expect(names({ dimension: "entity", mode: "alias" }, { cards: [ref(items[0]!), { ...ref(items[2]!), expectedVersion: 9 }] })).toMatchObject({ ok: true });
    // the canvas row is read as it stands: the input carries no version of it
    expect(names({ dimension: "entity", mode: "alias", expectedVersion: 2 })).toMatchObject(refused("invalid"));
    expect(names({ dimension: "entity", mode: "alias" }, { canvas: canvas(canvas1, { version: 41 }) })).toMatchObject({ ok: true });
  });

  it("is for editors: refused to reviewers and readers, in an archived workspace, and on a deleted or other canvas", () => {
    for (const role of roles) expect(names({ dimension: "entity", mode: "alias" }, { role })).toMatchObject(refused("forbidden"));
    expect(names({ dimension: "entity", mode: "alias" }, { role: "owner", ws: archived })).toMatchObject(refused("archived"));
    expect(names({ dimension: "entity", mode: "alias" }, { canvas: canvas(canvas1, { deleted_at: NOW }) })).toMatchObject(refused("not_found"));
    expect(names({ dimension: "entity", mode: "alias" }, { canvas: canvas(ids.canvas2) })).toMatchObject(refused("not_found"));
    expect(names({ dimension: "row", mode: "alias" })).toMatchObject(refused("invalid"));
  });

  it("one undo restores the mode and three cleared exceptions; redo clears them again (S11-11)", () => {
    const three = [customerCard({ attribute_names: "alias" }), orderCard({ attribute_names: "alias" }), addressCard({ attribute_names: "alias", entity_names: "alias" }), tableCard()];
    const rows: Rows = {
      ...(Object.fromEntries(UNDOABLE_TABLES.map((t) => [t, []])) as unknown as Rows),
      canvas: [canvas()],
      canvas_item: three,
      concept: [concept(ids.conceptCustomer), concept(ids.conceptSales)],
      entity: [entity(customer), entity(salesOrder), entity(address, { concept_id: ids.conceptCustomer, name: "Address" })],
    };
    const r = ok(setCanvasNames(makeCtx(), access("modeler"), { canvas: canvas(), items: three }, { canvasId: canvas1, dimension: "attribute", mode: "alias", cards: three.map(ref) }));
    expect(r.value.cards).toBe(3);
    const done = apply(rows, r.writeSet);
    expect(view(done).canvas[0]!.attribute_names).toBe("alias");
    expect(view(done).canvas_item.map((i) => i.attribute_names)).toEqual([null, null, null, null]);

    const undone = revert(done, r.writeSet.events, "undo");
    expect(view(undone.rows).canvas[0]).toMatchObject({ attribute_names: null, entity_names: null, look: canvas().look });
    expect(view(undone.rows).canvas_item.map((i) => i.attribute_names)).toEqual(["alias", "alias", "alias", null]);
    // the other dimension is untouched throughout
    expect(view(undone.rows).canvas_item[2]!.entity_names).toBe("alias");
    expect(namesControl(view(undone.rows).canvas[0]!, view(undone.rows).canvas_item, "attribute")).toBe("mixed");

    const redone = revert(undone.rows, undone.writeSet.events, "redo");
    expect(view(redone.rows).canvas[0]!.attribute_names).toBe("alias");
    expect(view(redone.rows).canvas_item.map((i) => i.attribute_names)).toEqual([null, null, null, null]);
    expect(view(redone.rows).canvas_item[2]!.entity_names).toBe("alias");
  });

  it("one undo restores a card's exception", () => {
    const card = customerCard();
    const rows: Rows = {
      ...(Object.fromEntries(UNDOABLE_TABLES.map((t) => [t, []])) as unknown as Rows),
      canvas: [canvas()],
      canvas_item: [card],
      concept: [concept(ids.conceptCustomer)],
      entity: [entity(customer)],
    };
    const r = ok(updateCanvasItem(makeCtx(), access("modeler"), { item: card, canvas: canvas() }, { ...ref(card), entityNames: "alias" }));
    const undone = revert(apply(rows, r.writeSet), r.writeSet.events, "undo");
    expect(view(undone.rows).canvas_item[0]!.entity_names).toBeNull();
  });
});
