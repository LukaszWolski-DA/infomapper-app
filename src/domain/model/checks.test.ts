// Slice 20: InfoMapper's model checks, their edges and the index (acceptance doc, step 1 answers 1, 2, 5, 6, 7, 8).

import { describe, expect, it } from "vitest";
import { attribute, canvasItem, entity, ids, mapping, mappingInput, relationship, sourceColumn, sourceTable } from "../__fixtures__/domain";
import type { Attribute, AttributeInput, Entity, Relationship, WorkspaceModel } from "../types";
import { checkIndex, coverageGapText, infoMapperGroups, keyOfCopy, lineOf, markTitle, modelChecks, nameKey, oneAndMany, projectScope, type CheckInput, type ModuleChecks } from "./checks";
import { lookupModel, type AttributeFeeds } from "./requirements";

const uid = (n: number) => `01900000-0000-7000-8000-2000000${String(n).padStart(5, "0")}`;
const T = "2026-11-08T10:00:00.000Z";
const LINE = uid(1); // Order Line
const PRODUCT = uid(2);
const lineOrderId = uid(11);
const custOrderId = uid(12);

type Model = Pick<WorkspaceModel, "entities" | "attributes" | "relationships" | "attributeInputs" | "lostOriginals" | "mappings" | "mappingInputs" | "sourceTables" | "sourceColumns">;

/** Customer 1 – n Sales Order 1 – n Order Line; Sales Order.order_id is the key; Order Line.order_id a copy of it. */
function base(): Model {
  return {
    entities: [entity(ids.customer), entity(ids.salesOrder), entity(LINE, { name: "Order Line" })],
    attributes: [
      attribute(ids.customerId),
      attribute(ids.email),
      attribute(ids.orderId),
      attribute(lineOrderId, { entity_id: LINE, name: "order_id", is_primary_key: false, is_foreign_key: true, copied_from_attribute_id: ids.orderId }),
      attribute(uid(15), { entity_id: ids.salesOrder, name: "customer_id", sort_order: 1, is_primary_key: false, is_foreign_key: true, copied_from_attribute_id: ids.customerId }),
    ],
    relationships: [relationship(), relationship({ id: uid(21), from_entity_id: ids.salesOrder, to_entity_id: LINE, label: "contains" })],
    attributeInputs: [],
    lostOriginals: [],
    mappings: [],
    mappingInputs: [],
    sourceTables: [sourceTable()],
    sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail)],
  };
}

const input = (m: Model, scope: Set<string> | null = null, feeds: AttributeFeeds = {}): CheckInput => ({ model: m, lookup: lookupModel(m, feeds), scope });
const groups = (m: Model, scope: Set<string> | null = null, feeds?: AttributeFeeds) => Object.fromEntries(infoMapperGroups(input(m, scope, feeds)).map((g) => [g.id, g.items.map(lineOf)]));
const with_ = (m: Model, over: Partial<Model>): Model => ({ ...m, ...over });
const add = (m: Model, ...attributes: Attribute[]): Model => ({ ...m, attributes: [...m.attributes, ...attributes] });

describe("a clean model", () => {
  it("has no line when the keys are copied the right way", () => {
    const g = groups(base());
    expect(Object.values(g).flat()).toEqual([]);
    expect(modelChecks(input(base())).count).toBe(0);
  });
});

describe("duplicate names (answer 2)", () => {
  it("trims, collapses runs of spaces and ignores case, per entity, both levels", () => {
    expect(nameKey("  Product  Name ")).toBe(nameKey("product name"));
    expect(nameKey("product_name")).not.toBe(nameKey("productname"));
    const dim = entity(PRODUCT, { name: "Dim Product", model_level: "dimensional" });
    const m = add(
      with_(base(), { entities: [...base().entities, dim] }),
      attribute(uid(31), { name: "E-mail ", sort_order: 2 }),
      attribute(uid(32), { name: "e-MAIL", sort_order: 3 }),
      attribute(uid(33), { entity_id: PRODUCT, name: "Name", sort_order: 0 }),
      attribute(uid(34), { entity_id: PRODUCT, name: "name", sort_order: 1 }),
      // the same name in another entity is no duplicate
      attribute(uid(35), { entity_id: LINE, name: "email" }),
    );
    const dup = groups(m).dup!;
    expect(dup.map((l) => [l.name, l.detail])).toEqual([
      ["Customer: E-mail , e-MAIL", "2 attributes, one name"],
      ["Dim Product: Name, name", "2 attributes, one name"],
    ]);
    expect(dup[0]!.go).toEqual({ t: "attribute", id: uid(32) });
    expect(dup[0]!.marks).toEqual([{ t: "attribute", id: uid(31) }, { t: "attribute", id: uid(32) }]);
  });
});

describe("calculated and mapped", () => {
  const inputRow = (attribute_id: string, input_attribute_id: string, id: string): AttributeInput => ({ id, workspace_id: ids.ws, attribute_id, input_attribute_id, sort_order: 0, version: 1, created_at: T, created_by: ids.actor, updated_at: T, updated_by: ids.actor, deleted_at: null });
  it("names a calculated logical attribute with a mapping of its own, any status, and its inputs", () => {
    const m = with_(add(base(), attribute(ids.email, { is_calculated: true, calc_rule: "x" })), {
      attributes: base().attributes.map((a) => (a.id === ids.email ? { ...a, is_calculated: true, calc_rule: "x" } : a)),
      attributeInputs: [inputRow(ids.email, ids.customerId, uid(41))],
      mappings: [mapping()],
      mappingInputs: [mappingInput()],
    });
    expect(groups(m).calc!.map((l) => [l.name, l.detail])).toEqual([["Customer.email", "calculated from 1, also 1 mapping"]]);
  });
  it("counts a dimensional attribute's feeds", () => {
    const dim = entity(PRODUCT, { name: "Fact Sales", model_level: "dimensional" });
    const m = add(with_(base(), { entities: [...base().entities, dim] }), attribute(uid(42), { entity_id: PRODUCT, name: "net", is_primary_key: false, is_calculated: true, calc_rule: "q*p" }));
    const feeds: AttributeFeeds = { [uid(42)]: [{ id: uid(43), approved: false, typeConflict: false, inputs: [ids.email] }, { id: uid(44), approved: true, typeConflict: false, inputs: [ids.email] }] };
    expect(groups(m, null, feeds).calc!.map((l) => l.detail)).toEqual(["calculated from 0, also 2 feeds"]);
  });
  it("leaves a calculation without a mapping alone", () => {
    const m = with_(base(), { attributes: base().attributes.map((a) => (a.id === ids.email ? { ...a, is_calculated: true } : a)) });
    expect(groups(m).calc).toEqual([]);
  });
});

describe("copies whose original was deleted (both levels)", () => {
  it("names the lost original from the model's lostOriginals, at either level", () => {
    const dim = entity(PRODUCT, { name: "Dim Customer", model_level: "dimensional" });
    const m = with_(
      add(with_(base(), { entities: [...base().entities, dim] }), attribute(uid(51), { entity_id: PRODUCT, name: "key", copied_from_attribute_id: uid(99) }), attribute(uid(52), { name: "orphan", copied_from_attribute_id: uid(98) })),
      { lostOriginals: [{ id: uid(99), name: "customer_key", entityName: "Dim Old" }] },
    );
    expect(groups(m).lost!.map((l) => [l.name, l.detail])).toEqual([
      ["Customer.orphan", "copy of an attribute, which was deleted"],
      ["Dim Customer.key", "copy of Dim Old.customer_key, which was deleted"],
    ]);
  });
  it("makes a copy of a deleted key lost, and no key line for it (no relationship, wrong way)", () => {
    const m = with_(base(), { attributes: base().attributes.filter((a) => a.id !== ids.orderId), lostOriginals: [{ id: ids.orderId, name: "order_id", entityName: "Sales Order" }] });
    const g = groups(m);
    expect(g.lost!.map((l) => l.name)).toEqual(["Order Line.order_id"]);
    expect([...g.norel!, ...g.wrong!]).toEqual([]);
    // Sales Order has no primary key now: nothing to copy, no "no copied key" line
    expect(g.nokey).toEqual([]);
  });
});

describe("a copy's key: the end of its chain (answer 5)", () => {
  it("follows copies of copies, and stops at a lost link or a cycle", () => {
    const m = add(base(), attribute(uid(61), { entity_id: PRODUCT, name: "order_id", copied_from_attribute_id: lineOrderId }));
    const byId = new Map(m.attributes.map((a) => [a.id, a]));
    expect(keyOfCopy(uid(61), (id) => byId.get(id))?.id).toBe(ids.orderId);
    expect(keyOfCopy(ids.orderId, (id) => byId.get(id))).toBeNull();
    byId.set(uid(62), attribute(uid(62), { copied_from_attribute_id: uid(63) }));
    byId.set(uid(63), attribute(uid(63), { copied_from_attribute_id: uid(62) }));
    expect(keyOfCopy(uid(62), (id) => byId.get(id))).toBeNull();
    byId.set(uid(64), attribute(uid(64), { copied_from_attribute_id: uid(65) }));
    expect(keyOfCopy(uid(64), (id) => byId.get(id))).toBeNull();
  });
  it("counts a copy of a copy as the key's copy for no copied key", () => {
    // Order Line.order_id copied from another copy of Sales Order.order_id in Customer
    const m = with_(base(), {
      attributes: [...base().attributes.filter((a) => a.id !== lineOrderId), attribute(custOrderId, { name: "ord", sort_order: 4, is_primary_key: false, copied_from_attribute_id: ids.orderId }), attribute(lineOrderId, { entity_id: LINE, name: "o", is_primary_key: false, copied_from_attribute_id: custOrderId })],
    });
    const g = groups(m);
    expect(g.nokey).toEqual([]);
    // Customer is the one side of "places": its copy of Sales Order's key is the wrong way, named by the key
    expect(g.wrong!.map((l) => [l.name, l.detail])).toEqual([["Customer.ord", "copy of Sales Order.order_id, but Customer is the one side of “places”"]]);
    expect(g.wrong![0]!.panels).toEqual([{ t: "attribute", id: custOrderId }, { t: "relationship", id: ids.relPlaces }]);
  });
});

describe("keys copied without a relationship (logical)", () => {
  it("names a copied primary key between two unrelated entities, not one within its own entity", () => {
    const m = add(
      with_(base(), { entities: [...base().entities, entity(PRODUCT, { name: "Product" })] }),
      attribute(uid(71), { entity_id: PRODUCT, name: "customer_id", copied_from_attribute_id: ids.customerId }),
      attribute(uid(72), { name: "customer_id_2", copied_from_attribute_id: ids.customerId }),
      attribute(uid(73), { entity_id: PRODUCT, name: "email", copied_from_attribute_id: ids.email }),
    );
    expect(groups(m).norel!.map((l) => [l.name, l.detail])).toEqual([["Product.customer_id", "copy of Customer.customer_id; Product and Customer are not related"]]);
  });
  it("is logical only: a dimensional copy is InfoCube's hint", () => {
    const m = add(with_(base(), { entities: [...base().entities, entity(PRODUCT, { name: "Fact", model_level: "dimensional" })] }), attribute(uid(74), { entity_id: PRODUCT, name: "k", copied_from_attribute_id: uid(75) }), attribute(uid(75), { entity_id: uid(76), name: "pk" }));
    expect(groups(m).norel).toEqual([]);
  });
});

describe("relationships without a copied key (answer 1)", () => {
  it("names the many side's missing keys; a foreign key with the key's name counts too", () => {
    const plain = with_(base(), { attributes: base().attributes.map((a) => (a.id === lineOrderId ? { ...a, copied_from_attribute_id: null } : a)) });
    expect(groups(plain).nokey).toEqual([]);
    const notFk = with_(base(), { attributes: base().attributes.map((a) => (a.id === lineOrderId ? { ...a, copied_from_attribute_id: null, is_foreign_key: false } : a)) });
    const nokey = groups(notFk).nokey!;
    expect(nokey.map((l) => [l.name, l.detail])).toEqual([["Sales Order – Order Line (contains)", "Order Line has no copy of order_id"]]);
    expect(nokey[0]!.go).toEqual({ t: "relationship", id: uid(21) });
    expect(nokey[0]!.panels).toEqual([{ t: "relationship", id: uid(21) }, { t: "entity", id: LINE }]);
    expect(nokey[0]!.marks).toEqual([{ t: "entity", id: LINE }]);
    // name compared trimmed, case ignored
    const named = with_(base(), { attributes: base().attributes.map((a) => (a.id === lineOrderId ? { ...a, copied_from_attribute_id: null, name: " Order_ID" } : a)) });
    expect(groups(named).nokey).toEqual([]);
  });
  it("lists only the missing keys of a composite key; without a label no brackets", () => {
    const m = with_(add(base(), attribute(uid(81), { entity_id: ids.salesOrder, name: "line_no", sort_order: 2, is_primary_key: true })), {
      relationships: [relationship(), relationship({ id: uid(21), from_entity_id: ids.salesOrder, to_entity_id: LINE, label: null })],
    });
    expect(groups(m).nokey!.map((l) => [l.name, l.detail])).toEqual([["Sales Order – Order Line", "Order Line has no copy of line_no"]]);
  });
  it("skips 1:1, many-to-many and self relationships, and reads either direction", () => {
    expect(oneAndMany(relationship({ from_max: "1", to_max: "1" }))).toBeNull();
    expect(oneAndMany(relationship({ from_max: "n", to_max: "n" }))).toBeNull();
    expect(oneAndMany(relationship({ from_max: "n", to_max: "1" }))).toEqual({ one: ids.salesOrder, many: ids.customer });
    const bare = with_(base(), { attributes: base().attributes.filter((a) => a.id !== lineOrderId && a.id !== uid(15)) });
    const kinds = (r: Partial<Relationship>) => groups(with_(bare, { relationships: [relationship(r)] })).nokey!.length;
    expect([kinds({ from_max: "1", to_max: "1" }), kinds({ from_max: "n", to_max: "n" }), kinds({ to_entity_id: ids.customer }), kinds({})]).toEqual([0, 0, 0, 1]);
  });
  it("is logical only", () => {
    const dims: Entity[] = [entity(ids.customer, { model_level: "dimensional" }), entity(ids.salesOrder, { model_level: "dimensional" })];
    const m = with_(base(), { entities: dims, attributes: base().attributes.filter((a) => a.id !== uid(15)), relationships: [relationship()] });
    expect(groups(m).nokey).toEqual([]);
  });
});

describe("scope (the project home)", () => {
  it("reads attributes of entities in scope and relationships with either end in scope", () => {
    const m = with_(base(), { attributes: base().attributes.map((a) => (a.id === lineOrderId ? { ...a, copied_from_attribute_id: null, is_foreign_key: false } : a)) });
    expect(groups(m, new Set([LINE])).nokey!.length).toBe(1);
    expect(groups(m, new Set([ids.customer])).nokey!.length).toBe(0);
    expect(projectScope([canvasItem(), canvasItem(uid(91), { entity_id: LINE, canvas_id: ids.canvas2 }), canvasItem(uid(92), { entity_id: ids.salesOrder, deleted_at: T })], [ids.canvas1])).toEqual(new Set([ids.customer]));
  });
});

describe("not yet covered, as words (answer 8)", () => {
  it("gives the five reasons in their order, and null when covered", () => {
    const m = with_(base(), {
      attributes: [...base().attributes, attribute(uid(101), { name: "calc", is_primary_key: false, is_calculated: true }), attribute(uid(102), { name: "plain", is_primary_key: false })],
      attributeInputs: [{ id: uid(103), workspace_id: ids.ws, attribute_id: uid(101), input_attribute_id: uid(102), sort_order: 0, version: 1, created_at: T, created_by: ids.actor, updated_at: T, updated_by: ids.actor, deleted_at: null }],
      mappings: [mapping({ status: "approved", approved_at: T, approved_by: ids.someoneElse }), mapping({ id: uid(104), attribute_id: ids.customerId, status: "draft" })],
      mappingInputs: [mappingInput(), mappingInput(uid(105), { mapping_id: uid(104), source_column_id: ids.colCustId })],
    });
    const at = (over: Partial<Model> = {}) => lookupModel(with_(m, over));
    expect(coverageGapText(at(), ids.email)).toBeNull();
    expect(coverageGapText(at({ sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail, { missing_since: T })] }), ids.email)).toBe("email reads a column that left the source");
    expect(coverageGapText(at({ sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail, { data_type: "int" })] }), ids.email)).toBe("email's approved source mapping has a type conflict");
    expect(coverageGapText(at(), uid(101))).toBe("an input of calc's calculation is not covered");
    expect(coverageGapText(at(), ids.customerId)).toBe("customer_id has no approved source mapping");
    expect(coverageGapText(at(), uid(102))).toBe("plain is not mapped");
  });
});

describe("the order and the index", () => {
  const broken = (): Model =>
    add(
      with_(base(), { attributes: base().attributes.map((a) => (a.id === lineOrderId ? { ...a, copied_from_attribute_id: null, is_foreign_key: false } : a)) }),
      attribute(custOrderId, { name: "last_order_id", sort_order: 5, is_primary_key: false, is_foreign_key: true, copied_from_attribute_id: ids.orderId }),
      attribute(uid(111), { name: "EMAIL", sort_order: 6, is_primary_key: false }),
    );
  const mod: ModuleChecks = {
    topic: "Mod",
    allWell: "so does the module",
    groups: [
      { id: "m-high", title: "Module high", short: "mh", hint: "", high: true, module: "Mod", items: [{ go: { t: "ext", kind: "k", id: uid(120) }, text: () => ({ name: "a → b", detail: "x" }), panels: [{ t: "ext", kind: "k", id: uid(120) }, { t: "attribute", id: ids.email }], marks: [{ t: "attribute", id: ids.email }], entities: [ids.customer] }] },
      { id: "m-hint", title: "Module hints", short: "hint", hint: "", high: false, module: "Mod", items: [{ go: { t: "entity", id: ids.customer }, text: () => ({ name: "Customer", detail: "No grain yet." }), panels: [], marks: [{ t: "entity", id: ids.customer }], entities: [ids.customer], hintOf: ids.customer }] },
      { id: "m-empty", title: "Empty", short: "e", hint: "", high: false, items: [] },
    ],
  };
  it("puts High first, InfoMapper's before the modules' within a severity, and drops empty groups", () => {
    const c = modelChecks(input(broken()), [mod]);
    expect(c.groups.map((g) => g.id)).toEqual(["wrong", "m-high", "dup", "nokey", "m-hint"]);
    expect([c.count, c.high, c.topics, c.allWell]).toEqual([5, true, ["Mod"], ["so does the module"]]);
  });
  it("indexes panels, marks and a canvas's lines", () => {
    const c = modelChecks(input(broken()), [mod]);
    const entityOf = new Map(broken().attributes.map((a) => [a.id, a.entity_id]));
    const x = checkIndex(c, (id) => entityOf.get(id));
    // Customer's panel: its attributes' lines (wrong, the module's, dup) and not the hint; the hint counted
    expect(x.panel({ t: "entity", id: ids.customer }).map((l) => l.group.id)).toEqual(["wrong", "m-high", "dup"]);
    expect(x.hintsOf(ids.customer)).toBe(1);
    expect(x.panel({ t: "relationship", id: ids.relPlaces }).map((l) => l.group.id)).toEqual(["wrong"]);
    expect(x.panel({ t: "entity", id: LINE }).map((l) => l.group.id)).toEqual(["nokey"]);
    expect(x.panel({ t: "ext", kind: "k", id: uid(120) }).map((l) => l.group.id)).toEqual(["m-high"]);
    // the header: its own and its rows' marks, High when one is, with their groups; titles are built where a card is drawn
    expect(x.entityMark(ids.customer)).toEqual({ high: true, groups: ["wrong", "m-high", "dup", "m-hint"] });
    expect(markTitle(x.entityItems(ids.customer))).toMatch(/^Model checks: 4\n/);
    expect(x.rowMark(uid(111))).toEqual({ high: false, groups: ["dup"] });
    expect(markTitle(x.rowItems(uid(111)))).toBe("Model checks: 1\nDuplicate attribute names: Customer: email, EMAIL");
    // the counts (the status bar, the panel's group)
    expect([x.count, x.high, x.countOn([LINE]), x.countOn(new Set([ids.customer, LINE]))]).toEqual([5, true, { count: 1, high: false }, { count: 5, high: true }]);
    expect(x.entityMark(LINE)?.high).toBe(false);
    expect(x.rowMark(ids.customerId)).toBeUndefined();
    expect(x.onCanvas([LINE]).map((l) => l.group.id)).toEqual(["nokey"]);
    expect(x.onCanvas([ids.salesOrder]).map((l) => l.group.id)).toEqual(["wrong", "nokey"]);
    expect(x.onCanvas([ids.customer, LINE]).length).toBe(5);
  });
  it("builds no text for the marks and the counts (step 2's second round, point 2)", () => {
    const c = modelChecks(input(broken()), [mod]);
    let built = 0;
    for (const g of c.groups) for (const item of g.items) {
      const text = item.text;
      item.text = () => (built++, text());
    }
    const entityOf = new Map(broken().attributes.map((a) => [a.id, a.entity_id]));
    const x = checkIndex(c, (id) => entityOf.get(id));
    x.entityMark(ids.customer);
    x.rowMark(uid(111));
    x.countOn([ids.customer, LINE]);
    x.panel({ t: "entity", id: ids.customer });
    expect(built).toBe(0);
    markTitle(x.rowItems(uid(111)));
    expect(built).toBe(1);
  });
  it("titles a mark with at most six lines, a hint by its text", () => {
    const line = (n: number) => ({ group: { id: "g", title: "G", short: "g", high: false }, item: { go: { t: "entity" as const, id: uid(n) }, text: () => ({ name: `n${n}`, detail: `d${n}` }), panels: [], marks: [], entities: [] } });
    expect(markTitle([1, 2, 3, 4, 5, 6, 7].map(line))).toBe("Model checks: 7\nG: n1\nG: n2\nG: n3\nG: n4\nG: n5\nG: n6\n…");
    expect(markTitle([{ ...line(1), item: { ...line(1).item, hintOf: uid(1) } }])).toBe("Model checks: 1\nG: d1");
  });
});
