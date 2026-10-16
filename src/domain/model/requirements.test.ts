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
  coverageParts,
  lastRequirementEditor,
  nextRequirementKey,
  requirementCoverage,
  requirementScope,
  requirementWithKey,
  withDescendants,
} from "./requirements";
import { requirementsOf } from "./requirement-index";

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

describe("scope (D-31; slice 4b-1, PRD item 9)", () => {
  it("an entity link is the entity and one item, without its attributes; an attribute link is the attribute and its card's entity, one attribute item", () => {
    const m = model([mapping()], [mappingInput()]);
    expect(requirementScope(ids.req101, [link({ entity_id: ids.customer })], m)).toEqual({
      entities: new Set([ids.customer]),
      attributes: new Set(),
      mappings: new Set(),
      tables: new Set(),
      columns: new Set(),
      entityItems: new Set([ids.customer]),
      attributeItems: new Set(),
    });
    expect(requirementScope(ids.req101, [link({ attribute_id: ids.orderId })], m)).toMatchObject({
      entities: new Set([ids.salesOrder]),
      attributes: new Set([ids.orderId]),
      entityItems: new Set(),
      attributeItems: new Set([ids.orderId]),
    });
  });

  it("a mapping link: the mapping, its attribute (an item), the attribute's entity, its input columns and their table", () => {
    const m = model([mapping()], [mappingInput()]);
    expect(requirementScope(ids.req101, [link({ mapping_id: ids.mapEmail })], m)).toEqual({
      entities: new Set([ids.customer]),
      attributes: new Set([ids.email]),
      mappings: new Set([ids.mapEmail]),
      tables: new Set([ids.crmCustomer]),
      columns: new Set([ids.colEmail]),
      entityItems: new Set(),
      attributeItems: new Set([ids.email]),
    });
  });

  it("tables and columns are in scope but are not items; deleted links and other requirements' links are skipped", () => {
    expect(requirementScope(ids.req101, [link({ source_table_id: ids.crmCustomer })], model())).toMatchObject({ tables: new Set([ids.crmCustomer]), attributes: new Set(), entityItems: new Set(), attributeItems: new Set() });
    expect(requirementScope(ids.req101, [link({ source_column_id: ids.colEmail })], model())).toMatchObject({ tables: new Set([ids.crmCustomer]), columns: new Set([ids.colEmail]), attributeItems: new Set() });
    const others = [link({ entity_id: ids.customer, deleted_at: T0 }), link({ entity_id: ids.salesOrder, requirement_id: ids.req102 })];
    expect(requirementScope(ids.req101, others, model()).entities.size).toBe(0);
  });
});

describe("coverage (D-31; slice 4b-1, PRD item 10)", () => {
  it("attribute items: an approved fitting mapping covers, a draft one is mapped but not approved, none is not mapped", () => {
    const m = model([custIdMapping, mapping()], [custIdInput, mappingInput()]);
    const links = [link({ attribute_id: ids.customerId }), link({ id: ids.reqLink2, attribute_id: ids.email }), link({ id: ids.reqLink3, attribute_id: ids.orderId })];
    expect(requirementCoverage(ids.req101, links, m)).toEqual({
      total: 3,
      covered: [ids.customerId],
      notApproved: [ids.email],
      notMapped: [ids.orderId],
      entityGaps: [],
      parts: { entities: 0, attributes: 3 },
      done: false,
    });
  });

  it("an entity item is covered when at least one of its attributes is; its attributes are not items", () => {
    const links = [link({ entity_id: ids.customer })];
    // customer_id approved, email not mapped: one attribute is enough
    expect(requirementCoverage(ids.req101, links, model([custIdMapping], [custIdInput]))).toEqual({
      total: 1,
      covered: [ids.customer],
      notApproved: [],
      notMapped: [],
      entityGaps: [],
      parts: { entities: 1, attributes: 0 },
      done: true,
    });
    // only a draft mapping on email: no attribute covered, the entity is a gap
    expect(requirementCoverage(ids.req101, links, model([mapping()], [mappingInput()]))).toMatchObject({ total: 1, covered: [], entityGaps: [ids.customer], done: false });
  });

  it("an entity item uses the same rule: an approved mapping with a type conflict does not cover it", () => {
    // customer_id is an integer; the CRM column email is varchar
    const clash = mapping({ id: MAP_ID, attribute_id: ids.customerId, ...approved });
    const m = model([clash], [mappingInput(IN_2, { mapping_id: MAP_ID, source_column_id: ids.colEmail })]);
    expect(requirementCoverage(ids.req101, [link({ entity_id: ids.customer })], m)).toMatchObject({ covered: [], entityGaps: [ids.customer], done: false });
  });

  it("an entity and one of its attributes linked: two items, entity first; an attribute link does not add its entity as an item", () => {
    const m = model([custIdMapping, mapping()], [custIdInput, mappingInput()]);
    const both = requirementCoverage(ids.req101, [link({ entity_id: ids.customer }), link({ id: ids.reqLink2, attribute_id: ids.email })], m);
    expect(both).toMatchObject({ total: 2, covered: [ids.customer], notApproved: [ids.email], parts: { entities: 1, attributes: 1 }, done: false });
    expect(requirementCoverage(ids.req101, [link({ attribute_id: ids.customerId })], m)).toMatchObject({ total: 1, parts: { entities: 0, attributes: 1 }, done: true });
  });

  it("a mapping link: its attribute is the item, covered by any approved mapping of it", () => {
    const m = model([mapping(), mapping({ id: MAP_ORDER, ...approved })], [mappingInput(), mappingInput(IN_2, { mapping_id: MAP_ORDER })]);
    expect(requirementCoverage(ids.req101, [link({ mapping_id: ids.mapEmail })], m)).toEqual({
      total: 1,
      covered: [ids.email],
      notApproved: [],
      notMapped: [],
      entityGaps: [],
      parts: { entities: 0, attributes: 1 },
      done: true,
    });
  });

  it("an approved mapping with a type conflict on its input does not cover: the attribute is mapped, not approved", () => {
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

  it("a requirement traced only to tables or columns has no items, 0 / 0, and is not covered", () => {
    const c = requirementCoverage(ids.req101, [link({ source_table_id: ids.crmCustomer }), link({ id: ids.reqLink2, source_column_id: ids.colEmail })], model([custIdMapping], [custIdInput]));
    expect(c).toEqual({ total: 0, covered: [], notApproved: [], notMapped: [], entityGaps: [], parts: { entities: 0, attributes: 0 }, done: false });
  });

  it("names the parts for the tooltip (PRD item 11)", () => {
    expect(coverageParts({ entities: 1, attributes: 3 })).toBe("1 entity, 3 attributes");
    expect(coverageParts({ entities: 2, attributes: 0 })).toBe("2 entities");
    expect(coverageParts({ entities: 0, attributes: 1 })).toBe("1 attribute");
    expect(coverageParts({ entities: 0, attributes: 0 })).toBe("nothing");
  });
});

describe("direct and indirect requirements of an element (D-34; slice 4b-1, PRD item 12)", () => {
  const reqs = [requirement(ids.req101), requirement(ids.req102), requirement(ids.req103), requirement(ids.req104)];
  const links = [
    link({ requirement_id: ids.req101, entity_id: ids.customer }),
    link({ id: ids.reqLink2, requirement_id: ids.req102, attribute_id: ids.email }),
    link({ id: ids.reqLink3, requirement_id: ids.req103, mapping_id: ids.mapEmail }),
    link({ id: "01900000-0000-7000-8000-00000000e207", requirement_id: ids.req104, source_column_id: ids.colEmail }),
  ];
  const m = model([mapping()], [mappingInput()]);
  const keys = (rs: { key: string }[]) => rs.map((r) => r.key);
  const via = (r: { indirect: { requirement: { key: string }; via: string }[] }) => r.indirect.map((x) => `${x.requirement.key} ${x.via}`);

  it("an attribute: its own, then those of mappings onto it, via mapping; never its entity's", () => {
    const r = requirementsOf({ kind: "attribute", id: ids.email }, reqs, links, m);
    expect([keys(r.direct), via(r)]).toEqual([["REQ-102"], ["REQ-103 via mapping"]]);
    expect(requirementsOf({ kind: "attribute", id: ids.customerId }, reqs, links, m)).toEqual({ direct: [], indirect: [] });
  });

  it("an entity: its own, then those of its attributes (via attribute) and of mappings onto them (via mapping)", () => {
    const r = requirementsOf({ kind: "entity", id: ids.customer }, reqs, links, m);
    expect([keys(r.direct), via(r)]).toEqual([["REQ-101"], ["REQ-102 via attribute", "REQ-103 via mapping"]]);
  });

  it("a table: those of its columns (via column) and of mappings reading them (via mapping); a column and a mapping their own only", () => {
    expect(via(requirementsOf({ kind: "source_table", id: ids.crmCustomer }, reqs, links, m))).toEqual(["REQ-103 via mapping", "REQ-104 via column"]);
    const column = requirementsOf({ kind: "source_column", id: ids.colEmail }, reqs, links, m);
    expect([keys(column.direct), column.indirect]).toEqual([["REQ-104"], []]);
    const mp = requirementsOf({ kind: "mapping", id: ids.mapEmail }, reqs, links, m);
    expect([keys(mp.direct), mp.indirect]).toEqual([["REQ-103"], []]);
  });

  it("lists a requirement once: as direct when it is both, else with the first way it reaches the element", () => {
    // REQ-102 also linked to the mapping onto email: Customer shows it once, via attribute
    const more = [...links, link({ id: "01900000-0000-7000-8000-00000000e208", requirement_id: ids.req102, mapping_id: ids.mapEmail })];
    expect(via(requirementsOf({ kind: "entity", id: ids.customer }, reqs, more, m))).toEqual(["REQ-102 via attribute", "REQ-103 via mapping"]);
    // REQ-101 linked to Customer and to email: email shows it once, directly
    const both = [...links, link({ id: "01900000-0000-7000-8000-00000000e209", requirement_id: ids.req101, attribute_id: ids.email })];
    const email = requirementsOf({ kind: "attribute", id: ids.email }, reqs, both, m);
    expect([keys(email.direct), via(email)]).toEqual([["REQ-101", "REQ-102"], ["REQ-103 via mapping"]]);
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
