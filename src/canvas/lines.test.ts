import { describe, expect, it } from "vitest";
import {
  attribute,
  canvasItem,
  concept,
  entity,
  ids,
  mapping,
  mappingInput,
  relationship,
  sourceColumn,
  sourceSystem,
  sourceTable,
} from "@/domain/__fixtures__/domain";
import type { WorkspaceModel } from "@/domain/types";
import { buildCards } from "./card-data";
import { curve, fNode, ieMarker, multText, relGeom, rowEnd, umlMarker, type Placed } from "./geometry";
import { buildLines, relatedLines } from "./line-data";

// Customer (customer_id, email) and Sales Order on the canvas, CRM customer as the source.
// email ← email (direct, approved); customer_id ← cust_id + first_name (combined transform, D-49).
const combined = mapping({ id: "01900000-0000-7000-8000-00000000a002", attribute_id: ids.customerId, kind: "transform", rule_expression: "CONCAT(a, b)", status: "review" });
const model: WorkspaceModel = {
  concepts: [concept(ids.conceptCustomer), concept(ids.conceptSales)],
  entities: [entity(ids.customer), entity(ids.salesOrder)],
  attributes: [attribute(ids.customerId), attribute(ids.email), attribute(ids.orderId)],
  relationships: [relationship(), relationship({ id: "01900000-0000-7000-8000-000000006002", label: "pays for" })],
  sourceSystems: [sourceSystem()],
  sourceTables: [sourceTable()],
  sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
  mappings: [mapping({ status: "approved", approved_at: "2026-10-01T00:00:00.000Z" }), combined],
  mappingInputs: [
    mappingInput(),
    mappingInput("01900000-0000-7000-8000-00000000b002", { mapping_id: combined.id, source_column_id: ids.colFirstName, sort_order: 1 }),
    mappingInput("01900000-0000-7000-8000-00000000b003", { mapping_id: combined.id, source_column_id: ids.colCustId, sort_order: 0 }),
  ],
};
const orderCard = "01900000-0000-7000-8000-00000000c003";
const items = [
  canvasItem(ids.itemCustomer, { x: 400, y: 0 }),
  canvasItem(ids.itemCrmCustomer, { x: 0, y: 0 }),
  canvasItem(orderCard, { entity_id: ids.salesOrder, x: 400, y: 400 }),
];
const cards = buildCards(model, items);
const lines = buildLines(model, cards);

describe("buildLines", () => {
  it("draws a mapping from each input on the canvas to the attribute's card", () => {
    expect(lines.mappings).toEqual([
      { id: ids.mapEmail, status: "approved", kind: "direct", ruled: false, warn: false, inputs: [{ columnId: ids.colEmail, cardId: ids.itemCrmCustomer }], inputCount: 1, attributeId: ids.email, cardId: ids.itemCustomer },
      {
        id: combined.id,
        status: "review",
        kind: "transform",
        ruled: true,
        warn: false,
        // in rule order
        inputs: [
          { columnId: ids.colCustId, cardId: ids.itemCrmCustomer },
          { columnId: ids.colFirstName, cardId: ids.itemCrmCustomer },
        ],
        inputCount: 2,
        attributeId: ids.customerId,
        cardId: ids.itemCustomer,
      },
    ]);
  });

  it("leaves out mappings whose attribute card or every input card is not on the canvas", () => {
    expect(buildLines(model, cards.filter((c) => c.kind === "ent")).mappings).toEqual([]);
    expect(buildLines(model, cards.filter((c) => c.id !== ids.itemCustomer)).mappings).toEqual([]);
  });

  it("offsets parallel relationships between the same entities by 16 px", () => {
    expect(lines.relationships.map((r) => [r.label, r.fromCardId, r.toCardId, r.offset])).toEqual([
      ["places", ids.itemCustomer, orderCard, 0],
      ["pays for", ids.itemCustomer, orderCard, 16],
    ]);
  });

  it("leaves out relationships to entities that are not on the canvas", () => {
    expect(buildLines(model, cards.filter((c) => c.id !== orderCard)).relationships).toEqual([]);
  });
});

describe("relatedLines (selection emphasis)", () => {
  const ids_ = (r: ReturnType<typeof relatedLines>) => r && { maps: [...r.maps].sort(), rels: [...r.rels].sort() };

  it("nothing selected: nothing fades", () => {
    expect(relatedLines(null, lines)).toBeNull();
  });
  it("a line: itself", () => {
    expect(ids_(relatedLines({ t: "map", id: combined.id }, lines))).toEqual({ maps: [combined.id], rels: [] });
    expect(ids_(relatedLines({ t: "rel", id: ids.relPlaces }, lines))).toEqual({ maps: [], rels: [ids.relPlaces] });
  });
  it("a row: the mappings it feeds or is fed by", () => {
    expect(ids_(relatedLines({ t: "row", cardId: ids.itemCrmCustomer, id: ids.colFirstName }, lines))).toEqual({ maps: [combined.id], rels: [] });
    expect(ids_(relatedLines({ t: "row", cardId: ids.itemCustomer, id: ids.email }, lines))).toEqual({ maps: [ids.mapEmail], rels: [] });
  });
  it("a card: nothing fades (card emphasis is Focus mode, a later slice)", () => {
    expect(relatedLines({ t: "card", id: ids.itemCustomer }, lines)).toBeNull();
    expect(relatedLines({ t: "card", id: ids.itemCrmCustomer }, lines)).toBeNull();
  });
});

describe("line geometry", () => {
  const customer: Placed = { x: 400, y: 0, card: cards.find((c) => c.id === ids.itemCustomer)! };
  const source: Placed = { x: 0, y: 0, card: cards.find((c) => c.id === ids.itemCrmCustomer)! };

  it("anchors a row at its middle, and a hidden row at the header (S1A-04)", () => {
    expect(rowEnd(customer, ids.email)).toEqual({ x: 400, w: 256, y: 54 + 6 + 26 + 13, cx: 528, hidden: false });
    expect(rowEnd({ ...customer, card: { ...customer.card, collapsed: true } }, ids.email)).toMatchObject({ y: 27, hidden: true });
    // email is not a key: the Keys filter hides it; customer_id stays first
    expect(rowEnd({ ...customer, card: { ...customer.card, rowFilter: "keys" } }, ids.email)).toMatchObject({ y: 27, hidden: true });
    expect(rowEnd({ ...customer, card: { ...customer.card, rowFilter: "keys" } }, ids.customerId)).toMatchObject({ y: 54 + 6 + 13, hidden: false });
  });

  it("leaves and enters on the facing sides (S1A-02)", () => {
    const g = curve(rowEnd(source, ids.colEmail), rowEnd(customer, ids.email));
    expect(g.p0).toEqual({ x: 256, y: 54 + 6 + 26 + 13 });
    expect(g.p3).toEqual({ x: 400, y: 99 });
    const back = curve(rowEnd(customer, ids.email), rowEnd(source, ids.colEmail));
    expect(back.p0.x).toBe(400);
    expect(back.p3.x).toBe(256);
  });

  it("puts the ƒ node beside the attribute on the side of its inputs (D-49)", () => {
    const attr = rowEnd(customer, ids.customerId);
    const f = fNode(attr, [rowEnd(source, ids.colCustId), rowEnd(source, ids.colFirstName)]);
    expect(f.node).toEqual({ x: 400 - 36, y: attr.y });
    expect(f.out).toBe(`M364,${attr.y} L400,${attr.y}`);
    const right = fNode(attr, [{ x: 900, w: 256, y: 10, cx: 1028, hidden: false }]);
    expect(right.node.x).toBe(400 + 256 + 36);
  });

  it("joins relationships side to side when apart, top to bottom when stacked, with the offset", () => {
    expect(relGeom({ x: 0, y: 0, w: 100, h: 100 }, { x: 300, y: 0, w: 100, h: 100 }, 0)).toMatchObject({ pa: { x: 100, y: 27 }, pb: { x: 300, y: 27 } });
    expect(relGeom({ x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 300, w: 100, h: 100 }, 16)).toMatchObject({ pa: { x: 66, y: 100 }, pb: { x: 66, y: 300 } });
  });

  it("draws crow's foot and UML ends (S1A-06)", () => {
    expect(ieMarker({ x: 0, y: 0 }, { x: 1, y: 0 }, 0, "n").circle).toEqual({ x: 22, y: 0 });
    expect(ieMarker({ x: 0, y: 0 }, { x: 1, y: 0 }, 1, "1").circle).toBeNull();
    expect([multText(0, "1"), multText(1, "1"), multText(0, "n"), multText(1, "n")]).toEqual(["0..1", "1", "0..*", "1..*"]);
    expect(umlMarker({ x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ x: 16, y: 11 });
  });
});
