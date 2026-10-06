import { describe, expect, it } from "vitest";
import { access, archived, attribute, entity, ids, makeCtx, mapping, mappingInput, NOW, sourceColumn } from "../__fixtures__/domain";
import type { Attribute } from "../types";
import { addAttribute, createAttributeFromColumn, deleteAttribute, reorderAttribute, updateAttribute } from "./attribute";

const { customer, customerId, email, mapEmail, inEmail } = ids;
const ref = { attributeId: email, expectedVersion: 1 };

describe("addAttribute", () => {
  const state = { entity: entity(customer), attributes: [attribute(customerId), attribute(email), attribute(ids.orderId, { sort_order: 9 })] };

  it("adds a nullable string “new_attribute” after the entity's last attribute", () => {
    const r = addAttribute(makeCtx(), access("modeler"), state, { entityId: customer });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toMatchObject([
      {
        kind: "insert",
        table: "attribute",
        row: { id: r.value.attributeId, entity_id: customer, name: "new_attribute", sort_order: 2, data_type: "string", is_nullable: true, is_primary_key: false, is_pii: false },
      },
    ]);
  });

  it("refuses an unknown entity and reviewers", () => {
    expect(addAttribute(makeCtx(), access("owner"), { ...state, entity: entity(customer, { deleted_at: NOW }) }, { entityId: customer })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(addAttribute(makeCtx(), access("reviewer"), state, { entityId: customer })).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("updateAttribute", () => {
  const state = { attribute: attribute(email) };
  const update = (input: object) => updateAttribute(makeCtx(), access("modeler"), state, { ...ref, ...input });

  it("changes name, flags and definition", () => {
    const r = update({ name: "email_address", isBusinessKey: true, isPii: false, isNullable: false, definition: "Primary e-mail." });
    expect(r).toMatchObject({
      ok: true,
      value: { attribute: { name: "email_address", is_business_key: true, is_pii: false, is_nullable: false, definition_text: "Primary e-mail.", version: 2 } },
    });
  });

  it("stores the type with its own parameters only (AD-27)", () => {
    expect(update({ type: { dataType: "decimal", precision: 18, scale: 2, length: 100 } })).toMatchObject({
      ok: true,
      value: { attribute: { data_type: "decimal", type_precision: 18, type_scale: 2, type_length: null, custom_type: null } },
    });
    expect(update({ type: { dataType: "string", length: 255, precision: 3 } })).toMatchObject({ ok: true, value: { attribute: { type_length: 255, type_precision: null } } });
    expect(update({ type: { dataType: "date", length: 10 } })).toMatchObject({ ok: true, value: { attribute: { data_type: "date", type_length: null } } });
    expect(update({ type: { dataType: "custom", customType: "uuid" } })).toMatchObject({ ok: true, value: { attribute: { data_type: "custom", custom_type: "uuid" } } });
  });

  it("refuses impossible type parameters", () => {
    expect(update({ type: { dataType: "custom" } })).toMatchObject({ ok: false, error: { message: "Name the custom type, e.g. uuid." } });
    expect(update({ type: { dataType: "decimal", scale: 2 } })).toMatchObject({ ok: false, error: { message: "A scale needs a precision." } });
    expect(update({ type: { dataType: "decimal", precision: 4, scale: 6 } })).toMatchObject({ ok: false, error: { message: "The scale cannot be larger than the precision." } });
    expect(update({ type: { dataType: "string", length: 0 } })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(update({ type: { dataType: "text" } })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("refuses no change, a stale version, reviewers and an archived workspace", () => {
    expect(update({ type: { dataType: "string", length: 100 } })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(updateAttribute(makeCtx(), access("owner"), state, { attributeId: email, expectedVersion: 2, name: "x" })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(updateAttribute(makeCtx(), access("reviewer"), state, { ...ref, name: "x" })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(updateAttribute(makeCtx(), access("owner", archived), state, { ...ref, name: "x" })).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});

describe("deleteAttribute", () => {
  it("soft-deletes the attribute with its mappings and their inputs, in one change group", () => {
    const other = mapping({ id: "01900000-0000-7000-8000-00000000a009", attribute_id: customerId });
    const state = {
      attribute: attribute(email),
      mappings: [mapping(), other],
      mappingInputs: [mappingInput(), mappingInput("01900000-0000-7000-8000-00000000b009", { mapping_id: other.id })],
    };
    const r = deleteAttribute(makeCtx(), access("modeler"), state, ref);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ mappings: 1 });
    expect(r.writeSet.writes).toMatchObject([
      { table: "mapping_input", row: { id: inEmail, deleted_at: NOW } },
      { table: "mapping", row: { id: mapEmail, deleted_at: NOW } },
      { table: "attribute", row: { id: email, deleted_at: NOW } },
    ]);
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
  });

  it("is refused to reviewers", () => {
    expect(deleteAttribute(makeCtx(), access("reviewer"), { attribute: attribute(email), mappings: [], mappingInputs: [] }, ref)).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("createAttributeFromColumn (a column dropped on an entity's header, slice 1b)", () => {
  const price = sourceColumn(ids.colFirstName, {
    name: "price",
    data_type: "decimal",
    type_length: null,
    type_precision: 18,
    type_scale: 2,
    is_pii: false,
    is_nullable: false,
    comment: "Unit price, net",
  });
  const state = { entity: entity(customer), attributes: [attribute(customerId), attribute(email)], column: price, mappings: [mapping()], mappingInputs: [mappingInput()] };
  const input = { entityId: customer, sourceColumnId: ids.colFirstName };

  it("adds an attribute named after the column, with its type and parameters, and a direct mapping, in one change group", () => {
    const r = createAttributeFromColumn(makeCtx(), access("modeler"), state, input);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.createdAttribute).toBe(true);
    expect(r.writeSet.writes).toMatchObject([
      {
        kind: "insert",
        table: "attribute",
        row: {
          id: r.value.attributeId,
          entity_id: customer,
          name: "price",
          sort_order: 2,
          data_type: "decimal",
          type_precision: 18,
          type_scale: 2,
          type_length: null,
          custom_type: null,
          is_pii: false,
          is_nullable: false,
          is_primary_key: false,
          is_business_key: false,
          definition_text: "Unit price, net",
        },
      },
      { kind: "insert", table: "mapping", row: { id: r.value.mappingId, attribute_id: r.value.attributeId, kind: "direct", status: "draft" } },
      { kind: "insert", table: "mapping_input", row: { mapping_id: r.value.mappingId, source_column_id: ids.colFirstName, sort_order: 0 } },
    ]);
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    expect(r.writeSet.events).toHaveLength(3);
  });

  it("takes the column's PII flag and nullability, as the prototype does", () => {
    const r = createAttributeFromColumn(makeCtx(), access("owner"), { ...state, column: sourceColumn(ids.colFirstName) }, input);
    expect(r.ok && r.writeSet.writes[0]).toMatchObject({
      row: { name: "first_name", data_type: "string", type_length: 50, is_pii: true, is_nullable: true, definition_text: null },
    });
  });

  it("maps the column to an attribute of the same name (ignoring case) instead of adding another", () => {
    const s = { ...state, attributes: [attribute(customerId), attribute(email, { name: "Price" })], mappings: [], mappingInputs: [] };
    const r = createAttributeFromColumn(makeCtx(), access("modeler"), s, input);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toMatchObject({ attributeId: email, createdAttribute: false });
    expect(r.writeSet.writes.map((w) => w.table)).toEqual(["mapping", "mapping_input"]);
  });

  it("refuses the same mapping twice", () => {
    const s = { ...state, column: sourceColumn(ids.colEmail), attributes: [attribute(email)] };
    expect(createAttributeFromColumn(makeCtx(), access("modeler"), s, { entityId: customer, sourceColumnId: ids.colEmail })).toMatchObject({
      ok: false,
      error: { code: "conflict", message: "That mapping already exists." },
    });
  });

  it("refuses unknown entities or columns, reviewers and an archived workspace", () => {
    expect(createAttributeFromColumn(makeCtx(), access("owner"), { ...state, entity: null }, input)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(createAttributeFromColumn(makeCtx(), access("owner"), { ...state, column: null }, input)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(createAttributeFromColumn(makeCtx(), access("reviewer"), state, input)).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(createAttributeFromColumn(makeCtx(), access("owner", archived), state, input)).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});

describe("reorderAttribute (D-36)", () => {
  const a = (n: number, over: Partial<Attribute> = {}) =>
    attribute(`01900000-0000-7000-8000-0000000051${String(n).padStart(2, "0")}`, { name: `a${n}`, sort_order: n, entity_id: customer, ...over });
  const list = [a(0), a(1), a(2), a(3)];
  const move = (n: number, position: number, attributes = list) =>
    reorderAttribute(makeCtx(), access("modeler"), { attribute: attributes[n]!, attributes }, { attributeId: attributes[n]!.id, expectedVersion: 1, position });
  /** The names in their order after the move. */
  const orderAfter = (r: ReturnType<typeof move>, attributes = list) => {
    if (!r.ok) throw new Error(r.error.message);
    const next = new Map(attributes.map((x) => [x.id, x.sort_order]));
    for (const w of r.writeSet.writes) if (w.kind === "update" && w.table === "attribute") next.set(w.row.id, w.row.sort_order);
    return [...attributes].sort((x, y) => next.get(x.id)! - next.get(y.id)!).map((x) => x.name);
  };

  it("moves one place up or down (Ctrl ↑/↓), writing only the two rows that change, in one change group", () => {
    const up = move(2, 1);
    expect(orderAfter(up)).toEqual(["a0", "a2", "a1", "a3"]);
    expect(up.ok && up.writeSet.writes).toHaveLength(2);
    expect(up.ok && new Set(up.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    expect(orderAfter(move(1, 2))).toEqual(["a0", "a2", "a1", "a3"]);
  });

  it("moves to the top or the bottom (Ctrl Shift ↑/↓); a position past the end is the bottom", () => {
    expect(orderAfter(move(3, 0))).toEqual(["a3", "a0", "a1", "a2"]);
    expect(orderAfter(move(0, 99))).toEqual(["a1", "a2", "a3", "a0"]);
  });

  it("renumbers the entity's attributes 0..n-1 and ignores deleted ones and other entities", () => {
    const gappy = [a(0), a(1, { sort_order: 5 }), a(2, { sort_order: 9 }), a(3, { deleted_at: NOW, sort_order: 7 }), a(4, { entity_id: ids.salesOrder, sort_order: 1 })];
    const r = move(2, 0, gappy);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.position).toBe(0);
    const written = r.writeSet.writes.map((w) => (w.kind === "update" && w.table === "attribute" ? [w.row.name, w.row.sort_order, w.row.version] : null));
    expect(written).toEqual([["a2", 0, 2], ["a0", 1, 2], ["a1", 2, 2]]);
  });

  it("refuses a move to where the attribute already is, a stale version, reviewers and an archived workspace", () => {
    const at1 = { attribute: list[1]!, attributes: list };
    expect(move(1, 1)).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(reorderAttribute(makeCtx(), access("owner"), at1, { attributeId: list[1]!.id, expectedVersion: 4, position: 0 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(reorderAttribute(makeCtx(), access("reviewer"), at1, { attributeId: list[1]!.id, expectedVersion: 1, position: 0 })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(reorderAttribute(makeCtx(), access("owner", archived), at1, { attributeId: list[1]!.id, expectedVersion: 1, position: 0 })).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});
