// InfoCube's commands of slice 15b: a fact's grain and a dimension's SCD type, measures (B-4), key links and Add key
// (role-playing R-1, R-3, RP-04, RP-05). Undo of Add key and the cascades are in `tests/infocube-keys.test.ts`.

import { describe, expect, it } from "vitest";
import { access, archived, ids, makeCtx } from "@/domain/__fixtures__/domain";
import type { CommandResult, Write } from "@/domain/changes";
import { rel, S, star } from "./__fixtures__/star";
import {
  addedKey,
  addKey,
  alreadyCarries,
  alreadyHasKey,
  GRAIN_ON_DIMENSION,
  linkKey,
  MEASURE_NOT_ON_FACT,
  measureOnForeignKey,
  noPrimaryKey,
  NOT_FACT_DIMENSION,
  notFactsForeignKey,
  SCD_ON_FACT,
  SEMI_NOTE_ONLY_SEMI,
  setMeasure,
  updateCubeEntity,
  updateMeasure,
} from "./commands";
import { cubeIndex } from "./keys";

const on = { infocube: true };
const modeler = () => access("modeler", on);
const cubeRow = (id: string) => star().cubeEntities.find((c) => c.id === id)!;
const attribute = (id: string) => star().attributes.find((a) => a.id === id)!;
const measure = (id: string) => star().cubeMeasures.find((m) => m.id === id)!;
const ok = <T,>(r: CommandResult<T>) => {
  if (!r.ok) throw new Error(r.error.message);
  return r;
};
const rowOf = (w: Write | undefined) => (w as { row?: Record<string, unknown> } | undefined)?.row;
const rows = (writes: Write[]) => writes.map((w) => [w.kind, w.table, rowOf(w)?.deleted_at === null ? "live" : "deleted"]);

describe("updateCubeEntity (B-4): a fact's grain, a dimension's SCD type", () => {
  it("sets a fact's grain, trimmed, and clears it when empty (IC-04)", () => {
    const set = ok(updateCubeEntity(makeCtx(), modeler(), { cube: cubeRow(S.cubeSales) }, { cubeEntityId: S.cubeSales, expectedVersion: 1, grain: "  One row per order line and day " }));
    expect(set.writeSet.writes).toMatchObject([{ kind: "update", table: "cube_entity", row: { grain: "One row per order line and day", version: 2 } }]);
    expect(set.value).toEqual({ version: 2 });
    expect(ok(updateCubeEntity(makeCtx(), modeler(), { cube: cubeRow(S.cubeSales) }, { cubeEntityId: S.cubeSales, expectedVersion: 1, grain: " " })).writeSet.writes[0]).toMatchObject({ row: { grain: null } });
  });

  it("sets a dimension's SCD type", () => {
    const r = ok(updateCubeEntity(makeCtx(), modeler(), { cube: cubeRow(S.cubeDate) }, { cubeEntityId: S.cubeDate, expectedVersion: 1, scdType: 2 }));
    expect(r.writeSet.writes[0]).toMatchObject({ row: { scd_type: 2, grain: null } });
  });

  it("refuses a grain on a dimension, a type on a fact, an unknown type, nothing to change, a stale version, a reviewer, the archive", () => {
    const run = (cube: string, input: object, a = modeler()) => updateCubeEntity(makeCtx(), a, { cube: cubeRow(cube) }, { cubeEntityId: cube, expectedVersion: 1, ...input });
    expect(run(S.cubeDate, { grain: "x" })).toMatchObject({ ok: false, error: { code: "invalid", message: GRAIN_ON_DIMENSION } });
    expect(run(S.cubeSales, { scdType: 1 })).toMatchObject({ ok: false, error: { code: "invalid", message: SCD_ON_FACT } });
    expect(run(S.cubeDate, { scdType: 3 })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(run(S.cubeDate, { scdType: 1 })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(run(S.cubeSales, { grain: "One row per order line" })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(run(S.cubeSales, { grain: "x", expectedVersion: 2 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(run(S.cubeSales, { grain: "x" }, access("reviewer", on))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(run(S.cubeSales, { grain: "x" }, access("owner", { ...on, ...archived }))).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});

describe("setMeasure and updateMeasure (B-4, IC-05, IC-06)", () => {
  const state = (attributeId: string, measureId: string | null = null, cube = S.cubeSales) => ({ attribute: attribute(attributeId), cube: cubeRow(cube), measure: measureId ? measure(measureId) : null });

  it("makes a fact's attribute a measure: Additive for Integer and Decimal, Non-additive otherwise", () => {
    const integer = ok(setMeasure(makeCtx(), modeler(), { ...state(S.custKey), attribute: { ...attribute(S.custKey), is_foreign_key: false } }, { on: true, attributeId: S.custKey }));
    expect(integer.writeSet.writes).toMatchObject([{ kind: "insert", table: "cube_measure", row: { attribute_id: S.custKey, additivity: "additive", semi_note: null } }]);
    expect(integer.value.warning).toBeNull();
    const text = ok(setMeasure(makeCtx(), modeler(), state(S.orderNumber), { on: true, attributeId: S.orderNumber }));
    expect(text.writeSet.writes[0]).toMatchObject({ row: { additivity: "non" } });
  });

  it("warns when a foreign key becomes a measure, and makes it all the same", () => {
    const r = ok(setMeasure(makeCtx(), modeler(), state(S.custKey), { on: true, attributeId: S.custKey }));
    expect(r.value.warning).toBe(measureOnForeignKey("customer_key"));
    expect(r.writeSet.writes).toHaveLength(1);
  });

  it("refuses a measure on a dimension's attribute or an attribute already a measure", () => {
    expect(setMeasure(makeCtx(), modeler(), state(S.datePk, null, S.cubeDate), { on: true, attributeId: S.datePk })).toMatchObject({ ok: false, error: { message: MEASURE_NOT_ON_FACT } });
    expect(setMeasure(makeCtx(), modeler(), { ...state(S.datePk), cube: null }, { on: true, attributeId: S.datePk })).toMatchObject({ ok: false, error: { message: MEASURE_NOT_ON_FACT } });
    expect(setMeasure(makeCtx(), modeler(), state(S.quantity, S.mQuantity), { on: true, attributeId: S.quantity })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });

  it("turns a measure off at the version the panel read", () => {
    const off = ok(setMeasure(makeCtx(), modeler(), state(S.quantity, S.mQuantity), { on: false, attributeId: S.quantity, measureId: S.mQuantity, expectedVersion: 1 }));
    expect(rows(off.writeSet.writes)).toEqual([["update", "cube_measure", "deleted"]]);
    expect(setMeasure(makeCtx(), modeler(), state(S.quantity, S.mQuantity), { on: false, attributeId: S.quantity, measureId: S.mQuantity, expectedVersion: 2 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(setMeasure(makeCtx(), access("reviewer", on), state(S.quantity, S.mQuantity), { on: false, attributeId: S.quantity, measureId: S.mQuantity, expectedVersion: 1 })).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });

  it("sets semi-additive with its note; leaving semi-additive clears the note; a note needs semi-additive", () => {
    const semi = ok(updateMeasure(makeCtx(), modeler(), { measure: measure(S.mQuantity) }, { measureId: S.mQuantity, expectedVersion: 1, additivity: "semi", semiNote: " Date " }));
    expect(semi.writeSet.writes[0]).toMatchObject({ row: { additivity: "semi", semi_note: "Date" } });
    const isSemi = { ...measure(S.mQuantity), additivity: "semi" as const, semi_note: "Date" };
    expect(ok(updateMeasure(makeCtx(), modeler(), { measure: isSemi }, { measureId: S.mQuantity, expectedVersion: 1, additivity: "non" })).writeSet.writes[0]).toMatchObject({ row: { additivity: "non", semi_note: null } });
    expect(ok(updateMeasure(makeCtx(), modeler(), { measure: isSemi }, { measureId: S.mQuantity, expectedVersion: 1, semiNote: "" })).writeSet.writes[0]).toMatchObject({ row: { additivity: "semi", semi_note: null } });
    expect(updateMeasure(makeCtx(), modeler(), { measure: measure(S.mQuantity) }, { measureId: S.mQuantity, expectedVersion: 1, semiNote: "Date" })).toMatchObject({ ok: false, error: { message: SEMI_NOTE_ONLY_SEMI } });
    expect(updateMeasure(makeCtx(), modeler(), { measure: measure(S.mQuantity) }, { measureId: S.mQuantity, expectedVersion: 1, additivity: "additive" })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });
});

describe("linkKey (R-1, RP-05)", () => {
  const link = (input: object, m = star(), a = modeler()) => linkKey(makeCtx(), a, m, { relationshipId: S.shipDate, currentKeyId: S.kShipDate, ...input });

  it("replaces the relationship's link with another free foreign key of the fact, in one change group", () => {
    const m = star();
    m.cubeKeys = m.cubeKeys.filter((k) => k.id !== S.kCustomer);
    const r = ok(link({ attributeId: S.custKey }, m));
    expect(rows(r.writeSet.writes)).toEqual([["update", "cube_key", "deleted"], ["insert", "cube_key", "live"]]);
    expect(r.writeSet.writes[1]).toMatchObject({ row: { relationship_id: S.shipDate, attribute_id: S.custKey } });
    expect(r.writeSet.writes.some((w) => w.table === "attribute")).toBe(false);
  });

  it("links a relationship without a link, and unlinks with None", () => {
    const m = star();
    m.cubeKeys = m.cubeKeys.filter((k) => k.id !== S.kShipDate);
    expect(rows(ok(link({ currentKeyId: null, attributeId: S.shipKey }, m)).writeSet.writes)).toEqual([["insert", "cube_key", "live"]]);
    expect(rows(ok(link({ attributeId: null })).writeSet.writes)).toEqual([["update", "cube_key", "deleted"]]);
    expect(link({ currentKeyId: null, attributeId: null }, m)).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });

  it("replaces an inactive link (R3: it still holds the relationship's one live link)", () => {
    const m = star();
    m.attributes = m.attributes.map((a) => (a.id === S.shipKey ? { ...a, is_foreign_key: false } : a));
    m.cubeKeys = m.cubeKeys.filter((k) => k.id !== S.kCustomer);
    expect(rows(ok(link({ attributeId: S.custKey }, m)).writeSet.writes)).toEqual([["update", "cube_key", "deleted"], ["insert", "cube_key", "live"]]);
  });

  it("refuses a key that carries another relationship, is no foreign key, is not the fact's, or is already linked", () => {
    expect(link({ attributeId: S.dateKey })).toMatchObject({ ok: false, error: { message: alreadyCarries("date_key", "Dim Date as Order date") } });
    expect(link({ attributeId: S.quantity })).toMatchObject({ ok: false, error: { message: notFactsForeignKey("quantity", "Fact Sales") } });
    expect(link({ attributeId: S.ordersDateKey })).toMatchObject({ ok: false, error: { message: notFactsForeignKey("date_key", "Fact Sales") } });
    expect(link({ attributeId: S.shipKey })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });

  it("refuses a relationship that does not join a fact and a dimension, a stale link, a reviewer", () => {
    const m = star();
    m.relationships.push(rel("01900000-0000-7000-8000-0000000c0398", S.date, S.cust, null));
    expect(linkKey(makeCtx(), modeler(), m, { relationshipId: "01900000-0000-7000-8000-0000000c0398", currentKeyId: null, attributeId: S.custKey })).toMatchObject({ ok: false, error: { message: NOT_FACT_DIMENSION } });
    expect(link({ currentKeyId: null, attributeId: null })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(link({ attributeId: null }, star(), access("reviewer", on))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(linkKey(makeCtx(), modeler(), star(), { relationshipId: ids.relPlaces, currentKeyId: null, attributeId: null })).toMatchObject({ ok: false, error: { code: "not_found" } });
  });
});

describe("addKey (R-3, RP-04)", () => {
  /** The star with a third Dim Date relationship of Fact Sales, its role "Payment date", no key. */
  const third = "01900000-0000-7000-8000-0000000c0399";
  const withPayment = (role: string | null = "Payment date") => {
    const m = star();
    m.relationships.push(rel(third, S.date, S.sales, role));
    return m;
  };
  const add = (m = withPayment(), input: object = {}) => addKey(makeCtx(), modeler(), m, { relationshipId: third, currentKeyId: null, ...input });

  it("adds payment_date_key of the primary key's type after the last key, renumbers, and links it, one change group", () => {
    const m = withPayment();
    const r = ok(add(m));
    expect(r.value).toMatchObject({ name: "payment_date_key", toast: addedKey("payment_date_key", "Dim Date as Payment date") });
    const [inserted, ...rest] = r.writeSet.writes;
    expect(inserted).toMatchObject({
      kind: "insert",
      table: "attribute",
      row: { id: r.value.attributeId, entity_id: S.sales, name: "payment_date_key", data_type: "integer", is_foreign_key: true, is_primary_key: false, is_nullable: false, sort_order: 3 },
    });
    // quantity (3) and order_number (4) move down one; the keys before keep their places
    expect(rest.filter((w) => w.table === "attribute").map((w) => [rowOf(w)!.name, rowOf(w)!.sort_order])).toEqual([["quantity", 4], ["order_number", 5]]);
    expect(rest.at(-1)).toMatchObject({ kind: "insert", table: "cube_key", row: { id: r.value.keyId, relationship_id: third, attribute_id: r.value.attributeId } });
    expect(r.writeSet.mainTargets).toEqual([{ kind: "attribute", id: r.value.attributeId }]);
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    // the new key carries the relationship
    const after = { ...m, attributes: [...m.attributes, rowOf(inserted) as never], cubeKeys: [...m.cubeKeys, rowOf(rest.at(-1)) as never] };
    expect(cubeIndex(after).keyOf(third)?.name).toBe("payment_date_key");
  });

  it("copies the primary key's type and its parameters", () => {
    const m = withPayment();
    m.attributes = m.attributes.map((a) => (a.id === S.datePk ? { ...a, data_type: "decimal", type_precision: 8, type_scale: 0 } : a));
    expect(ok(add(m)).writeSet.writes[0]).toMatchObject({ row: { data_type: "decimal", type_precision: 8, type_scale: 0 } });
  });

  it("names it after the primary key without a role, numbered when taken", () => {
    expect(ok(add(withPayment(null))).value.name).toBe("date_key_2");
    expect(ok(add(withPayment("Ship date"))).value.name).toBe("ship_date_key_2");
  });

  it("goes first when the fact has no key attribute", () => {
    const m = withPayment();
    m.attributes = m.attributes.map((a) => (a.entity_id === S.sales ? { ...a, is_foreign_key: false } : a));
    const r = ok(add(m));
    expect(r.writeSet.writes[0]).toMatchObject({ row: { sort_order: 0 } });
    expect(r.writeSet.writes.filter((w) => w.kind === "update" && w.table === "attribute")).toHaveLength(5);
  });

  it("deletes an inactive link of the relationship in the same group (R3)", () => {
    const m = star();
    m.attributes = m.attributes.map((a) => (a.id === S.shipKey ? { ...a, is_foreign_key: false } : a));
    const r = ok(addKey(makeCtx(), modeler(), m, { relationshipId: S.shipDate, currentKeyId: S.kShipDate }));
    expect(r.value.name).toBe("ship_date_key_2");
    expect(rows(r.writeSet.writes.filter((w) => w.table === "cube_key"))).toEqual([["update", "cube_key", "deleted"], ["insert", "cube_key", "live"]]);
  });

  it("is refused while the relationship has an active key, or the dimension has no primary key, or the link is stale", () => {
    expect(addKey(makeCtx(), modeler(), star(), { relationshipId: S.shipDate, currentKeyId: S.kShipDate })).toMatchObject({ ok: false, error: { message: alreadyHasKey("Fact Sales", "Dim Date as Ship date", "ship_date_key") } });
    const m = withPayment();
    m.attributes = m.attributes.map((a) => (a.id === S.datePk ? { ...a, is_primary_key: false } : a));
    expect(add(m)).toMatchObject({ ok: false, error: { message: noPrimaryKey("Dim Date") } });
    expect(add(withPayment(), { currentKeyId: S.kShipDate })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(addKey(makeCtx(), access("reviewer", on), withPayment(), { relationshipId: third, currentKeyId: null })).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});
