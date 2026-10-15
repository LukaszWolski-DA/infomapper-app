import { describe, expect, it } from "vitest";
import { attribute, entity, ids, mapping, mappingInput, relationship, requirementLink, sourceColumn, sourceTable, T0 } from "../__fixtures__/domain";
import type { Mapping, MappingInput, RequirementLink, WorkspaceModel } from "../types";
import { focusLit, requirementFocusLit } from "./lit";
import { requirementScope } from "./requirements";

const MAP_ID = "01900000-0000-7000-8000-00000000a011";
const IN_2 = "01900000-0000-7000-8000-00000000b002";

/** Customer (customer_id, email) — places → Sales Order (order_id); CRM customer's three columns; email ← colEmail (draft). */
function model(mappings: Mapping[] = [mapping()], inputs: MappingInput[] = [mappingInput()]): WorkspaceModel {
  return {
    concepts: [],
    entities: [entity(ids.customer), entity(ids.salesOrder)],
    attributes: [attribute(ids.customerId), attribute(ids.email), attribute(ids.orderId)],
    relationships: [relationship()],
    sourceSystems: [],
    sourceTables: [sourceTable()],
    sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
    mappings,
    mappingInputs: inputs,
  };
}

const approvedCustId = mapping({ id: MAP_ID, attribute_id: ids.customerId, status: "approved", approved_by: ids.someoneElse, approved_at: T0 });
const custIdInput = mappingInput(IN_2, { mapping_id: MAP_ID, source_column_id: ids.colCustId });
const link = (over: Partial<RequirementLink>) => requirementLink(ids.reqLink1, { attribute_id: null, ...over });
const lens = (links: RequirementLink[], m: WorkspaceModel) => requirementFocusLit(m, requirementScope(ids.req101, links, m));

describe("Focus (slice 4p; prototype relatedOf “entity”)", () => {
  it("lights the entity, its attributes' mappings with their tables, and its relationships with both ends; colours no row", () => {
    const lit = focusLit(model(), ids.customer);
    expect(lit.entities).toEqual(new Set([ids.customer, ids.salesOrder]));
    expect(lit.tables).toEqual(new Set([ids.crmCustomer]));
    expect(lit.mappings).toEqual(new Set([ids.mapEmail]));
    expect(lit.relationships).toEqual(new Set([ids.relPlaces]));
    expect(lit.rows.size).toBe(0);
  });

  it("from the other end: Sales Order lights its relationship and Customer, not Customer's mappings", () => {
    const lit = focusLit(model(), ids.salesOrder);
    expect(lit.entities).toEqual(new Set([ids.salesOrder, ids.customer]));
    expect(lit.tables.size + lit.mappings.size).toBe(0);
  });

  it("leaves out deleted rows", () => {
    const lit = focusLit(model([mapping({ deleted_at: T0 })]), ids.customer);
    expect(lit.mappings.size + lit.tables.size).toBe(0);
  });
});

describe("Focus on a requirement (slice 4b-1, slice 4p's lens without its colours; prototype relatedOf “req”)", () => {
  it("an entity link: the entity and its attributes' mappings with tables (4a's scope until step 4); no row coloured", () => {
    const lit = lens([link({ entity_id: ids.customer })], model([mapping(), approvedCustId], [mappingInput(), custIdInput]));
    expect(lit.entities).toEqual(new Set([ids.customer]));
    expect(lit.tables).toEqual(new Set([ids.crmCustomer]));
    expect(lit.mappings).toEqual(new Set([ids.mapEmail, MAP_ID]));
    expect(lit.rows.size).toBe(0);
    expect(lit.relationships.size).toBe(0);
  });

  it("an attribute without a mapping lights only its entity", () => {
    const lit = lens([link({ attribute_id: ids.orderId })], model());
    expect(lit.entities).toEqual(new Set([ids.salesOrder]));
    expect(lit.rows.size).toBe(0);
    expect(lit.tables.size + lit.mappings.size).toBe(0);
  });

  it("a table link lights the table only; a column link lights its mappings with their entity", () => {
    expect(lens([link({ source_table_id: ids.crmCustomer })], model())).toMatchObject({ entities: new Set(), tables: new Set([ids.crmCustomer]), rows: new Map(), mappings: new Set() });
    const lit = lens([link({ source_column_id: ids.colEmail })], model());
    expect(lit.rows.size).toBe(0);
    expect(lit.mappings).toEqual(new Set([ids.mapEmail]));
    expect(lit.entities).toEqual(new Set([ids.customer]));
    expect(lit.tables).toEqual(new Set([ids.crmCustomer]));
  });

  it("a mapping link: the mapping, its attribute's entity and its inputs' table", () => {
    const lit = lens([link({ mapping_id: ids.mapEmail })], model());
    expect(lit.mappings).toEqual(new Set([ids.mapEmail]));
    expect(lit.entities).toEqual(new Set([ids.customer]));
    expect(lit.tables).toEqual(new Set([ids.crmCustomer]));
    expect(lit.rows.size).toBe(0);
  });
});
