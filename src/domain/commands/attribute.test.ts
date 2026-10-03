import { describe, expect, it } from "vitest";
import { access, archived, attribute, entity, ids, makeCtx, mapping, mappingInput, NOW } from "../__fixtures__/domain";
import { addAttribute, deleteAttribute, updateAttribute } from "./attribute";

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
