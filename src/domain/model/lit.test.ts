import { describe, expect, it } from "vitest";
import { attribute, entity, ids, mapping, mappingInput, relationship, requirementLink, sourceColumn, sourceTable, T0 } from "../__fixtures__/domain";
import type { Mapping, MappingInput, RequirementLink, WorkspaceModel } from "../types";
import { focusLit, litRequirements, mergeLit, requirementFocusLit, scopeContains, targetLit } from "./lit";
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
  it("an entity link: the entity alone, without its attributes' mappings (slice 4b-1, PRD item 9); no row coloured", () => {
    const lit = lens([link({ entity_id: ids.customer })], model([mapping(), approvedCustId], [mappingInput(), custIdInput]));
    expect(lit.entities).toEqual(new Set([ids.customer]));
    expect(lit.tables.size + lit.mappings.size + lit.relationships.size + lit.rows.size).toBe(0);
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

describe("Focus on the other selections (slice 4b-1, PRD item 21; prototype relatedOf)", () => {
  const both = () => model([mapping(), approvedCustId], [mappingInput(), custIdInput]);

  it("a table: the table and its columns' mappings with their entities; no relationship", () => {
    const lit = targetLit(both(), { t: "table", id: ids.crmCustomer });
    expect(lit.tables).toEqual(new Set([ids.crmCustomer]));
    expect(lit.mappings).toEqual(new Set([ids.mapEmail, MAP_ID]));
    expect(lit.entities).toEqual(new Set([ids.customer]));
    expect(lit.relationships.size + lit.rows.size).toBe(0);
  });

  it("an attribute: its entity and its mappings with their tables; an attribute without one, its entity alone", () => {
    expect(targetLit(model(), { t: "attribute", id: ids.email })).toMatchObject({ entities: new Set([ids.customer]), tables: new Set([ids.crmCustomer]), mappings: new Set([ids.mapEmail]) });
    expect(targetLit(model(), { t: "attribute", id: ids.orderId })).toMatchObject({ entities: new Set([ids.salesOrder]), tables: new Set(), mappings: new Set() });
  });

  it("a column: its table and its mappings with their entities; a column without one, its table alone", () => {
    expect(targetLit(model(), { t: "column", id: ids.colEmail })).toMatchObject({ entities: new Set([ids.customer]), tables: new Set([ids.crmCustomer]), mappings: new Set([ids.mapEmail]) });
    expect(targetLit(model(), { t: "column", id: ids.colFirstName })).toMatchObject({ entities: new Set(), tables: new Set([ids.crmCustomer]), mappings: new Set() });
  });

  it("a mapping: the mapping with its ends; a relationship: the relationship with both entities", () => {
    expect(targetLit(model(), { t: "mapping", id: ids.mapEmail })).toMatchObject({ entities: new Set([ids.customer]), tables: new Set([ids.crmCustomer]), mappings: new Set([ids.mapEmail]), relationships: new Set() });
    expect(targetLit(model(), { t: "relationship", id: ids.relPlaces })).toMatchObject({ entities: new Set([ids.customer, ids.salesOrder]), tables: new Set(), mappings: new Set(), relationships: new Set([ids.relPlaces]) });
  });

  it("several items (a frame's cards or a multi-selection): what each of them lights, together", () => {
    const lit = targetLit(model(), { t: "several", entities: [ids.salesOrder], tables: [ids.crmCustomer] });
    expect(lit.entities).toEqual(new Set([ids.salesOrder, ids.customer]));
    expect(lit.tables).toEqual(new Set([ids.crmCustomer]));
    expect(lit.mappings).toEqual(new Set([ids.mapEmail]));
    expect(lit.relationships).toEqual(new Set([ids.relPlaces]));
  });

  it("an unknown or deleted id lights nothing", () => {
    const m = model([mapping({ deleted_at: T0 })]);
    for (const t of ["attribute", "column", "mapping", "relationship"] as const) {
      const lit = targetLit(m, { t, id: t === "mapping" ? ids.mapEmail : "01900000-0000-7000-8000-0000000fffff" });
      expect(lit.entities.size + lit.tables.size + lit.mappings.size + lit.relationships.size, t).toBe(0);
    }
  });
});

describe("lit requirement cards (slice 4b-2, PRD item 21, answer C; prototype reqActive)", () => {
  const m = model();
  /** REQ-101 on the attribute email (Customer), REQ-102 on the table CRM customer, REQ-103 on Sales Order's mapping-less entity. */
  const links = [
    link({ attribute_id: ids.email }),
    requirementLink(ids.reqLink2, { requirement_id: ids.req102, attribute_id: null, source_table_id: ids.crmCustomer }),
    requirementLink(ids.reqLink3, { requirement_id: ids.req103, attribute_id: null, entity_id: ids.salesOrder }),
  ];
  const scopeOf = (id: string) => requirementScope(id, links, m);
  const all = [ids.req101, ids.req102, ids.req103];
  const lit = (target: Parameters<typeof litRequirements>[1]) => litRequirements(m, target, all, scopeOf);

  it("the focused requirement's card only", () => {
    expect(lit({ t: "requirement", id: ids.req102 })).toEqual(new Set([ids.req102]));
  });

  it("an entity: the cards whose scope holds it (an attribute link brings its entity), not its neighbours'", () => {
    expect(lit({ t: "entity", id: ids.customer })).toEqual(new Set([ids.req101]));
    // Customer's Focus lights Sales Order through the relationship, but REQ-103's scope does not contain Customer
    expect(focusLit(m, ids.customer).entities.has(ids.salesOrder)).toBe(true);
  });

  it("a table, an attribute, a column", () => {
    expect(lit({ t: "table", id: ids.crmCustomer })).toEqual(new Set([ids.req102]));
    expect(lit({ t: "attribute", id: ids.email })).toEqual(new Set([ids.req101]));
    expect(lit({ t: "attribute", id: ids.customerId })).toEqual(new Set());
    expect(lit({ t: "column", id: ids.colEmail })).toEqual(new Set());
  });

  it("a mapping: in scope itself, or its attribute is", () => {
    // email's mapping: REQ-101 holds the attribute email
    expect(lit({ t: "mapping", id: ids.mapEmail })).toEqual(new Set([ids.req101]));
    const onMap = [requirementLink(ids.reqLink1, { requirement_id: ids.req104, attribute_id: null, mapping_id: ids.mapEmail })];
    expect(litRequirements(m, { t: "mapping", id: ids.mapEmail }, [ids.req104], (id) => requirementScope(id, onMap, m))).toEqual(new Set([ids.req104]));
  });

  it("a relationship: either entity in scope", () => {
    expect(lit({ t: "relationship", id: ids.relPlaces })).toEqual(new Set([ids.req101, ids.req103]));
  });

  it("several: any of their entities or tables, and the requirements among them", () => {
    expect(lit({ t: "several", entities: [ids.salesOrder], tables: [ids.crmCustomer] })).toEqual(new Set([ids.req102, ids.req103]));
    expect(lit({ t: "several", entities: [], tables: [], requirements: [ids.req101] })).toEqual(new Set([ids.req101]));
  });

  it("only among the given requirements (the cards on the canvas)", () => {
    expect(litRequirements(m, { t: "entity", id: ids.customer }, [ids.req102], scopeOf)).toEqual(new Set());
  });

  it("scopeContains for one requirement; unknown mapping or relationship: no", () => {
    expect(scopeContains(m, scopeOf(ids.req101), { t: "entity", id: ids.customer })).toBe(true);
    expect(scopeContains(m, scopeOf(ids.req101), { t: "mapping", id: MAP_ID })).toBe(false);
    expect(scopeContains(m, scopeOf(ids.req101), { t: "relationship", id: MAP_ID })).toBe(false);
  });

  it("mergeLit adds everything the second set lights", () => {
    const a = targetLit(m, { t: "table", id: ids.crmCustomer });
    const merged = mergeLit(a, targetLit(m, { t: "relationship", id: ids.relPlaces }));
    expect(merged.tables).toEqual(new Set([ids.crmCustomer]));
    expect(merged.entities).toEqual(new Set([ids.customer, ids.salesOrder]));
    expect(merged.relationships).toEqual(new Set([ids.relPlaces]));
    expect(merged.mappings).toEqual(new Set([ids.mapEmail]));
  });
});
