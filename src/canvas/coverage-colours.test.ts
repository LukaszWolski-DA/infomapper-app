import { describe, expect, it } from "vitest";
import { attribute, entity, ids, mapping, mappingInput, requirement, requirementLink, sourceColumn, sourceTable, T0 } from "@/domain/__fixtures__/domain";
import { buildRequirementIndex } from "@/domain/model/requirement-index";
import { coverageColours, NO_COLOURS } from "./coverage-colours";

// Customer (customer_id, email) and Sales Order (order_id); email ← CRM email, approved; the CRM table with three columns
const approved = { status: "approved" as const, approved_by: ids.someoneElse, approved_at: T0 };
const model = {
  entities: [entity(ids.customer), entity(ids.salesOrder)],
  attributes: [attribute(ids.customerId), attribute(ids.email), attribute(ids.orderId)],
  mappings: [mapping(approved)],
  mappingInputs: [mappingInput()],
  sourceTables: [sourceTable()],
  sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
};
const entityOf = (a: string) => model.attributes.find((x) => x.id === a)?.entity_id;
const tableOf = (c: string) => model.sourceColumns.find((x) => x.id === c)?.source_table_id;
const link = (id: string, over: object) => requirementLink(id, { requirement_id: ids.req101, attribute_id: null, ...over });
const colours = (links: ReturnType<typeof link>[]) => coverageColours(buildRequirementIndex([requirement(ids.req101)], links, model), ids.req101, entityOf, tableOf);

describe("coverage colours (slice 4b-1, PRD items 16–19)", () => {
  it("attribute items: covered blue, gaps orange; the card's summary orange when any item is a gap", () => {
    const c = colours([link(ids.reqLink1, { attribute_id: ids.email }), link(ids.reqLink2, { attribute_id: ids.customerId })]);
    expect(c.rows).toEqual(new Map([[ids.email, "covered"], [ids.customerId, "gap"]]));
    expect(c.headers.size).toBe(0);
    expect(c.summary).toEqual(new Map([[ids.customer, "gap"]]));
  });

  it("an entity item tints its header by its coverage (any attribute covered); its attributes are not coloured", () => {
    expect(colours([link(ids.reqLink1, { entity_id: ids.customer })])).toMatchObject({ rows: new Map(), headers: new Map([[ids.customer, "covered"]]), summary: new Map([[ids.customer, "covered"]]) });
    expect(colours([link(ids.reqLink1, { entity_id: ids.salesOrder })]).headers).toEqual(new Map([[ids.salesOrder, "gap"]]));
  });

  it("a linked column's row and a linked table's header are blue; a linked mapping's line is lit and its attribute coloured", () => {
    const c = colours([link(ids.reqLink1, { source_column_id: ids.colFirstName }), link(ids.reqLink2, { source_table_id: ids.crmCustomer }), link(ids.reqLink3, { mapping_id: ids.mapEmail })]);
    expect(c.rows).toEqual(new Map([[ids.email, "covered"], [ids.colFirstName, "covered"]]));
    expect(c.headers).toEqual(new Map([[ids.crmCustomer, "covered"]]));
    expect(c.mappings).toEqual(new Set([ids.mapEmail]));
    expect(c.summary).toEqual(new Map([[ids.customer, "covered"], [ids.crmCustomer, "covered"]]));
  });

  it("nothing without a selected requirement, an unknown one or an index", () => {
    const index = buildRequirementIndex([requirement(ids.req101)], [], model);
    expect(coverageColours(index, null, entityOf, tableOf)).toBe(NO_COLOURS);
    expect(coverageColours(index, ids.req102, entityOf, tableOf)).toBe(NO_COLOURS);
    expect(coverageColours(null, ids.req101, entityOf, tableOf)).toBe(NO_COLOURS);
  });
});
