import { describe, expect, it } from "vitest";
import { access, archived, attribute, builtins, entity, fixtureLinks, ids, makeCtx, mapping, mappingInput, NOW, sourceColumn } from "../__fixtures__/domain";
import { writtenVersions } from "../changes";
import type { Attribute } from "../types";
import { COPIED_GONE, FOLLOWS_LOST_REFUSAL, FOLLOWS_REFUSAL } from "../model/copies";
import { contextTargets } from "../model/live";
import { addAttribute, createAttributeFromColumn, deleteAttribute, pasteAttribute, reorderAttribute, updateAttribute } from "./attribute";

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

  it("changes name, flags and the rich-text definition, sanitized on the server (slice 4a)", () => {
    const r = update({ name: "email_address", isBusinessKey: true, isPii: false, isNullable: false, definition: '<p>Primary <span class="tc-warn" style="x">e-mail</span>.</p><iframe>x</iframe>' });
    expect(r).toMatchObject({
      ok: true,
      value: {
        attribute: {
          name: "email_address",
          is_business_key: true,
          is_pii: false,
          is_nullable: false,
          definition_html: '<p>Primary <span class="tc-warn">e-mail</span>.</p>',
          definition_text: "Primary e-mail.",
          version: 2,
        },
      },
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

  it("takes only the type's changed parts: absent keeps the stored one, null clears it (slice 9, F1)", () => {
    const decimal = { attribute: attribute(email, { data_type: "decimal", type_length: null, type_precision: 12, type_scale: null }) };
    const patch = (type: object) => updateAttribute(makeCtx(), access("modeler"), decimal, { ...ref, type });
    // a queued Scale save sends only the scale: the stored precision 12 stays
    expect(patch({ scale: 2 })).toMatchObject({ ok: true, value: { attribute: { data_type: "decimal", type_precision: 12, type_scale: 2 } } });
    expect(patch({ precision: 18 })).toMatchObject({ ok: true, value: { attribute: { type_precision: 18, type_scale: null } } });
    expect(patch({ precision: null })).toMatchObject({ ok: true, value: { attribute: { type_precision: null } } });
    expect(patch({ scale: 14 })).toMatchObject({ ok: false, error: { message: "The scale cannot be larger than the precision." } });
    expect(patch({})).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });

  it("changing only the data type clears the parameters the new type lacks and keeps those it has, as before slice 9", () => {
    const stored = (over: Partial<Attribute>) => ({ attribute: attribute(email, { data_type: "string", type_length: 50, type_precision: null, type_scale: null, custom_type: null, ...over }) });
    const to = (over: Partial<Attribute>, dataType: string) => updateAttribute(makeCtx(), access("modeler"), stored(over), { ...ref, type: { dataType } });
    // string(50) → decimal: no length, no precision yet
    expect(to({}, "decimal")).toMatchObject({ ok: true, value: { attribute: { data_type: "decimal", type_length: null, type_precision: null, type_scale: null } } });
    // decimal(12,2) → string: no length, precision and scale cleared
    expect(to({ data_type: "decimal", type_length: null, type_precision: 12, type_scale: 2 }, "string")).toMatchObject({
      ok: true,
      value: { attribute: { data_type: "string", type_length: null, type_precision: null, type_scale: null } },
    });
    // decimal(12,2) → date: every parameter cleared
    expect(to({ data_type: "decimal", type_length: null, type_precision: 12, type_scale: 2 }, "date")).toMatchObject({ ok: true, value: { attribute: { data_type: "date", type_precision: null, type_scale: null } } });
    // to custom without a stored name: refused, as before
    expect(to({}, "custom")).toMatchObject({ ok: false, error: { message: "Name the custom type, e.g. uuid." } });
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

  it("takes the column's Personal data and nullability, as the prototype does (slice 7c: the PII classification)", () => {
    const withLinks = { ...state, column: sourceColumn(ids.colFirstName), classifications: builtins(), classificationLinks: fixtureLinks() };
    const r = createAttributeFromColumn(makeCtx(), access("owner"), withLinks, input);
    expect(r.ok && r.writeSet.writes[0]).toMatchObject({
      row: { name: "first_name", data_type: "string", type_length: 50, is_pii: true, is_nullable: true, definition_text: null },
    });
    // Personal data removed from the list: nothing is copied (S7C-06)
    const removed = builtins().map((c) => (c.code === "PII" ? { ...c, deleted_at: NOW } : c));
    const r2 = createAttributeFromColumn(makeCtx(), access("owner"), { ...withLinks, classifications: removed }, input);
    expect(r2.ok && r2.writeSet.writes[0]).toMatchObject({ row: { is_pii: false } });
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

  it("writes new versions of the moved attribute and of every sibling it renumbers, which the answer carries (slice 10a, F3)", () => {
    const r = move(3, 0);
    if (!r.ok) throw new Error(r.error.message);
    expect(writtenVersions(r.writeSet.writes)).toEqual({ [list[3]!.id]: 2, [list[0]!.id]: 2, [list[1]!.id]: 2, [list[2]!.id]: 2 });
  });

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

// ---- slice 10c: copies (D-63) ----

describe("pasteAttribute (slice 10c, items 4, 5)", () => {
  const { salesOrder, orderId } = ids;
  const attributes = [attribute(customerId, { definition_html: "<p>The customer.</p>", definition_text: "The customer." }), attribute(email), attribute(orderId)];
  const paste = (entityId: string, attributeId: string, over: { role?: Parameters<typeof access>[0]; ws?: object; rows?: Attribute[] } = {}) => {
    const rows = over.rows ?? attributes;
    return pasteAttribute(makeCtx(), access(over.role ?? "modeler", over.ws ?? {}), { entity: entity(entityId), original: rows.find((a) => a.id === attributeId) ?? null, attributes: rows }, { entityId, attributeId });
  };
  const inserted = (r: ReturnType<typeof paste>): Attribute => {
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toHaveLength(1);
    const w = r.writeSet.writes[0]!;
    if (w.kind !== "insert" || w.table !== "attribute") throw new Error("not an attribute insert");
    return w.row;
  };

  it("copies a primary key into another entity, last, as a foreign key with the original's type, definition and nullable", () => {
    const r = paste(salesOrder, customerId);
    const row = inserted(r);
    expect(row).toMatchObject({
      entity_id: salesOrder,
      name: "customer_id",
      sort_order: 1,
      data_type: "integer",
      type_length: null,
      is_primary_key: false,
      is_foreign_key: true,
      is_business_key: false,
      is_pii: false,
      is_nullable: false,
      definition_html: "<p>The customer.</p>",
      definition_text: "The customer.",
      copied_from_attribute_id: customerId,
    });
    expect(r).toMatchObject({ ok: true, value: { attributeId: row.id, nameTaken: false } });
  });

  it("copies an attribute that is not a primary key with no foreign key, and its Personal data and length", () => {
    expect(inserted(paste(salesOrder, email))).toMatchObject({ name: "email", is_foreign_key: false, is_pii: true, data_type: "string", type_length: 100, is_nullable: true });
  });

  it("pastes into the same entity and says the name is taken (F12)", () => {
    const r = paste(customer, customerId);
    expect(inserted(r)).toMatchObject({ entity_id: customer, name: "customer_id", sort_order: 2 });
    expect(r).toMatchObject({ value: { nameTaken: true } });
    // the name is compared ignoring case
    const upper = [...attributes, attribute("01900000-0000-7000-8000-0000000c0009", { entity_id: salesOrder, name: "CUSTOMER_ID" })];
    expect(paste(salesOrder, customerId, { rows: upper })).toMatchObject({ value: { nameTaken: true } });
  });

  it("links a copy of a copy to the copy that was copied", () => {
    const copy = attribute("01900000-0000-7000-8000-0000000c0001", { entity_id: salesOrder, is_primary_key: false, is_foreign_key: true, copied_from_attribute_id: customerId });
    expect(inserted(paste(customer, copy.id, { rows: [...attributes, copy] }))).toMatchObject({ copied_from_attribute_id: copy.id, is_foreign_key: false });
  });

  it("refuses a deleted original, an unknown entity, a reviewer and an archived workspace", () => {
    expect(paste(salesOrder, customerId, { rows: [attribute(customerId, { deleted_at: NOW })] })).toMatchObject({ ok: false, error: { code: "not_found", message: COPIED_GONE } });
    expect(
      pasteAttribute(makeCtx(), access("modeler"), { entity: entity(salesOrder, { deleted_at: NOW }), original: attributes[0]!, attributes }, { entityId: salesOrder, attributeId: customerId }),
    ).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(paste(salesOrder, customerId, { role: "reviewer" })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(paste(salesOrder, customerId, { role: "owner", ws: archived })).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});

describe("following and Stop following (slice 10c, items 6, 9, 10; F1 to F5)", () => {
  const { salesOrder } = ids;
  const C1 = "01900000-0000-7000-8000-0000000c0001";
  const C2 = "01900000-0000-7000-8000-0000000c0002";
  const entities = [entity(customer), entity(salesOrder)];
  const family = () => [
    attribute(customerId),
    attribute(email),
    attribute(C1, { entity_id: salesOrder, name: "customer_id", is_primary_key: false, is_foreign_key: true, copied_from_attribute_id: customerId }),
    attribute(C2, { entity_id: salesOrder, name: "parent_id", is_primary_key: false, copied_from_attribute_id: C1 }),
  ];
  const update = (rows: Attribute[], id: string, input: object, extra: object = {}) =>
    updateAttribute(makeCtx(), access("modeler"), { attribute: rows.find((a) => a.id === id) ?? null, attributes: rows, entities, ...extra }, { attributeId: id, expectedVersion: 1, ...input });
  const rowsOf = (r: ReturnType<typeof update>) => (r.ok ? r.writeSet.writes.map((w) => (w as { row: Attribute }).row) : []);

  it("writes a type change to every copy and a copy of a copy, in one change group, and answers with every version", () => {
    const r = update(family(), customerId, { type: { dataType: "string", length: 36 } });
    if (!r.ok) throw new Error(r.error.message);
    expect(rowsOf(r).map((row) => [row.id, row.data_type, row.type_length])).toEqual([
      [customerId, "string", 36],
      [C1, "string", 36],
      [C2, "string", 36],
    ]);
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    expect(writtenVersions(r.writeSet.writes)).toEqual({ [customerId]: 2, [C1]: 2, [C2]: 2 });
    expect(r.writeSet.followers).toEqual([C1, C2]);
  });

  it("writes Personal data to the copies too, and a name only to the original", () => {
    expect(rowsOf(update(family(), customerId, { isPii: true })).map((row) => row.is_pii)).toEqual([true, true, true]);
    const name = update(family(), customerId, { name: "cust_id" });
    expect(rowsOf(name)).toHaveLength(1);
    expect(name.ok && name.writeSet.followers).toBeUndefined();
  });

  it("labels the original in the working context, not the copies that follow it (F3)", () => {
    const r = update(family(), customerId, { type: { dataType: "date" } });
    if (!r.ok) throw new Error(r.error.message);
    expect(contextTargets(r.writeSet.writes, r.writeSet.mainTargets, r.writeSet.followers)).toEqual([{ kind: "attribute", id: customerId }]);
    // without the list every written copy would be labeled
    expect(contextTargets(r.writeSet.writes, r.writeSet.mainTargets)).toHaveLength(3);
  });

  it("refuses a followed field on a copy, naming its original, and lets its own fields change alone (F5)", () => {
    const refusal = { ok: false, error: { code: "invalid", message: FOLLOWS_REFUSAL("Customer.customer_id") } };
    expect(update(family(), C1, { type: { length: 10, dataType: "string" } })).toMatchObject(refusal);
    expect(update(family(), C1, { type: { dataType: "date" } })).toMatchObject(refusal);
    expect(update(family(), C1, { isPii: true })).toMatchObject(refusal);
    expect(update(family(), C2, { isPii: true })).toMatchObject({ error: { message: FOLLOWS_REFUSAL("Sales Order.customer_id") } });
    const own = update(family(), C1, { name: "client_id", isNullable: true, isForeignKey: false, isPrimaryKey: true, definition: "<p>Its own.</p>" });
    if (!own.ok) throw new Error(own.error.message);
    expect(rowsOf(own).map((row) => row.id)).toEqual([C1]);
    // a type patch that changes nothing is no change of a followed field
    expect(update(family(), C1, { type: { dataType: "integer" } })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });

  it("keeps a copy of a deleted original read-only, naming the deleted original (F2, F6)", () => {
    const rows = family().filter((a) => a.id !== customerId);
    const lostOriginals = [{ id: customerId, name: "customer_id", entityName: "Customer" }];
    expect(update(rows, C1, { type: { dataType: "date" } }, { lostOriginals })).toMatchObject({
      ok: false,
      error: { code: "invalid", message: FOLLOWS_LOST_REFUSAL("Customer.customer_id") },
    });
  });

  it("“Stop following” clears the link, live original or deleted, in one change group; the copy's copies keep following it", () => {
    const stop = update(family(), C1, { stopFollowing: true });
    if (!stop.ok) throw new Error(stop.error.message);
    expect(stop.writeSet.writes).toMatchObject([{ row: { id: C1, copied_from_attribute_id: null, data_type: "integer" } }]);
    // then its fields are its own: a type change reaches its own copy, not the original
    const detached = family().map((a) => (a.id === C1 ? stop.value.attribute : a));
    const own = updateAttribute(makeCtx(), access("modeler"), { attribute: stop.value.attribute, attributes: detached, entities }, { attributeId: C1, expectedVersion: 2, type: { dataType: "date" } });
    expect(rowsOf(own).map((row) => [row.id, row.data_type])).toEqual([
      [C1, "date"],
      [C2, "date"],
    ]);
    // a lost copy stops following too
    expect(update(family().filter((a) => a.id !== customerId), C1, { stopFollowing: true })).toMatchObject({ ok: true, value: { attribute: { copied_from_attribute_id: null } } });
    // an attribute that is no copy has nothing to stop; a reviewer may not
    expect(update(family(), customerId, { stopFollowing: true })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(updateAttribute(makeCtx(), access("reviewer"), { attribute: family()[2]!, attributes: family() }, { attributeId: C1, expectedVersion: 1, stopFollowing: true })).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
  });
});
