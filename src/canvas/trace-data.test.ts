import { describe, expect, it } from "vitest";
import { ids, requirementLink, T0 } from "@/domain/__fixtures__/domain";
import { blockRowY, nearerSide, nearestOn, traceGeom } from "./line-geometry";
import { buildTraces } from "./trace-data";
import type { Placed } from "./geometry";

const reqCard = "01900000-0000-7000-8000-00000000c201";
const lookup = {
  cardOf: (kind: "ent" | "src", id: string) => (kind === "ent" && id === ids.customer ? "card-customer" : kind === "src" && id === ids.crmCustomer ? "card-crm" : undefined),
  entityOf: (id: string) => (id === ids.email ? ids.customer : id === ids.orderId ? ids.salesOrder : undefined),
  tableOf: (id: string) => (id === ids.colEmail ? ids.crmCustomer : undefined),
  hasMapping: (id: string) => id === ids.mapEmail,
};

describe("buildTraces (slice 4b-2, item 8)", () => {
  it("one line per direct link to an element on this canvas: a card, a row or a mapping; none to an element off the canvas", () => {
    const links = [
      requirementLink("01900000-0000-7000-8000-00000000e301", { requirement_id: ids.req101, attribute_id: null, entity_id: ids.customer }),
      requirementLink("01900000-0000-7000-8000-00000000e302", { requirement_id: ids.req101, attribute_id: ids.email }),
      requirementLink("01900000-0000-7000-8000-00000000e303", { requirement_id: ids.req101, attribute_id: null, source_column_id: ids.colEmail }),
      requirementLink("01900000-0000-7000-8000-00000000e304", { requirement_id: ids.req101, attribute_id: null, mapping_id: ids.mapEmail }),
      requirementLink("01900000-0000-7000-8000-00000000e305", { requirement_id: ids.req101, attribute_id: null, source_table_id: ids.crmCustomer }),
      // Sales Order's card is not here; a deleted link counts for nothing
      requirementLink("01900000-0000-7000-8000-00000000e306", { requirement_id: ids.req101, attribute_id: ids.orderId }),
      requirementLink("01900000-0000-7000-8000-00000000e307", { requirement_id: ids.req101, attribute_id: null, entity_id: ids.customer, deleted_at: T0 }),
    ];
    const traces = buildTraces([{ id: reqCard, requirementId: ids.req101 }], () => links, lookup);
    expect(traces.map((t) => t.target)).toEqual([
      { t: "card", cardId: "card-customer" },
      { t: "row", cardId: "card-customer", rowId: ids.email },
      { t: "row", cardId: "card-crm", rowId: ids.colEmail },
      { t: "map", mappingId: ids.mapEmail },
      { t: "card", cardId: "card-crm" },
    ]);
    expect(traces[0]!.id).toBe(`${reqCard}|01900000-0000-7000-8000-00000000e301`);
  });
});

describe("traceGeom (slice 4b-2, items 8–9)", () => {
  const req = { x: 800, y: 0, w: 230, h: 94 };
  const customer: Placed = {
    x: 100,
    y: 100,
    card: { width: null, collapsed: false, rowFilter: "all", rows: [{ id: "r1" }, { id: "r2" }] as Placed["card"]["rows"] },
  };
  const placeOf = (id: string) => (id === "card-customer" ? { placed: customer } : id === "hidden" ? { block: { x: 1200, y: 400, w: 280, h: 300 }, index: 8 } : null);

  it("ends at the nearer side of a card at the header's middle, and starts at the requirement card's nearest point", () => {
    // the requirement card is right of Customer: the line ends at Customer's right edge (100 + 256)
    expect(traceGeom(req, { t: "card", cardId: "card-customer" }, placeOf, () => null)).toEqual({ x1: 800, y1: 94, x2: 356, y2: 127 });
  });

  it("ends at a row's height; at the mapping's middle; at a hidden card's row in its block, past the sixth at “and N more”", () => {
    expect(traceGeom(req, { t: "row", cardId: "card-customer", rowId: "r2" }, placeOf, () => null)).toMatchObject({ x2: 356, y2: 100 + 54 + 6 + 26 + 13 });
    expect(traceGeom(req, { t: "map", mappingId: "m" }, placeOf, () => ({ x: 500, y: 300 }))).toEqual({ x1: 800, y1: 94, x2: 500, y2: 300 });
    // the block is right of the requirement card: its left edge; row 8 shows as the seventh, “and N more”
    expect(traceGeom(req, { t: "card", cardId: "hidden" }, placeOf, () => null)).toMatchObject({ x2: 1200, y2: blockRowY({ y: 400 }, 6) });
  });

  it("draws nothing to an element or a requirement card that is not on the canvas", () => {
    expect(traceGeom(req, { t: "card", cardId: "elsewhere" }, placeOf, () => null)).toBeNull();
    expect(traceGeom(null, { t: "card", cardId: "card-customer" }, placeOf, () => null)).toBeNull();
    expect(traceGeom(req, { t: "map", mappingId: "m" }, placeOf, () => null)).toBeNull();
  });

  it("nearerSide and nearestOn", () => {
    expect(nearerSide({ x: 0, y: 0, w: 100, h: 10 }, { x: 500, y: 0, w: 200, h: 10 })).toBe(500);
    expect(nearerSide({ x: 900, y: 0, w: 100, h: 10 }, { x: 500, y: 0, w: 200, h: 10 })).toBe(700);
    expect(nearestOn({ x: 0, y: 0, w: 100, h: 50 }, { x: 300, y: 20 })).toEqual({ x: 100, y: 20 });
    expect(nearestOn({ x: 0, y: 0, w: 100, h: 50 }, { x: 50, y: -40 })).toEqual({ x: 50, y: 0 });
  });
});
