// The level rules every write keeps (slice 15a, C-3, C-7 as changed on 4 November 2026).

import { describe, expect, it } from "vitest";
import { access, attribute, entity, ids, makeCtx, mapping, mappingInput, sourceColumn } from "../__fixtures__/domain";
import { createAttributeFromColumn } from "../commands/attribute";
import { createMapping } from "../commands/mapping";
import { buildWriteSet, type Write } from "../changes";
import { dimensionalCount, INFOCUBE_OFF_MESSAGE, LEVEL_CHANGE_MESSAGE, levelWritesRefusal, MAPPING_TO_DIMENSIONAL_MESSAGE, mappingWritesRefusal, writesEntities, writesMappingTargets } from "./levels";

const ctx = makeCtx();
const fact = entity(ids.salesOrder, { model_level: "dimensional", name: "Fact Sales" });
const deletedFact = { ...fact, deleted_at: ctx.now, version: 2 };
const off = { infocube: false };
const on = { infocube: true };
const writes = (...w: Write[]) => buildWriteSet(ctx, ids.ws, w).writes;

describe("levelWritesRefusal (C-7)", () => {
  it("refuses a dimensional entity inserted while InfoCube is off, and lets it through while on", () => {
    const insert = writes({ kind: "insert", table: "entity", row: fact });
    expect(levelWritesRefusal(off, insert)).toMatchObject({ code: "forbidden", message: INFOCUBE_OFF_MESSAGE });
    expect(levelWritesRefusal(on, insert)).toBeNull();
  });

  it("refuses a deleted dimensional entity brought back while off (an undo or redo), not one deleted or changed", () => {
    expect(levelWritesRefusal(off, writes({ kind: "update", table: "entity", before: deletedFact, row: { ...fact, version: 3 } }))).toMatchObject({ code: "forbidden" });
    expect(levelWritesRefusal(off, writes({ kind: "update", table: "entity", before: fact, row: deletedFact }))).toBeNull();
    expect(levelWritesRefusal(off, writes({ kind: "update", table: "entity", before: fact, row: { ...fact, name: "Sales", version: 2 } }))).toBeNull();
  });

  it("lets logical entities through while off", () => {
    const customer = entity(ids.customer);
    expect(levelWritesRefusal(off, writes({ kind: "insert", table: "entity", row: customer }))).toBeNull();
    expect(levelWritesRefusal(off, writes({ kind: "update", table: "entity", before: { ...customer, deleted_at: ctx.now }, row: customer }))).toBeNull();
  });

  it("refuses any write that changes an entity's level, InfoCube on or off; an old image without a level is logical", () => {
    const customer = entity(ids.customer);
    const toDimensional = writes({ kind: "update", table: "entity", before: customer, row: { ...customer, model_level: "dimensional", version: 2 } });
    expect(levelWritesRefusal(on, toDimensional)).toMatchObject({ code: "invalid", message: LEVEL_CHANGE_MESSAGE });
    const old = Object.fromEntries(Object.entries(customer).filter(([k]) => k !== "model_level")) as typeof customer;
    expect(levelWritesRefusal(on, writes({ kind: "update", table: "entity", before: old, row: { ...customer, version: 2 } }))).toBeNull();
  });

  it("reads only writes of entities", () => {
    expect(writesEntities(writes({ kind: "insert", table: "entity", row: fact }))).toBe(true);
    expect(writesEntities([])).toBe(false);
  });
});

describe("dimensionalCount", () => {
  it("counts the workspace's live facts and dimensions only", () => {
    const rows = [entity(ids.customer), fact, { ...fact, id: ids.email, deleted_at: ctx.now }, { ...fact, id: ids.orderId, workspace_id: ids.org }];
    expect(dimensionalCount(rows, ids.ws)).toBe(1);
  });
});

describe("a mapping's target is a logical attribute (slice 15a step 5, B-6's refusal before 15c)", () => {
  const dim = entity(ids.customer, { model_level: "dimensional", name: "Dim Customer" });
  const logical = entity(ids.customer);
  const refused = { ok: false, error: { code: "invalid", message: MAPPING_TO_DIMENSIONAL_MESSAGE } };

  it("createMapping refuses a fact's or a dimension's attribute and takes a logical one", () => {
    const state = { attribute: attribute(ids.email), column: sourceColumn(ids.colFirstName), mappings: [], mappingInputs: [] };
    const input = { attributeId: ids.email, sourceColumnId: ids.colFirstName };
    expect(createMapping(makeCtx(), access("modeler"), { ...state, entity: dim }, input)).toMatchObject(refused);
    expect(createMapping(makeCtx(), access("modeler"), { ...state, entity: logical }, input).ok).toBe(true);
  });

  it("a column dropped on a fact's or a dimension's header is refused, also onto an attribute of the column's name", () => {
    const column = sourceColumn(ids.colEmail, { name: "email" });
    const state = { entity: dim, attributes: [attribute(ids.email, { name: "email" })], column, mappings: [mapping()], mappingInputs: [mappingInput()] };
    expect(createAttributeFromColumn(makeCtx(), access("modeler"), state, { entityId: ids.customer, sourceColumnId: ids.colEmail })).toMatchObject(refused);
    expect(createAttributeFromColumn(makeCtx(), access("modeler"), { ...state, attributes: [] }, { entityId: ids.customer, sourceColumnId: ids.colEmail })).toMatchObject(refused);
  });

  it("mappingWritesRefusal: any write set that adds or retargets a mapping onto a dimensional attribute, whatever built it", () => {
    const m = mapping({ attribute_id: ids.email });
    const add = writes({ kind: "insert", table: "mapping", row: m });
    expect(writesMappingTargets(add)).toBe(true);
    expect(mappingWritesRefusal(add, [dim], [attribute(ids.email)])).toMatchObject({ code: "invalid", message: MAPPING_TO_DIMENSIONAL_MESSAGE });
    expect(mappingWritesRefusal(add, [logical], [attribute(ids.email)])).toBeNull();
    // an attribute the same writes insert into a dimensional entity
    const fresh = attribute(ids.customerId, { entity_id: ids.customer });
    const withNew = writes({ kind: "insert", table: "attribute", row: fresh }, { kind: "insert", table: "mapping", row: mapping({ attribute_id: fresh.id }) });
    expect(mappingWritesRefusal(withNew, [dim], [])).toMatchObject({ message: MAPPING_TO_DIMENSIONAL_MESSAGE });
    // a status change on an existing mapping is not a new target: not read
    const status = writes({ kind: "update", table: "mapping", before: m, row: { ...m, status: "approved", version: 2 } });
    expect(writesMappingTargets(status)).toBe(false);
    expect(mappingWritesRefusal(status, [dim], [attribute(ids.email)])).toBeNull();
  });
});
