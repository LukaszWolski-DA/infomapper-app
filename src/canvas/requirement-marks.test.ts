import { describe, expect, it } from "vitest";
import { attribute, entity, ids, mapping, mappingInput, requirement, requirementLink, sourceColumn, sourceTable } from "@/domain/__fixtures__/domain";
import { buildRequirementIndex } from "@/domain/model/requirement-index";
import { requirementMarks, sameMark } from "./requirement-marks";

const model = {
  entities: [entity(ids.customer), entity(ids.salesOrder)],
  attributes: [attribute(ids.customerId), attribute(ids.email), attribute(ids.orderId)],
  mappings: [mapping()],
  mappingInputs: [mappingInput()],
  sourceTables: [sourceTable()],
  sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
};
const reqs = [requirement(ids.req101, { name: "Single view" }), requirement(ids.req102, { name: "Contact data" }), requirement(ids.req103, { name: "Unique e-mail" })];
const links = [
  requirementLink(ids.reqLink1, { requirement_id: ids.req101, attribute_id: null, entity_id: ids.customer }),
  requirementLink(ids.reqLink2, { requirement_id: ids.req102, attribute_id: ids.email }),
  requirementLink(ids.reqLink3, { requirement_id: ids.req103, attribute_id: null, mapping_id: ids.mapEmail }),
];
const cards = [
  { id: "c-customer", kind: "ent" as const, targetId: ids.customer },
  { id: "c-sales", kind: "ent" as const, targetId: ids.salesOrder },
  { id: "c-crm", kind: "src" as const, targetId: ids.crmCustomer },
];

describe("requirement markers on cards (slice 4b-1, PRD item 14)", () => {
  it("counts what the card's panel lists, direct and indirect, with the prototype's tooltip", () => {
    const marks = requirementMarks(buildRequirementIndex(reqs, links, model), cards);
    // Customer: REQ-101 directly, REQ-102 via attribute, REQ-103 via mapping
    expect(marks.get("c-customer")).toEqual({ n: 3, title: "Requirements: REQ-101 Single view\nREQ-102 Contact data\nREQ-103 Unique e-mail" });
    // the CRM table: REQ-103, whose mapping reads its column
    expect(marks.get("c-crm")).toEqual({ n: 1, title: "Requirements: REQ-103 Unique e-mail" });
  });

  it("gives no marker to a card without requirements, and none without an index", () => {
    expect(requirementMarks(buildRequirementIndex(reqs, links, model), cards).has("c-sales")).toBe(false);
    expect(requirementMarks(null, cards).size).toBe(0);
  });

  it("compares markers by what they draw", () => {
    expect(sameMark({ n: 1, title: "a" }, { n: 1, title: "a" })).toBe(true);
    expect(sameMark({ n: 1, title: "a" }, undefined)).toBe(false);
    expect(sameMark(undefined, undefined)).toBe(true);
  });
});
