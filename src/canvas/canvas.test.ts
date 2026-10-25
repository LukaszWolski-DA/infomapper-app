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
import type { SourceChange, WorkspaceModel } from "@/domain/types";
import { buildCards, visibleRows, type CardData } from "./card-data";
import { besideAnchor, besideSpots, cardHeight, contentBounds, EDGE_SPEED, edgePush, fitViewport, freeSpot, newCardHeight, stackSpot, zoomAround } from "./geometry";
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
  sourceRelationships: [],
  sourceRelationshipColumns: [],
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
      { id: ids.customerId, name: "customer_id", type: "Integer", pk: true, fk: false, pii: false, bk: false, mappings: 1, warn: true, title: "from customer.first_name", clip: false, labels: null },
      { id: ids.email, name: "email", type: "String(100)", pk: false, fk: false, pii: true, bk: true, mappings: 1, warn: false, title: "from customer.email", clip: false, labels: null },
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

  it("shows a stored 'labeled' filter as All outside a live canvas", () => {
    expect(buildCards(model, [canvasItem(ids.itemCustomer, { row_filter: "labeled", deleted_at: null, updated_at: NOW })])[0]!.rowFilter).toBe("all");
  });

  it("on a live canvas (slice 3b): the level, a context card's line and tooltip, relevant rows, the Labeled filter, the remove question", () => {
    const live = {
      labelName: "CR-23",
      relevantRows: new Set([ids.email]),
      removeOf: () => ({ direct: false, what: "1 attribute", others: 1 }),
    };
    const [card] = buildCards(model, [canvasItem(ids.itemCustomer, { row_filter: "labeled", live_level: "context" })], undefined, live);
    expect(card).toMatchObject({
      liveLevel: "context",
      rowFilter: "labeled",
      line1b: "context only",
      liveTitle: "Context: the entity itself is not labeled CR-23, only some of its attributes are",
      liveRemove: { direct: false, what: "1 attribute", others: 1 },
    });
    expect(card!.rows.map((r) => [r.name, r.relevant])).toEqual([
      ["customer_id", false],
      ["email", true],
    ]);
    expect(visibleRows(card!).map((r) => r.id)).toEqual([ids.email]);
    const full = buildCards(model, [canvasItem(ids.itemCustomer, { live_level: "full" })], undefined, live)[0]!;
    expect([full.liveLevel, full.liveTitle, full.line1b.startsWith("in ")]).toEqual(["full", null, true]);
    expect(buildCards(model, [canvasItem(ids.itemCustomer, { live_level: "full" })])[0]!.liveLevel).toBeNull();
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

describe("placing new cards (prototype placeNear, createEntity)", () => {
  const view = { x: 0, y: 0, w: 1000, h: 600 };

  it("a clicked item lands in the middle of the view, 80 px down, below any card in the way", () => {
    expect(stackSpot(view, [], 200)).toEqual({ x: 376, y: 80 });
    const spot = stackSpot(view, [{ x: 300, y: 50, w: 256, h: 300 }], 200);
    expect(spot.x).toBe(376);
    expect(spot.y).toBeGreaterThanOrEqual(50 + 300 + 24);
  });

  it("a new entity lands a third down the middle of the view, or on the nearest free ring (D-46)", () => {
    expect(freeSpot(view, [])).toEqual({ x: 376, y: 200 });
    const taken = { x: 372, y: 200, w: 256, h: 140 };
    const spot = freeSpot(view, [taken]);
    expect(spot).not.toEqual({ x: 376, y: 200 });
    const clear = spot.x >= taken.x + taken.w + 24 || spot.x + 256 + 24 <= taken.x || spot.y >= taken.y + taken.h + 24 || spot.y + 140 + 24 <= taken.y;
    expect(clear).toBe(true);
    expect(spot.x % 8 + spot.y % 8).toBe(0);
  });

  it("places feeding sources left of a card and fed entities right of it, without overlaps (B-08)", () => {
    const anchor = { x: 1000, y: 200, w: 256, h: 300 };
    const inTheWay = { x: 584, y: 180, w: 256, h: 200 };
    const spots = besideSpots(anchor, "left", [150, 150, 150], [anchor, inTheWay]);
    expect(spots.every((s) => s.x === 1000 - 256 - 160)).toBe(true);
    const boxes = [anchor, inTheWay, ...spots.map((s) => ({ ...s, w: 256, h: 150 }))];
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
    }
    expect(spots[0]!.y).toBeGreaterThanOrEqual(180 + 200 + 24);
    expect(besideSpots(anchor, "right", [150], [anchor])).toEqual([{ x: 1000 + 256 + 160, y: 200 }]);
  });

  it("places cards beside the block of a collapsed frame when the card is hidden in it, never on the block (slice 2c, decision (ii))", () => {
    const hidden = { x: 1400, y: 600, w: 256, h: 300 }; // its stored place, inside the frame's expanded area
    const block = { x: 1000, y: 200, w: 280, h: 140 };
    expect(besideAnchor(hidden, null)).toBe(hidden);
    const a = besideAnchor(hidden, block);
    expect(a).toBe(block);
    const right = besideSpots(a, "right", [150, 150], [block]);
    expect(right[0]).toEqual({ x: 1000 + 280 + 160, y: 200 });
    const left = besideSpots(a, "left", [150], [block]);
    expect(left[0]).toEqual({ x: 1000 - 256 - 160, y: 200 });
    for (const s of [...right, ...left]) expect(s.x + 256 <= block.x || s.x >= block.x + block.w).toBe(true);
  });

  it("sizes a new card by its rows", () => {
    expect(newCardHeight(0)).toBe(54 + 12 + 26);
    expect(newCardHeight(3)).toBe(54 + 12 + 78);
  });
});

describe("auto-scroll while dragging (edgePush)", () => {
  const box = { left: 100, top: 50, right: 900, bottom: 650 };

  it("does nothing away from the edges", () => {
    expect(edgePush({ x: 500, y: 300 }, box)).toEqual({ x: 0, y: 0 });
    expect(edgePush({ x: 156, y: 106 }, box)).toEqual({ x: 0, y: 0 });
  });

  it("moves the content in from the side the pointer is near, faster closer to the edge", () => {
    expect(edgePush({ x: 100, y: 300 }, box)).toEqual({ x: EDGE_SPEED, y: 0 });
    expect(edgePush({ x: 900, y: 650 }, box)).toEqual({ x: -EDGE_SPEED, y: -EDGE_SPEED });
    const near = edgePush({ x: 128, y: 300 }, box).x;
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(EDGE_SPEED);
    expect(edgePush({ x: 80, y: 300 }, box).x).toBeGreaterThan(EDGE_SPEED);
  });
});

describe("buildCards: source changes (slice 7b, item 24)", () => {
  const change = (kind: SourceChange["kind"], columnId: string, status: SourceChange["status"] = "open"): SourceChange => ({
    id: `01900000-0000-7000-8000-0000000d${columnId.slice(-4)}${kind.length}`,
    workspace_id: ids.ws,
    version: 1,
    created_at: NOW,
    created_by: ids.someoneElse,
    updated_at: NOW,
    updated_by: ids.someoneElse,
    deleted_at: null,
    source_system_id: ids.crm,
    source_import_id: ids.crm,
    kind,
    severity: "normal",
    status,
    source_table_id: ids.crmCustomer,
    source_column_id: columnId,
    mapping_id: null,
    object_label: "dbo.customer.x",
    detail: "",
    resolution: status === "resolved" ? "Noted" : null,
    resolved_by: status === "resolved" ? ids.someoneElse : null,
    resolved_at: status === "resolved" ? NOW : null,
  });
  const rows = (m: WorkspaceModel, changes: SourceChange[]) => buildCards(m, items, undefined, null, changes).find((c) => c.kind === "src")!.rows;

  it("marks a retired column old (over missing), an open new column new, another open change chg; resolved changes mark nothing", () => {
    const retired = { ...model, sourceColumns: model.sourceColumns.map((c) => (c.id === ids.colEmail ? { ...c, missing_since: NOW, retired_since: NOW } : c)) };
    const r = rows(retired, [change("new_column", ids.colCustId), change("column_left", ids.colEmail), change("type_conflict", ids.colFirstName), change("new_column", ids.colFirstName)]);
    expect(r.map((x) => [x.name, x.retired ?? false, x.missing ?? false, x.change ?? null])).toEqual([
      ["cust_id", false, false, "new"],
      ["email", true, false, null],
      ["first_name", false, false, "chg"],
    ]);
    expect(rows(model, [change("new_column", ids.colCustId, "resolved")]).every((x) => !x.change)).toBe(true);
  });

  it("takes type problems only through live inputs: a retired input is historical (Q10)", () => {
    const retired = { ...model, sourceColumns: model.sourceColumns.map((c) => (c.id === ids.colFirstName ? { ...c, missing_since: NOW, retired_since: NOW } : c)) };
    expect(buildCards(model, items).find((c) => c.kind === "ent")!.rows[0]!.warn).toBe(true);
    expect(buildCards(retired, items).find((c) => c.kind === "ent")!.rows[0]!.warn).toBe(false);
  });
});
