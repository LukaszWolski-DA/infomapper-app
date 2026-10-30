import { describe, expect, it } from "vitest";
import { attribute, entity, ids, makeCtx, NOW } from "../__fixtures__/domain";
import { nextVersion, type Write } from "../changes";
import type { Attribute } from "../types";
import { attributePath, copiesBelow, copiesStopFollowing, followOriginals, liveCopiesOf, namedList, pathsOf } from "./copies";

const { customerId, salesOrder, customer } = ids;
const C1 = "01900000-0000-7000-8000-0000000c0001";
const C2 = "01900000-0000-7000-8000-0000000c0002";
const C3 = "01900000-0000-7000-8000-0000000c0003";

/** Customer.customer_id; its copy Sales Order.customer_id (C1); a copy of that copy (C2); a deleted copy (C3). */
const family = (): Attribute[] => [
  attribute(customerId),
  attribute(C1, { entity_id: salesOrder, name: "customer_id", is_primary_key: false, is_foreign_key: true, copied_from_attribute_id: customerId }),
  attribute(C2, { entity_id: salesOrder, name: "parent_customer_id", is_primary_key: false, copied_from_attribute_id: C1 }),
  attribute(C3, { entity_id: salesOrder, name: "old_customer_id", is_primary_key: false, copied_from_attribute_id: customerId, deleted_at: NOW }),
];
const byId = (rows: readonly Attribute[], id: string) => rows.find((a) => a.id === id)!;
const updateOf = (rows: readonly Attribute[], id: string, patch: Partial<Attribute>): Write => {
  const before = byId(rows, id);
  return { kind: "update", table: "attribute", before, row: nextVersion(makeCtx(), before, patch) };
};
const rowsOf = (writes: readonly Write[]) => writes.map((w) => (w as Extract<Write, { table: "attribute" }>).row);

describe("followOriginals (slice 10c, F1)", () => {
  it("writes every live copy below a written original, copies of copies included, and names them followers", () => {
    const rows = family();
    const { writes, followers } = followOriginals(makeCtx(), rows, [updateOf(rows, customerId, { data_type: "decimal", type_precision: 18, type_scale: 2 })]);
    expect(rowsOf(writes).map((r) => [r.id, r.data_type, r.type_precision, r.type_scale, r.version])).toEqual([
      [customerId, "decimal", 18, 2, 2],
      [C1, "decimal", 18, 2, 2],
      [C2, "decimal", 18, 2, 2],
    ]);
    expect(followers).toEqual([C1, C2]);
    // the deleted copy is not written; the copies keep their own name and keys
    expect(rowsOf(writes).find((r) => r.id === C3)).toBeUndefined();
    expect(byId(rowsOf(writes), C1)).toMatchObject({ name: "customer_id", is_foreign_key: true, copied_from_attribute_id: customerId });
  });

  it("follows Personal data too, and writes nothing for a change of another field", () => {
    const rows = family();
    expect(rowsOf(followOriginals(makeCtx(), rows, [updateOf(rows, customerId, { is_pii: true })]).writes).map((r) => [r.id, r.is_pii])).toEqual([
      [customerId, true],
      [C1, true],
      [C2, true],
    ]);
    expect(followOriginals(makeCtx(), rows, [updateOf(rows, customerId, { name: "cust_id" })])).toMatchObject({ writes: [{ row: { id: customerId } }], followers: [] });
  });

  it("sets a copy's fields in the write that already writes it, without writing it twice", () => {
    const rows = family();
    const both = [updateOf(rows, customerId, { data_type: "string", type_length: 20 }), updateOf(rows, C1, { name: "client_id" })];
    const { writes, followers } = followOriginals(makeCtx(), rows, both);
    expect(rowsOf(writes).map((r) => [r.id, r.name, r.data_type, r.type_length])).toEqual([
      [customerId, "customer_id", "string", 20],
      [C1, "client_id", "string", 20],
      [C2, "parent_customer_id", "string", 20],
    ]);
    expect(followers).toEqual([C2]);
  });

  it("brings a written copy in step with its live original, and leaves a copy of a deleted original as it is", () => {
    const rows = family();
    // a copy written back with an older type (an undo) takes its original's
    const restored = followOriginals(makeCtx(), rows, [updateOf(rows, C1, { data_type: "string", type_length: 5 })]);
    expect(rowsOf(restored.writes).map((r) => [r.id, r.data_type, r.type_length])).toEqual([[C1, "integer", null]]);
    // the original deleted: its copy follows nothing
    const gone = followOriginals(makeCtx(), rows, [updateOf(rows, customerId, { deleted_at: NOW })]);
    expect(rowsOf(gone.writes).map((r) => r.id)).toEqual([customerId]);
  });

  it("stops at a loop instead of walking it for ever", () => {
    // the links cannot loop by construction (F17); a hand-made loop still ends
    const rows = [attribute(C1, { copied_from_attribute_id: C2 }), attribute(C2, { copied_from_attribute_id: C1, data_type: "date" })];
    const { writes } = followOriginals(makeCtx(), rows, [updateOf(rows, C1, { name: "x" })]);
    expect(writes.length).toBeLessThanOrEqual(2);
  });
});

describe("copies and their names (slice 10c, F4, F7)", () => {
  it("lists an attribute's live copies, and every live copy below it for the save chain", () => {
    expect(liveCopiesOf(family(), customerId).map((a) => a.id)).toEqual([C1]);
    expect(copiesBelow(family(), customerId).map((a) => a.id)).toEqual([C1, C2]);
    expect(copiesBelow(family(), C2)).toEqual([]);
  });

  it("names attributes as {entity}.{attribute}, a deleted original from lostOriginals", () => {
    const entities = [entity(customer), entity(salesOrder)];
    expect(attributePath(C1, family(), entities)).toBe("Sales Order.customer_id");
    expect(attributePath("01900000-0000-7000-8000-00000000dead", [], entities, [{ id: "01900000-0000-7000-8000-00000000dead", name: "gone_id", entityName: "Gone" }])).toBe("Gone.gone_id");
    expect(attributePath("01900000-0000-7000-8000-00000000dead", [], entities)).toBeNull();
    expect(pathsOf([byId(family(), C2), byId(family(), customerId), byId(family(), C1)], entities).map((p) => p.label)).toEqual([
      "Customer.customer_id",
      "Sales Order.customer_id",
      "Sales Order.parent_customer_id",
    ]);
  });

  it("words the copies of a delete's second click, five named and the rest counted", () => {
    expect(copiesStopFollowing(["Order.customer_id"])).toBe("this copy stops following it: Order.customer_id");
    expect(copiesStopFollowing(["Order.customer_id", "Invoice.customer_id"])).toBe("these copies stop following it: Order.customer_id, Invoice.customer_id");
    expect(namedList(["A.x", "B.x", "C.x", "D.x", "E.x", "F.x", "G.x", "H.x"])).toBe("A.x, B.x, C.x, D.x, E.x and 3 more");
    expect(namedList(["A.x", "B.x", "C.x", "D.x", "E.x"])).toBe("A.x, B.x, C.x, D.x, E.x");
  });
});
