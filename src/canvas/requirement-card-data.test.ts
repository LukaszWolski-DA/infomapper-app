import { describe, expect, it } from "vitest";
import { attribute, canvasItem, entity, ids, mapping, mappingInput, requirement, requirementLink, sourceColumn, sourceTable, T0 } from "@/domain/__fixtures__/domain";
import { buildRequirementIndex } from "@/domain/model/requirement-index";
import { barTitle, buildRequirementCards, coverageText, requirementCardHeight } from "./requirement-card-data";
import { barStops } from "./RequirementCardNode";

const model = {
  entities: [entity(ids.customer), entity(ids.salesOrder)],
  attributes: [attribute(ids.customerId), attribute(ids.email), attribute(ids.orderId)],
  // email's mapping is a draft: mapped but not approved
  mappings: [mapping()],
  mappingInputs: [mappingInput()],
  sourceTables: [sourceTable()],
  sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
};
const reqs = [
  requirement(ids.req101, { kind: "need", description_text: "x".repeat(400) }),
  requirement(ids.req102, { key: "REQ-102" }),
  requirement(ids.req103, { key: "REQ-103", deleted_at: T0 }),
];
const links = [
  requirementLink(ids.reqLink1, { requirement_id: ids.req101, attribute_id: ids.email }),
  requirementLink(ids.reqLink2, { requirement_id: ids.req101, attribute_id: ids.orderId }),
];
const index = buildRequirementIndex(reqs, links, model);
const card = (id: string, requirementId: string, over = {}) => canvasItem(id, { entity_id: null, requirement_id: requirementId, x: 80, y: 40, ...over });

describe("buildRequirementCards (slice 4b-2, items 1–2)", () => {
  it("draws the live cards of live requirements, with key, kind, status, the description's first 300 characters and the bar's parts", () => {
    const items = [
      card("01900000-0000-7000-8000-00000000c201", ids.req101),
      card("01900000-0000-7000-8000-00000000c202", ids.req102),
      // a deleted card, a card of a deleted requirement and an entity card are left out
      card("01900000-0000-7000-8000-00000000c203", ids.req102, { deleted_at: T0 }),
      card("01900000-0000-7000-8000-00000000c204", ids.req103),
      canvasItem(),
    ];
    const cards = buildRequirementCards(items, index);
    expect(cards.map((c) => c.requirementId)).toEqual([ids.req101, ids.req102]);
    expect(cards[0]).toMatchObject({ key: "REQ-101", kindName: "Business need", statusName: "Draft", total: 2, bar: { covered: 0, mapped: 1, notMapped: 1 }, x: 80, y: 40 });
    expect(cards[0]!.title).toHaveLength(300);
    expect(cards[1]).toMatchObject({ total: 0, bar: { covered: 0, mapped: 0, notMapped: 0 } });
  });

  it("says “{m} of {n} covered” or “nothing traced yet”, names the parts in the bar's tooltip, and puts the gradient's stops", () => {
    expect(coverageText({ bar: { covered: 1, mapped: 1, notMapped: 2 }, total: 4 })).toBe("1 of 4 covered");
    expect(coverageText({ bar: { covered: 0, mapped: 0, notMapped: 0 }, total: 0 })).toBe("nothing traced yet");
    expect(barTitle({ bar: { covered: 1, mapped: 1, notMapped: 2 } })).toBe("1 covered, 1 mapped but not approved, 2 not mapped");
    expect(barStops({ covered: 1, mapped: 1, notMapped: 2 }, 4)).toEqual([25, 50]);
    expect(barStops({ covered: 0, mapped: 0, notMapped: 0 }, 0)).toEqual([0, 0]);
  });

  it("is as high as its name's lines need (the prototype's 94 px for one line)", () => {
    expect(requirementCardHeight(1)).toBe(94);
    expect(requirementCardHeight(2)).toBe(111);
  });
});
