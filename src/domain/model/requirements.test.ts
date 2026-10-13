import { describe, expect, it } from "vitest";
import {
  attribute,
  changeEvent,
  entity,
  ids,
  mapping,
  mappingInput,
  requirement,
  requirementLink,
  sourceColumn,
  sourceTable,
  T0,
} from "../__fixtures__/domain";
import type { Mapping, MappingInput, RequirementLink, WorkspaceModel } from "../types";
import {
  canBeParent,
  lastRequirementEditor,
  nextRequirementKey,
  requirementCoverage,
  requirementScope,
  requirementsOf,
  requirementWithKey,
  withDescendants,
} from "./requirements";

const MAP_ID = "01900000-0000-7000-8000-00000000a011";
const MAP_ORDER = "01900000-0000-7000-8000-00000000a012";
const IN_2 = "01900000-0000-7000-8000-00000000b002";

/** Customer (customer_id integer, email string(100)) and Sales Order (order_id integer); CRM customer's three columns. */
function model(mappings: Mapping[] = [], inputs: MappingInput[] = []): Pick<WorkspaceModel, "entities" | "attributes" | "mappings" | "mappingInputs" | "sourceTables" | "sourceColumns"> {
  return {
    entities: [entity(ids.customer), entity(ids.salesOrder)],
    attributes: [attribute(ids.customerId), attribute(ids.email), attribute(ids.orderId)],
    mappings,
    mappingInputs: inputs,
    sourceTables: [sourceTable()],
    sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
  };
}

const approved = { status: "approved" as const, approved_by: ids.someoneElse, approved_at: T0 };
const custIdMapping = mapping({ id: MAP_ID, attribute_id: ids.customerId, ...approved });
const custIdInput = mappingInput(IN_2, { mapping_id: MAP_ID, source_column_id: ids.colCustId });
const link = (over: Partial<RequirementLink>) => requirementLink(ids.reqLink1, { attribute_id: null, ...over });

describe("scope (D-31, prototype reqScope)", () => {
  it("takes a linked entity with all its attributes, an attribute with its entity, a mapping with its attribute, entity, input columns and their table", () => {
    const m = model([mapping()], [mappingInput()]);
    expect(requirementScope(ids.req101, [link({ entity_id: ids.customer })], m)).toEqual({
      entities: new Set([ids.customer]),
      attributes: new Set([ids.customerId, ids.email]),
      mappings: new Set(),
      tables: new Set(),
      columns: new Set(),
    });
    expect(requirementScope(ids.req101, [link({ attribute_id: ids.orderId })], m)).toMatchObject({ entities: new Set([ids.salesOrder]), attributes: new Set([ids.orderId]) });
    expect(requirementScope(ids.req101, [link({ mapping_id: ids.mapEmail })], m)).toEqual({
      entities: new Set([ids.customer]),
      attributes: new Set([ids.email]),
      mappings: new Set([ids.mapEmail]),
      tables: new Set([ids.crmCustomer]),
      columns: new Set([ids.colEmail]),
    });
  });

  it("takes a linked table, and a linked column with its table; skips deleted links and other requirements' links", () => {
    expect(requirementScope(ids.req101, [link({ source_table_id: ids.crmCustomer })], model())).toMatchObject({ tables: new Set([ids.crmCustomer]), attributes: new Set() });
    expect(requirementScope(ids.req101, [link({ source_column_id: ids.colEmail })], model())).toMatchObject({ tables: new Set([ids.crmCustomer]), columns: new Set([ids.colEmail]) });
    const others = [link({ entity_id: ids.customer, deleted_at: T0 }), link({ entity_id: ids.salesOrder, requirement_id: ids.req102 })];
    expect(requirementScope(ids.req101, others, model()).entities.size).toBe(0);
  });
});

describe("coverage (D-31, prototype reqCoverage)", () => {
  it("direct links: an approved fitting mapping covers, a draft one is mapped but not approved, none is not mapped", () => {
    const m = model([custIdMapping, mapping()], [custIdInput, mappingInput()]);
    const links = [link({ attribute_id: ids.customerId }), link({ id: ids.reqLink2, attribute_id: ids.email }), link({ id: ids.reqLink3, attribute_id: ids.orderId })];
    expect(requirementCoverage(ids.req101, links, m)).toEqual({ total: 3, covered: [ids.customerId], notApproved: [ids.email], notMapped: [ids.orderId], done: false });
  });

  it("via the entity: every attribute of a linked entity counts; covered only when all of them are", () => {
    const links = [link({ entity_id: ids.customer })];
    const half = requirementCoverage(ids.req101, links, model([custIdMapping], [custIdInput]));
    expect(half).toMatchObject({ total: 2, covered: [ids.customerId], notMapped: [ids.email], done: false });
    const all = requirementCoverage(ids.req101, links, model([custIdMapping, mapping(approved)], [custIdInput, mappingInput()]));
    expect(all).toMatchObject({ total: 2, done: true });
  });

  it("via a mapping: its attribute is in scope and covered by any approved mapping of it", () => {
    const m = model([mapping(), mapping({ id: MAP_ORDER, ...approved })], [mappingInput(), mappingInput(IN_2, { mapping_id: MAP_ORDER })]);
    expect(requirementCoverage(ids.req101, [link({ mapping_id: ids.mapEmail })], m)).toEqual({ total: 1, covered: [ids.email], notApproved: [], notMapped: [], done: true });
  });

  it("an approved mapping with a type conflict on its input does not cover: the attribute is mapped, not approved", () => {
    // customer_id is an integer; the CRM column email is varchar
    const clash = mapping({ id: MAP_ID, attribute_id: ids.customerId, ...approved });
    const m = model([clash], [mappingInput(IN_2, { mapping_id: MAP_ID, source_column_id: ids.colEmail })]);
    expect(requirementCoverage(ids.req101, [link({ attribute_id: ids.customerId })], m)).toMatchObject({ covered: [], notApproved: [ids.customerId], done: false });
  });

  it("a composite mapping is checked on every input; a transformation rule handles a conversion, as in the mapping panel", () => {
    const composite = mapping({ id: MAP_ID, attribute_id: ids.customerId, kind: "transform", rule_expression: "CAST(email AS int)", ...approved });
    const inputs = [mappingInput(IN_2, { mapping_id: MAP_ID, source_column_id: ids.colCustId, sort_order: 0 }), mappingInput(ids.inEmail, { mapping_id: MAP_ID, source_column_id: ids.colEmail, sort_order: 1 })];
    const links = [link({ attribute_id: ids.customerId })];
    expect(requirementCoverage(ids.req101, links, model([composite], inputs)).done).toBe(true);
    // the same two inputs without a working rule: the varchar input does not fit the integer attribute
    const noRule = { ...composite, rule_expression: " " };
    expect(requirementCoverage(ids.req101, links, model([noRule], inputs))).toMatchObject({ notApproved: [ids.customerId], done: false });
  });

  it("a requirement traced only to tables or columns has 0 attributes in scope and is not covered", () => {
    const c = requirementCoverage(ids.req101, [link({ source_table_id: ids.crmCustomer }), link({ id: ids.reqLink2, source_column_id: ids.colEmail })], model([custIdMapping], [custIdInput]));
    expect(c).toEqual({ total: 0, covered: [], notApproved: [], notMapped: [], done: false });
  });
});

describe("direct and indirect requirements of an element (PRD item 8, prototype reqsFor)", () => {
  const reqs = [requirement(ids.req101), requirement(ids.req102), requirement(ids.req103)];
  const links = [
    link({ requirement_id: ids.req101, entity_id: ids.customer }),
    link({ id: ids.reqLink2, requirement_id: ids.req102, attribute_id: ids.email }),
    link({ id: ids.reqLink3, requirement_id: ids.req103, mapping_id: ids.mapEmail }),
  ];
  const m = model([mapping()], [mappingInput()]);
  const keys = (rs: { key: string }[]) => rs.map((r) => r.key);

  it("an attribute: its own plus its entity's, via entity", () => {
    const r = requirementsOf({ kind: "attribute", id: ids.email }, reqs, links, m);
    expect([keys(r.direct), keys(r.indirect), r.via]).toEqual([["REQ-102"], ["REQ-101"], "via entity"]);
  });

  it("an entity: its own plus every requirement whose scope contains it, via attribute, each once", () => {
    const r = requirementsOf({ kind: "entity", id: ids.customer }, reqs, links, m);
    expect([keys(r.direct), keys(r.indirect), r.via]).toEqual([["REQ-101"], ["REQ-102", "REQ-103"], "via attribute"]);
  });

  it("a table: every requirement whose scope contains it, via column; a column and a mapping their own only", () => {
    expect(keys(requirementsOf({ kind: "source_table", id: ids.crmCustomer }, reqs, links, m).indirect)).toEqual(["REQ-103"]);
    expect(requirementsOf({ kind: "source_column", id: ids.colEmail }, reqs, links, m)).toEqual({ direct: [], indirect: [], via: null });
    expect(keys(requirementsOf({ kind: "mapping", id: ids.mapEmail }, reqs, links, m).direct)).toEqual(["REQ-103"]);
  });
});

describe("parent (PRD item 5)", () => {
  // REQ-101 > REQ-102 > REQ-103 > REQ-104
  const chain = [
    requirement(ids.req101),
    requirement(ids.req102, { parent_id: ids.req101 }),
    requirement(ids.req103, { parent_id: ids.req102 }),
    requirement(ids.req104, { parent_id: ids.req103 }),
  ];

  it("blocks a cycle at any depth, not only itself and its direct children", () => {
    expect(withDescendants(chain, ids.req101)).toEqual(new Set([ids.req101, ids.req102, ids.req103, ids.req104]));
    expect(canBeParent(chain, ids.req101, ids.req104)).toBe(false); // depth 3
    expect(canBeParent(chain, ids.req101, ids.req103)).toBe(false);
    expect(canBeParent(chain, ids.req101, ids.req101)).toBe(false);
    expect(canBeParent(chain, ids.req104, ids.req101)).toBe(true);
    expect(canBeParent(chain, ids.req103, ids.req102)).toBe(true);
  });

  it("ignores deleted requirements below", () => {
    const broken = chain.map((r) => (r.id === ids.req102 ? { ...r, deleted_at: T0 } : r));
    expect(canBeParent(broken, ids.req101, ids.req104)).toBe(true);
  });
});

describe("key (PRD item 2)", () => {
  it("gives REQ-{counter} and skips keys someone typed, in any case", () => {
    expect(nextRequirementKey(106, [requirement(ids.req101)])).toEqual({ key: "REQ-106", next: 107 });
    const typed = [requirement(ids.req101, { key: "REQ-108" }), requirement(ids.req102, { key: "req-109" })];
    expect(nextRequirementKey(108, typed)).toEqual({ key: "REQ-110", next: 111 });
  });

  it("a deleted requirement's key is free again", () => {
    expect(nextRequirementKey(106, [requirement(ids.req101, { key: "REQ-106", deleted_at: T0 })])).toEqual({ key: "REQ-106", next: 107 });
  });

  it("finds another live requirement with the same key in any case and without surrounding spaces", () => {
    const reqs = [requirement(ids.req101), requirement(ids.req102)];
    expect(requirementWithKey(reqs, " req-102 ")?.id).toBe(ids.req102);
    expect(requirementWithKey(reqs, "REQ-102", ids.req102)).toBeNull();
    expect(requirementWithKey([requirement(ids.req101, { deleted_at: T0 })], "REQ-101")).toBeNull();
  });
});

describe("four-eyes author (AD-06, PRD item 13)", () => {
  const r = requirement(ids.req103, { created_by: ids.someoneElse });
  const ev = (user: string, at: string, before: Record<string, unknown> | null, after: Record<string, unknown>) =>
    changeEvent({ object_type: "requirement", object_id: ids.req103, user_id: user, occurred_at: at, operation: before ? "update" : "create", before_image: before, after_image: after });

  it("is whoever last changed the content (kind, name, description, expression, severity)", () => {
    const events = [
      ev(ids.someoneElse, "2026-10-01T09:00:00.000Z", null, { name: "x" }),
      ev(ids.actor, "2026-10-01T10:00:00.000Z", { description_html: null }, { description_html: "<p>y</p>" }),
    ];
    expect(lastRequirementEditor(r, events)).toBe(ids.actor);
  });

  it("does not count a status, priority, owner or parent change by someone else", () => {
    const events = [
      ev(ids.actor, "2026-10-01T10:00:00.000Z", { severity: "warn" }, { severity: "block" }),
      ev(ids.someoneElse, "2026-10-01T11:00:00.000Z", { status: "draft" }, { status: "implemented" }),
      ev(ids.someoneElse, "2026-10-01T12:00:00.000Z", { priority: "should", owner_name: null }, { priority: "must", owner_name: "DPO" }),
    ];
    expect(lastRequirementEditor(r, events)).toBe(ids.actor);
  });

  it("falls back to the creator without any content event (seeded data), and skips other objects", () => {
    expect(lastRequirementEditor(r, [])).toBe(ids.someoneElse);
    expect(lastRequirementEditor(r, [changeEvent({ object_type: "requirement", object_id: ids.req101, user_id: ids.actor, operation: "create", after_image: {} })])).toBe(ids.someoneElse);
  });
});
