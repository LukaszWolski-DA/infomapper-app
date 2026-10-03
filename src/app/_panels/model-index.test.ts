import { describe, expect, it } from "vitest";
import {
  attribute,
  concept,
  entity,
  ids,
  mapping,
  mappingInput,
  sourceColumn,
  sourceSystem,
  sourceTable,
} from "@/domain/__fixtures__/domain";
import type { WorkspaceModel } from "@/domain/types";
import { attributeLabel, businessKeyHint, columnLabel, columnOptions, feedingSources, indexModel, inputsLabel, typeCheckOf } from "./model-index";

// Customer.email ← customer.email (fits); Customer.customer_id ← customer.cust_id (BK column) and customer.first_name
// as a transform without a rule: first_name varchar(50) does not fit integer.
const idMap = "01900000-0000-7000-8000-00000000a002";
const otherTable = "01900000-0000-7000-8000-000000008002";
const model: WorkspaceModel = {
  concepts: [concept()],
  entities: [entity(ids.customer)],
  attributes: [attribute(ids.customerId), attribute(ids.email)],
  relationships: [],
  sourceSystems: [sourceSystem()],
  sourceTables: [sourceTable({ id: otherTable, name: "orders" }), sourceTable()],
  sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
  mappings: [mapping(), mapping({ id: idMap, attribute_id: ids.customerId, kind: "transform", rule_expression: null })],
  mappingInputs: [
    mappingInput(),
    mappingInput("01900000-0000-7000-8000-00000000b003", { mapping_id: idMap, source_column_id: ids.colFirstName, sort_order: 1 }),
    mappingInput("01900000-0000-7000-8000-00000000b002", { mapping_id: idMap, source_column_id: ids.colCustId, sort_order: 0 }),
  ],
};
const ix = indexModel(model);

describe("the panel's model index", () => {
  it("labels columns, attributes and a mapping's inputs in their order", () => {
    expect(columnLabel(ix, ids.colEmail)).toBe("customer.email");
    expect(attributeLabel(ix, ids.customerId)).toBe("Customer.customer_id");
    expect(inputsLabel(ix, idMap)).toBe("customer.cust_id, customer.first_name");
  });

  it("type-checks a mapping from its inputs (D-01)", () => {
    expect(typeCheckOf(ix, model.mappings[0]!).ok).toBe(true);
    const verdict = typeCheckOf(ix, model.mappings[1]!);
    expect(verdict.ok).toBe(false);
    expect(verdict.message).toContain("varchar(50) does not fit integer");
    expect(typeCheckOf(ix, { ...model.mappings[1]!, rule_expression: "CAST(cust_id AS int)" }).ok).toBe(true);
  });

  it("suggests the business key from a BK input column, until the attribute has it (AD-28)", () => {
    expect(businessKeyHint(ix, ix.attribute.get(ids.customerId)!).map((c) => c.name)).toEqual(["cust_id"]);
    expect(businessKeyHint(ix, { ...ix.attribute.get(ids.customerId)!, is_business_key: true })).toEqual([]);
    expect(businessKeyHint(ix, ix.attribute.get(ids.email)!)).toEqual([]);
  });

  it("counts the mappings each source table feeds into an entity", () => {
    expect(feedingSources(ix, ids.customer).map((f) => [f.table.name, f.mappings])).toEqual([["customer", 2]]);
  });

  it("offers columns of tables on this canvas first, and leaves out excluded ones", () => {
    const groups = columnOptions(ix, new Set([ids.crmCustomer]), new Set([ids.colEmail]));
    expect(groups.map((g) => g.label)).toEqual(["CRM / customer"]);
    expect(groups[0]!.columns.map((c) => c.label)).toEqual(["cust_id  int", "first_name  varchar(50)"]);
  });
});
