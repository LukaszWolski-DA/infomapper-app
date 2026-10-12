// Live label canvases and the active working context: the pure rules (slice 3b, step 1).

import { describe, expect, it } from "vitest";
import type { Write } from "../changes";
import { attribute, canvasItem, entity, ids, labelLink, mapping, mappingInput, relationship, sourceColumn, frame } from "../__fixtures__/domain";
import { cardHeightFor } from "./card-size";
import { contextTargets, liveCardHeight, liveMembership, liveRemoveQuestion, liveRemoveWhat, syncLiveCanvas, LIVE_ADD_GAP, type LiveModel } from "./live";

const CR = ids.labelCr23;
const other = "01900000-0000-7000-8000-00000000e001"; // a second source table
const colOther = "01900000-0000-7000-8000-00000000e002";
const mapCombined = "01900000-0000-7000-8000-00000000e003";

/** Customer (customer_id, email), Sales Order (order_id); crm.customer (cust_id, email, first_name), a second table. */
const base = (links: LiveModel["links"]): LiveModel => ({
  attributes: [attribute(ids.customerId), attribute(ids.email), attribute(ids.orderId)],
  sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName), sourceColumn(colOther, { source_table_id: other })],
  mappings: [mapping(), mapping({ id: mapCombined, attribute_id: ids.orderId })],
  mappingInputs: [mappingInput(), mappingInput(undefined, { mapping_id: mapCombined, source_column_id: ids.colFirstName }), mappingInput(undefined, { mapping_id: mapCombined, source_column_id: colOther })],
  links,
});

describe("liveMembership (PRD item 5)", () => {
  it("makes an entity full when the label is on it, context when only on an attribute or a mapping into it", () => {
    const m = liveMembership(CR, base([labelLink(ids.linkCustomer), labelLink(ids.linkMapping, { mapping_id: mapCombined })]));
    expect([...m.entities]).toEqual([
      [ids.customer, "full"],
      [ids.salesOrder, "context"],
    ]);
  });

  it("brings every input column's table of a combined mapping as context, and marks its rows relevant", () => {
    const m = liveMembership(CR, base([labelLink(ids.linkMapping, { mapping_id: mapCombined })]));
    expect([...m.tables]).toEqual([
      [ids.crmCustomer, "context"],
      [other, "context"],
    ]);
    expect([...m.relevantRows].sort()).toEqual([ids.orderId, ids.colFirstName, colOther].sort());
  });

  it("makes a table full when the label is on it, context when only on a column; full wins over context", () => {
    const m = liveMembership(CR, base([labelLink(ids.linkTable, { label_id: CR }), labelLink(ids.linkEmail, { attribute_id: null, source_column_id: ids.colEmail })]));
    expect([...m.tables]).toEqual([[ids.crmCustomer, "full"]]);
    expect([...m.relevantRows]).toEqual([ids.colEmail]);
  });

  it("ignores other labels and links on items no longer in the model", () => {
    const m = liveMembership(CR, base([labelLink(ids.linkTable), labelLink(ids.linkEmail, { attribute_id: "01900000-0000-7000-8000-00000000eeee" })]));
    expect([m.entities.size, m.tables.size, m.relevantRows.size]).toEqual([0, 0, 0]);
  });
});

describe("syncLiveCanvas (PRD item 7)", () => {
  const card = (id: string, over: Parameters<typeof canvasItem>[1]) => canvasItem(id, { live_level: "full", ...over });
  const height = () => 100;

  it("takes off cards no longer required, and changes level and filter (labeled ↔ all; other filters stay)", () => {
    const m = liveMembership(CR, base([labelLink(ids.linkEmail)]));
    const gone = card(ids.itemCrmCustomer, { entity_id: null, source_table_id: ids.crmCustomer });
    const customer = card(ids.itemCustomer, { row_filter: "all" });
    const sync = syncLiveCanvas([customer, gone], m, [], height);
    expect(sync.leave.map((i) => i.id)).toEqual([ids.itemCrmCustomer]);
    expect(sync.relevel).toEqual([{ item: customer, level: "context", rowFilter: "labeled" }]);
    expect(syncLiveCanvas([{ ...customer, row_filter: "keys" }], m, [], height).relevel[0]!.rowFilter).toBe("keys");
    const full = liveMembership(CR, base([labelLink(ids.linkCustomer)]));
    expect(syncLiveCanvas([{ ...customer, live_level: "context", row_filter: "labeled" }], full, [], height).relevel[0]).toMatchObject({ level: "full", rowFilter: "all" });
    expect(syncLiveCanvas([customer], full, [], height)).toEqual({ leave: [], relevel: [], add: [] });
  });

  it("puts new cards to the right of the content (cards and frames), one under another, tables first, never moving the rest", () => {
    const m = liveMembership(CR, base([labelLink(ids.linkMapping)]));
    const boxes = [
      { x: 0, y: 40, w: 256 },
      { x: 300, y: -16, w: 500, itemId: undefined },
    ];
    const sync = syncLiveCanvas([], m, boxes, (t) => (t.kind === "entity" ? 120 : 200));
    expect(sync.add).toEqual([
      { kind: "source_table", id: ids.crmCustomer, level: "context", x: 800 + LIVE_ADD_GAP.right, y: -16, rowFilter: "labeled" },
      { kind: "entity", id: ids.customer, level: "context", x: 800 + LIVE_ADD_GAP.right, y: 216, rowFilter: "labeled" },
    ]);
  });

  it("does not count a leaving card's box, and starts at 0, 0 on an empty canvas", () => {
    const m = liveMembership(CR, base([labelLink(ids.linkCustomer)]));
    const leaving = card(ids.itemCrmCustomer, { entity_id: null, source_table_id: ids.crmCustomer, x: 2000 });
    expect(syncLiveCanvas([leaving], m, [{ x: 2000, y: 0, w: 256, itemId: leaving.id }], height).add[0]).toMatchObject({ x: 0, y: 0 });
  });

  it("sizes a context card by its relevant rows, a full card by all rows", () => {
    const m = liveMembership(CR, base([labelLink(ids.linkEmail)]));
    expect(liveCardHeight([ids.customerId, ids.email], "labeled", m)).toBe(cardHeightFor(1));
    expect(liveCardHeight([ids.customerId, ids.email], "all", m)).toBe(cardHeightFor(2));
  });
});

describe("liveRemoveQuestion (PRD item 11)", () => {
  const links = [labelLink(ids.linkCustomer), labelLink(ids.linkEmail), labelLink(ids.linkMapping)];

  it("names a direct link and what keeps the card as context", () => {
    const q = liveRemoveQuestion(CR, { kind: "entity", id: ids.customer }, base(links));
    expect(q.direct?.id).toBe(ids.linkCustomer);
    expect([q.viaRows.map((k) => k.id), q.viaMappings.map((k) => k.id)]).toEqual([[ids.linkEmail], [ids.linkMapping]]);
    expect(liveRemoveWhat(q, "entity")).toBe("1 attribute and 1 mapping");
  });

  it("for a context table: its columns' links and the mappings that read its columns", () => {
    const q = liveRemoveQuestion(CR, { kind: "source_table", id: ids.crmCustomer }, base([...links, labelLink(ids.linkTable, { label_id: CR, source_table_id: null, source_column_id: ids.colCustId })]));
    expect(q.direct).toBeNull();
    expect(liveRemoveWhat(q, "source_table")).toBe("1 column and 1 mapping");
  });
});

describe("contextTargets (D-26, PRD item 2)", () => {
  const ins = <T extends Write["table"]>(table: T, row: unknown): Write => ({ kind: "insert", table, row }) as Write;
  const upd = <T extends Write["table"]>(table: T, before: unknown, row: unknown): Write => ({ kind: "update", table, before, row }) as Write;

  it("labels entities, attributes and mappings created or changed, a mapping whose inputs change, both entities of a relationship", () => {
    const writes = [
      ins("entity", entity()),
      upd("attribute", attribute(ids.email), { ...attribute(ids.email), name: "e_mail", version: 2 }),
      ins("mapping_input", mappingInput()),
      ins("relationship", relationship()),
      ins("canvas_item", canvasItem()),
      upd("frame", frame(), { ...frame(), x: 99 }),
    ];
    expect(contextTargets(writes)).toEqual([
      { kind: "entity", id: ids.customer },
      { kind: "attribute", id: ids.email },
      { kind: "mapping", id: ids.mapEmail },
      { kind: "entity", id: ids.salesOrder },
    ]);
  });

  it("skips attributes whose only change is their place in the order, except the moved one (Q2)", () => {
    const renumbered = (id: string, n: number) => upd("attribute", attribute(id), { ...attribute(id), sort_order: n, version: 2 });
    const writes = [renumbered(ids.customerId, 1), renumbered(ids.email, 0)];
    expect(contextTargets(writes)).toEqual([]);
    expect(contextTargets(writes, [{ kind: "attribute", id: ids.email }])).toEqual([{ kind: "attribute", id: ids.email }]);
  });

  it("labels nothing that is deleted, nor a version bump alone", () => {
    const writes = [
      upd("attribute", attribute(ids.email), { ...attribute(ids.email), deleted_at: "2026-10-12T10:00:00.000Z", version: 2 }),
      upd("mapping_input", mappingInput(), { ...mappingInput(), deleted_at: "2026-10-12T10:00:00.000Z", version: 2 }),
      upd("mapping", mapping(), { ...mapping(), deleted_at: "2026-10-12T10:00:00.000Z", version: 2 }),
      upd("attribute", attribute(ids.customerId), { ...attribute(ids.customerId), version: 2, updated_at: "2026-10-12T10:00:00.000Z" }),
      upd("relationship", relationship(), { ...relationship(), deleted_at: "2026-10-12T10:00:00.000Z", version: 2 }),
    ];
    expect(contextTargets(writes)).toEqual([]);
  });
});
