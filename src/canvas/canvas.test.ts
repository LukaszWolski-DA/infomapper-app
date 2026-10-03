import { describe, expect, it } from "vitest";
import {
  attribute,
  canvasItem,
  concept,
  entity,
  ids,
  mapping,
  mappingInput,
  NOW,
  relationship,
  sourceColumn,
  sourceSystem,
  sourceTable,
} from "@/domain/__fixtures__/domain";
import type { WorkspaceModel } from "@/domain/types";
import { buildCards, visibleRows, type CardData } from "./card-data";
import { cardHeight, contentBounds, fitViewport, zoomAround } from "./geometry";
import { splitName } from "./names";

// Customer (customer_id, email) and CRM customers (cust_id, email, first_name):
// email → email fits; first_name varchar(50) → customer_id integer is a type problem; a deleted mapping is ignored.
const firstNameMap = mapping({ id: "01900000-0000-7000-8000-00000000a002", attribute_id: ids.customerId, status: "draft" });
const model: WorkspaceModel = {
  concepts: [concept()],
  entities: [entity(ids.customer)],
  attributes: [attribute(ids.customerId), attribute(ids.email, { is_business_key: true })],
  relationships: [relationship()],
  sourceSystems: [sourceSystem()],
  sourceTables: [sourceTable()],
  sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
  mappings: [mapping(), firstNameMap],
  mappingInputs: [mappingInput(), mappingInput("01900000-0000-7000-8000-00000000b002", { mapping_id: firstNameMap.id, source_column_id: ids.colFirstName })],
};
const items = [
  canvasItem(ids.itemCustomer, { x: 400, y: 120 }),
  canvasItem(ids.itemCrmCustomer, { x: 40, y: 40, row_filter: "keys" }),
  canvasItem("01900000-0000-7000-8000-00000000c009", { entity_id: ids.salesOrder }), // not in the model: skipped
];
const cards = buildCards(model, items);
const card = (name: string): CardData => cards.find((c) => c.name === name)!;

describe("buildCards", () => {
  it("builds one card per placed element, sources first, skipping elements that are gone", () => {
    expect(cards.map((c) => `${c.kind}:${c.name}`)).toEqual(["src:customer", "ent:Customer"]);
  });

  it("gives an entity card its stereotype, concept, colour, coverage, position and rows", () => {
    expect(card("Customer")).toMatchObject({
      id: ids.itemCustomer,
      targetId: ids.customer,
      kind: "ent",
      line1: "Object",
      line1b: "in Customer",
      color: "#2F7DD1",
      mapped: 2,
      x: 400,
      y: 120,
      width: null,
      collapsed: false,
      rowFilter: "all",
      version: 1,
    });
    expect(card("Customer").rows).toEqual([
      { id: ids.customerId, name: "customer_id", type: "Integer", pk: true, fk: false, pii: false, bk: false, mappings: 1, warn: true, title: "from customer.first_name" },
      { id: ids.email, name: "email", type: "String(100)", pk: false, fk: false, pii: true, bk: true, mappings: 1, warn: false, title: "from customer.email" },
    ]);
  });

  it("gives a source card its path, physical types, BK badges and where each column goes", () => {
    expect(card("customer")).toMatchObject({ kind: "src", line1: "CRM / crmprod.dbo", line1b: "", color: null, mapped: 2, rowFilter: "keys" });
    expect(card("customer").rows).toMatchObject([
      { name: "cust_id", type: "int", pk: true, bk: true, mappings: 0, title: "Not used yet" },
      { name: "email", type: "varchar(100)", bk: false, mappings: 1, warn: false, title: "to Customer.email" },
      { name: "first_name", type: "varchar(50)", mappings: 1, warn: true, title: "to Customer.customer_id" },
    ]);
  });

  it("counts several mappings of one row in its dot", () => {
    const second = mapping({ id: "01900000-0000-7000-8000-00000000a003", attribute_id: ids.email });
    const more = {
      ...model,
      mappings: [...model.mappings, second],
      mappingInputs: [...model.mappingInputs, mappingInput("01900000-0000-7000-8000-00000000b003", { mapping_id: second.id, source_column_id: ids.colFirstName })],
    };
    const email = buildCards(more, items).find((c) => c.kind === "ent")!.rows[1]!;
    expect(email).toMatchObject({ mappings: 2, title: "from customer.email\nfrom customer.first_name" });
  });

  it("does not mark a transform with a rule as a type problem", () => {
    const ruled = { ...model, mappings: [mapping(), { ...firstNameMap, kind: "transform" as const, rule_expression: "TRY_CAST(first_name AS int)" }] };
    expect(buildCards(ruled, items).find((c) => c.kind === "ent")!.rows[0]!.warn).toBe(false);
  });

  it("shows a stored 'labeled' filter as All until labels exist", () => {
    expect(buildCards(model, [canvasItem(ids.itemCustomer, { row_filter: "labeled", deleted_at: null, updated_at: NOW })])[0]!.rowFilter).toBe("all");
  });
});

describe("row filters and collapse", () => {
  const customer = card("Customer");
  const source = card("customer");

  it("shows all, mapped, unmapped or key rows (keys include BK)", () => {
    expect(visibleRows({ ...source, rowFilter: "all" })).toHaveLength(3);
    expect(visibleRows({ ...source, rowFilter: "mapped" }).map((r) => r.name)).toEqual(["email", "first_name"]);
    expect(visibleRows({ ...source, rowFilter: "unmapped" }).map((r) => r.name)).toEqual(["cust_id"]);
    expect(visibleRows({ ...source, rowFilter: "keys" }).map((r) => r.name)).toEqual(["cust_id"]);
    expect(visibleRows({ ...customer, rowFilter: "keys" }).map((r) => r.name)).toEqual(["customer_id", "email"]);
  });

  it("shows no rows when collapsed, and the card is header-high", () => {
    expect(visibleRows({ ...customer, collapsed: true })).toEqual([]);
    expect(cardHeight({ ...customer, collapsed: true })).toBe(54);
    expect(cardHeight(customer)).toBe(54 + 12 + 2 * 26);
    // an empty filter result still leaves one line for the message
    expect(cardHeight({ ...customer, rowFilter: "unmapped" })).toBe(54 + 12 + 26);
  });
});

describe("view", () => {
  it("fits the cards with 40 px padding and keeps the overview clear", () => {
    const b = contentBounds(cards)!;
    expect(b).toEqual({ x: 40, y: 40, w: 400 + 256 - 40, h: 120 + cardHeight(card("Customer")) - 40 });
    const v = fitViewport(b, { width: 1200, height: 800 }, true);
    expect(v.zoom).toBeLessThanOrEqual(1.1);
    expect(v.x + b.x * v.zoom).toBeGreaterThanOrEqual(39.9);
    expect(v.x + (b.x + b.w) * v.zoom).toBeLessThanOrEqual(1200 - 250 + 0.1);
    expect(v.y + (b.y + b.h) * v.zoom).toBeLessThanOrEqual(800 - 40 + 0.1);
  });

  it("shrinks a large canvas to fit, down to 10 %", () => {
    const v = fitViewport({ x: 0, y: 0, w: 100_000, h: 100 }, { width: 1000, height: 800 }, false);
    expect(v.zoom).toBe(0.1);
  });

  it("never zooms an empty or tiny canvas beyond 110 %", () => {
    expect(fitViewport(null, { width: 1000, height: 800 }, true)).toEqual({ x: 40, y: 40, zoom: 1 });
    expect(fitViewport({ x: 0, y: 0, w: 10, h: 10 }, { width: 1000, height: 800 }, false).zoom).toBe(1.1);
  });

  it("zooms around the middle within 10–300 %", () => {
    const v = { x: 0, y: 0, zoom: 1 };
    expect(zoomAround(v, 10, { width: 1000, height: 800 }).zoom).toBe(3);
    expect(zoomAround(v, 0.01, { width: 1000, height: 800 }).zoom).toBe(0.1);
    const z = zoomAround(v, 2, { width: 1000, height: 800 });
    expect((500 - z.x) / z.zoom).toBeCloseTo(500);
    expect((400 - z.y) / z.zoom).toBeCloseTo(400);
  });
});

describe("middle truncation (D-37)", () => {
  it("keeps short names whole", () => {
    expect(splitName("customer_id")).toEqual({ head: "customer_id", tail: "" });
  });
  it("keeps the part after the last underscore", () => {
    expect(splitName("customer_address_line2")).toEqual({ head: "customer_address", tail: "_line2" });
  });
  it("keeps the last five characters when there is no short last part", () => {
    expect(splitName("averyveryverylongname")).toEqual({ head: "averyveryverylon", tail: "gname" });
    expect(splitName("customer_averyverylongpart")).toEqual({ head: "customer_averyverylon", tail: "gpart" });
  });
});
