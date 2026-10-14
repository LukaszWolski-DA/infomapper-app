import { describe, expect, it } from "vitest";
import { attribute, entity, ids, mapping, mappingInput, requirement, requirementLink, sourceColumn, sourceTable, T0 } from "../__fixtures__/domain";
import { buildRequirementIndex } from "./requirement-index";
import { requirementCoverage, requirementScope } from "./requirements";

const model = {
  entities: [entity(ids.customer), entity(ids.salesOrder)],
  attributes: [attribute(ids.customerId), attribute(ids.email), attribute(ids.orderId)],
  mappings: [mapping({ status: "approved", approved_by: ids.someoneElse, approved_at: T0 })],
  mappingInputs: [mappingInput()],
  sourceTables: [sourceTable()],
  sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
};
const reqs = [
  requirement(ids.req104, { kind: "business_rule" }),
  requirement(ids.req102, { parent_id: ids.req101 }),
  requirement(ids.req101, { kind: "need" }),
  requirement(ids.req103, { kind: "data", parent_id: ids.req101 }),
  requirement("01900000-0000-7000-8000-00000000e199", { key: "REQ-1000", kind: "data" }),
  requirement("01900000-0000-7000-8000-00000000e198", { key: "REQ-090", kind: "data", deleted_at: T0 }),
];
const links = [
  requirementLink(ids.reqLink1, { requirement_id: ids.req101, attribute_id: null, entity_id: ids.customer }),
  requirementLink(ids.reqLink2, { requirement_id: ids.req102, attribute_id: ids.email }),
  requirementLink(ids.reqLink3, { requirement_id: ids.req103, attribute_id: null, mapping_id: ids.mapEmail }),
  requirementLink("01900000-0000-7000-8000-00000000e204", { requirement_id: ids.req104, attribute_id: null, source_table_id: ids.crmCustomer }),
  // a deleted link and a link of a deleted requirement count for nothing
  requirementLink("01900000-0000-7000-8000-00000000e205", { requirement_id: ids.req104, attribute_id: ids.orderId, deleted_at: T0 }),
  requirementLink("01900000-0000-7000-8000-00000000e206", { requirement_id: "01900000-0000-7000-8000-00000000e198", attribute_id: ids.orderId }),
];
const ix = buildRequirementIndex(reqs, links, model);
const keys = (rs: { key: string }[]) => rs.map((r) => r.key);

describe("the requirement index (slice 4a, step 3)", () => {
  it("lists live requirements by kind, then by key in number order", () => {
    expect(keys(ix.requirements)).toEqual(["REQ-101", "REQ-102", "REQ-103", "REQ-1000", "REQ-104"]);
    expect(ix.byId.has("01900000-0000-7000-8000-00000000e198")).toBe(false);
  });

  it("gives each requirement the same scope and coverage as computing it alone", () => {
    for (const r of ix.requirements) {
      expect(ix.scope(r.id)).toEqual(requirementScope(r.id, links, model));
      expect(ix.coverage(r.id)).toEqual(requirementCoverage(r.id, links, model));
    }
    expect(ix.coveredCount).toBe(2); // REQ-102 (email) and REQ-103 (its mapping); REQ-101 has customer_id unmapped
  });

  it("keeps each requirement's live links and children", () => {
    expect(ix.linksOf(ids.req104).map((k) => k.id)).toEqual(["01900000-0000-7000-8000-00000000e204"]);
    expect(keys(ix.children(ids.req101))).toEqual(["REQ-102", "REQ-103"]);
    expect(ix.children(ids.req102)).toEqual([]);
  });

  it("finds an element's direct and indirect requirements", () => {
    expect([keys(ix.of({ kind: "attribute", id: ids.email }).direct), keys(ix.of({ kind: "attribute", id: ids.email }).indirect)]).toEqual([["REQ-102"], ["REQ-101"]]);
    expect(ix.of({ kind: "entity", id: ids.customer })).toMatchObject({ via: "via attribute" });
    expect(keys(ix.of({ kind: "entity", id: ids.customer }).indirect)).toEqual(["REQ-102", "REQ-103"]);
    expect(keys(ix.of({ kind: "source_table", id: ids.crmCustomer }).direct)).toEqual(["REQ-104"]);
    expect(keys(ix.of({ kind: "source_table", id: ids.crmCustomer }).indirect)).toEqual(["REQ-103"]);
    expect(ix.of({ kind: "attribute", id: ids.orderId })).toEqual({ direct: [], indirect: [], via: "via entity" });
    expect(keys(ix.of({ kind: "mapping", id: ids.mapEmail }).direct)).toEqual(["REQ-103"]);
  });
});
