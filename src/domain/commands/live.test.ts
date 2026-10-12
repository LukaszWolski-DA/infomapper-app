// Live label canvases and the active working context: the write step and the commands (slice 3b, step 1).

import { describe, expect, it } from "vitest";
import { buildWriteSet, type Write } from "../changes";
import {
  access,
  attribute,
  canvas,
  canvasItem,
  concept,
  entity,
  ids,
  label,
  labelLink,
  link,
  makeCtx,
  mapping,
  mappingInput,
  note,
  project,
  sourceColumn,
  sourceSystem,
  sourceTable,
} from "../__fixtures__/domain";
import { CONTEXT_LABEL_GONE, LIVE_ONE_AT_A_TIME, LIVE_REMOVE_UNLABELS } from "../model/live";
import { reorderAttribute } from "./attribute";
import { removeCanvasItems, removeFromCanvas, placeManyOnCanvas, updateCanvasItem } from "./canvas-item";
import { duplicateCanvas } from "./canvas";
import { deleteLabel, renameLabel } from "./label";
import { afterWrites, completeLiveWrites, openLiveCanvas, removeFromLiveCanvas, touchesLiveCanvases, type LiveWriteState } from "./live";

const CR = ids.labelCr23;
const LIVE = ids.canvas2;
const owner = access("owner");

/** Customer (customer_id, email) in Customer, Sales Order (order_id) in Sales; crm.customer (cust_id, email, first_name). */
const state = (over: Partial<LiveWriteState> = {}): LiveWriteState => ({
  entities: [entity(), entity(ids.salesOrder)],
  attributes: [attribute(ids.customerId), attribute(ids.email), attribute(ids.orderId)],
  sourceTables: [sourceTable()],
  sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
  mappings: [mapping()],
  mappingInputs: [mappingInput()],
  concepts: [concept(), concept(ids.conceptSales, { name: "Sales" })],
  sourceSystems: [sourceSystem()],
  labels: [label(), label(ids.labelJira)],
  labelLinks: [labelLink(ids.linkCustomer)],
  canvases: [canvas(), canvas(LIVE, { name: "CR-23", live_label_id: CR })],
  canvasItems: [canvasItem(), canvasItem("01900000-0000-7000-8000-00000000c101", { canvas_id: LIVE, entity_id: ids.customer, live_level: "full", x: 40, y: 40 })],
  frames: [],
  notes: [],
  ...over,
});
const liveItems = (s: LiveWriteState) => s.canvasItems.filter((i) => i.canvas_id === LIVE && i.deleted_at === null);
const ws = (writes: Write[]) => buildWriteSet(makeCtx(), ids.ws, writes);

describe("completeLiveWrites: the active working context (D-26)", () => {
  const renamed: Write = { kind: "update", table: "attribute", before: attribute(ids.email), row: { ...attribute(ids.email), name: "e_mail", version: 2 } };

  it("links the label to what the action changed, in the same change group, with the label on every event", () => {
    const r = completeLiveWrites(makeCtx(), owner, state(), ws([renamed]), { contextLabelId: ids.labelJira });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.labeled).toBe(1);
    const added = r.writeSet.writes.filter((w) => w.table === "label_link");
    expect(added).toMatchObject([{ kind: "insert", row: { label_id: ids.labelJira, attribute_id: ids.email } }]);
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id))).toEqual(new Set([r.writeSet.changeGroupId]));
    expect(r.writeSet.events.every((e) => e.context_label_id === ids.labelJira)).toBe(true);
  });

  it("adds no second link to an item that already carries the label, but still records the context", () => {
    const r = completeLiveWrites(makeCtx(), owner, state({ labelLinks: [labelLink(ids.linkEmail, { label_id: ids.labelJira })] }), ws([renamed]), { contextLabelId: ids.labelJira });
    expect(r.ok && r.writeSet.writes.filter((w) => w.table === "label_link")).toEqual([]);
    expect(r.ok && r.writeSet.events.every((e) => e.context_label_id === ids.labelJira)).toBe(true);
  });

  it("is refused for a deleted label and for roles that may not change labels; layout alone is not labeled", () => {
    const gone = state({ labels: [label(), label(ids.labelJira, { deleted_at: "2026-10-12T09:00:00.000Z" })] });
    expect(completeLiveWrites(makeCtx(), owner, gone, ws([renamed]), { contextLabelId: ids.labelJira })).toMatchObject({ ok: false, error: { code: "not_found", message: CONTEXT_LABEL_GONE } });
    expect(completeLiveWrites(makeCtx(), access("reviewer"), state(), ws([renamed]), { contextLabelId: ids.labelJira })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    const moved: Write = { kind: "update", table: "canvas_item", before: canvasItem(), row: { ...canvasItem(), x: 999, version: 2 } };
    const r = completeLiveWrites(makeCtx(), owner, state(), ws([moved]), { contextLabelId: ids.labelJira });
    expect(r.ok && r.value.labeled).toBe(0);
  });

  it("saves an action it would not label without the context when the label is gone or the role may not label (no dead end)", () => {
    const moved = ws([{ kind: "update", table: "canvas_item", before: canvasItem(), row: { ...canvasItem(), x: 999, version: 2 } }]);
    const gone = state({ labels: [label(), label(ids.labelJira, { deleted_at: "2026-10-12T09:00:00.000Z" })] });
    for (const [s, who] of [[gone, owner], [state(), access("reviewer")]] as const) {
      const r = completeLiveWrites(makeCtx(), who, s, moved, { contextLabelId: ids.labelJira });
      expect(r.ok && r.writeSet.events.every((e) => e.context_label_id === null)).toBe(true);
    }
  });

  it("lets the person delete the context's own label (checked as it was when the action started)", () => {
    const del = deleteLabel(makeCtx(), owner, { label: label(ids.labelJira), links: [], pins: [] }, { labelId: ids.labelJira, expectedVersion: 1 });
    expect(del.ok).toBe(true);
    if (!del.ok) return;
    const r = completeLiveWrites(makeCtx(), owner, state(), del.writeSet, { contextLabelId: ids.labelJira });
    expect(r.ok && r.writeSet.writes.filter((w) => w.kind === "insert" && w.table === "label_link")).toEqual([]);
  });

  it("labels only the moved attribute when attributes are renumbered (Q2)", () => {
    const s = state({ attributes: [attribute(ids.customerId, { sort_order: 0 }), attribute(ids.email, { sort_order: 1 })] });
    const moved = reorderAttribute(makeCtx(), owner, { attribute: s.attributes[1]!, attributes: s.attributes }, { attributeId: ids.email, expectedVersion: 1, position: 0 });
    expect(moved.ok && moved.writeSet.writes.length).toBe(2);
    if (!moved.ok) return;
    const r = completeLiveWrites(makeCtx(), owner, s, moved.writeSet, { contextLabelId: ids.labelJira });
    expect(r.ok && r.writeSet.writes.filter((w) => w.table === "label_link").map((w) => (w as { row: { attribute_id: string } }).row.attribute_id)).toEqual([ids.email]);
  });
});

describe("completeLiveWrites: live canvases follow their label (PRD item 7)", () => {
  it("comes back unchanged when nothing touches labels, the model's ties or cards' existence", () => {
    const moved = ws([{ kind: "update", table: "canvas_item", before: canvasItem(), row: { ...canvasItem(), x: 999, version: 2 } }]);
    const r = completeLiveWrites(makeCtx(), owner, state(), moved);
    expect(r.ok && r.writeSet).toBe(moved);
  });

  it("adds an entity labeled through an attribute as a context card to the right, in the same change group", () => {
    const labeled = ws([{ kind: "insert", table: "label_link", row: labelLink("01900000-0000-7000-8000-00000000a301", { entity_id: null, attribute_id: ids.orderId }) }]);
    const r = completeLiveWrites(makeCtx(), owner, state(), labeled);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.canvases).toEqual([{ canvasId: LIVE, added: ["Sales Order"], removed: [] }]);
    const card = liveItems(afterWrites(state(), r.writeSet.writes)).find((i) => i.entity_id === ids.salesOrder)!;
    expect(card).toMatchObject({ live_level: "context", row_filter: "labeled", x: 40 + 256 + 160, y: 40 });
    expect(r.writeSet.changeGroupId).toBe(labeled.changeGroupId);
  });

  it("takes a card off when its last label goes, freeing its pinned notes; changes context to full with the filter", () => {
    const item = state().canvasItems[1]!;
    const pinned = note(ids.notePinned, { canvas_id: LIVE, pin_canvas_item_id: item.id });
    const s = state({ notes: [pinned] });
    const off = ws([{ kind: "update", table: "label_link", before: labelLink(ids.linkCustomer), row: { ...labelLink(ids.linkCustomer), deleted_at: "2026-10-12T10:00:00.000Z", version: 2 } }]);
    const r = completeLiveWrites(makeCtx(), owner, s, off);
    expect(r.ok && r.value.canvases).toEqual([{ canvasId: LIVE, added: [], removed: ["Customer"] }]);
    if (!r.ok) return;
    const after = afterWrites(s, r.writeSet.writes);
    expect(liveItems(after)).toEqual([]);
    expect(after.notes[0]).toMatchObject({ pin_canvas_item_id: null });

    const ctxCard = state({ labelLinks: [labelLink(ids.linkEmail)], canvasItems: [{ ...item, live_level: "context", row_filter: "labeled" }] });
    const full = completeLiveWrites(makeCtx(), owner, ctxCard, ws([{ kind: "insert", table: "label_link", row: labelLink(ids.linkCustomer) }]));
    expect(full.ok && liveItems(afterWrites(ctxCard, full.writeSet.writes))[0]).toMatchObject({ live_level: "full", row_filter: "all" });
  });

  it("labels the element of a card placed on a live canvas, and gives the card its level in the same write", () => {
    const placed = canvasItem("01900000-0000-7000-8000-00000000c102", { canvas_id: LIVE, entity_id: ids.salesOrder, x: 800, y: 400 });
    const r = completeLiveWrites(makeCtx(), owner, state(), ws([{ kind: "insert", table: "canvas_item", row: placed }]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.writeSet.writes.filter((w) => w.table === "canvas_item")).toMatchObject([{ kind: "insert", row: { id: placed.id, live_level: "full", x: 800, y: 400 } }]);
    expect(r.writeSet.writes.filter((w) => w.table === "label_link")).toMatchObject([{ kind: "insert", row: { label_id: CR, entity_id: ids.salesOrder } }]);
    expect(completeLiveWrites(makeCtx(), access("reviewer"), state(), ws([{ kind: "insert", table: "canvas_item", row: placed }]))).toMatchObject({ ok: false });
  });

  it("leaves the cards of a newly opened live canvas as the opening made them (they carry their level)", () => {
    const opened = canvasItem("01900000-0000-7000-8000-00000000c103", { canvas_id: LIVE, entity_id: null, source_table_id: ids.crmCustomer, live_level: "context", row_filter: "labeled" });
    const s = state({ labelLinks: [labelLink(ids.linkCustomer), labelLink(ids.linkMapping)] });
    const r = completeLiveWrites(makeCtx(), owner, s, ws([{ kind: "insert", table: "canvas_item", row: opened }]));
    expect(r.ok && r.writeSet.writes.filter((w) => w.table === "label_link")).toEqual([]);
    expect(r.ok && liveItems(afterWrites(s, r.writeSet.writes)).find((i) => i.id === opened.id)).toMatchObject({ live_level: "context", row_filter: "labeled" });
  });

  it("knows which writes can matter (the pipeline loads the live state only then)", () => {
    const upd = (table: Write["table"], before: object, patch: object) => ({ kind: "update", table, before, row: { ...before, ...patch } }) as Write;
    expect(touchesLiveCanvases([upd("canvas_item", canvasItem(), { x: 1 })])).toBe(false);
    expect(touchesLiveCanvases([upd("attribute", attribute(), { name: "x" })])).toBe(false);
    expect(touchesLiveCanvases([upd("attribute", attribute(), { deleted_at: "2026-10-12T10:00:00.000Z" })])).toBe(true);
    expect(touchesLiveCanvases([upd("mapping_input", mappingInput(), { source_column_id: ids.colFirstName })])).toBe(true);
    expect(touchesLiveCanvases([{ kind: "insert", table: "canvas_item", row: canvasItem() }])).toBe(true);
    expect(touchesLiveCanvases([{ kind: "insert", table: "label_link", row: labelLink() }])).toBe(true);
  });
});

describe("openLiveCanvas (PRD item 6)", () => {
  const open = (s: LiveWriteState, role: Parameters<typeof access>[0] = "owner", links = [link(ids.projectA, ids.canvas1)]) =>
    openLiveCanvas(makeCtx(), access(role), { ...s, project: project(), projectLinks: links }, { labelId: ids.labelJira, projectId: ids.projectA });
  const jira = state({ canvases: [canvas()], canvasItems: [], labelLinks: [labelLink(ids.linkCustomer, { label_id: ids.labelJira }), labelLink(ids.linkMapping, { label_id: ids.labelJira })] });

  it("makes one canvas named after the label, full and context cards with their filters, arranged into frames", () => {
    const r = open(jira);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ name: "JIRA-481", created: true, addedToProject: false });
    const writes = r.writeSet.writes;
    expect(writes.filter((w) => w.table === "canvas")).toMatchObject([{ row: { name: "JIRA-481", live_label_id: ids.labelJira } }]);
    expect(writes.filter((w) => w.table === "project_canvas")).toMatchObject([{ row: { project_id: ids.projectA, sort_order: 1 } }]);
    const items = writes.filter((w) => w.table === "canvas_item").map((w) => (w as { row: { entity_id: string | null; live_level: string; row_filter: string; frame_id: string } }).row);
    expect(items.map((i) => [i.entity_id ?? "table", i.live_level, i.row_filter])).toEqual([
      ["table", "context", "labeled"],
      [ids.customer, "full", "all"],
    ]);
    const frames = writes.filter((w) => w.table === "frame").map((w) => (w as { row: { id: string; kind: string } }).row);
    expect(frames.map((f) => f.kind)).toEqual(["source_system", "concept"]);
    expect(items.every((i) => frames.some((f) => f.id === i.frame_id))).toBe(true);
  });

  it("goes to the label's live canvas when it exists, adding it to this project first when needed; at most one per label", () => {
    const existing = state({ canvases: [canvas(), canvas(LIVE, { name: "JIRA-481", live_label_id: ids.labelJira })] });
    expect(open(existing, "owner", [link(ids.projectA, LIVE)])).toMatchObject({ ok: true, value: { canvasId: LIVE, created: false, addedToProject: false }, writeSet: { writes: [] } });
    const added = open(existing, "owner", [link(ids.projectB, LIVE)]);
    expect(added).toMatchObject({ ok: true, value: { canvasId: LIVE, addedToProject: true } });
    expect(added.ok && added.writeSet.writes).toMatchObject([{ kind: "insert", table: "project_canvas", row: { project_id: ids.projectA, canvas_id: LIVE } }]);
  });

  it("makes a new one for owners, admins and modelers only; everyone may go to the one this project has (item 16)", () => {
    expect(open(jira, "reviewer")).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(open(jira, "reader")).toMatchObject({ ok: false, error: { code: "forbidden" } });
    const existing = state({ canvases: [canvas(), canvas(LIVE, { name: "JIRA-481", live_label_id: ids.labelJira })] });
    expect(open(existing, "reader", [link(ids.projectA, LIVE)])).toMatchObject({ ok: true, value: { canvasId: LIVE, created: false } });
    expect(open(existing, "reviewer", [link(ids.projectB, LIVE)])).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("removeFromLiveCanvas (PRD item 11)", () => {
  const card = state().canvasItems[1]!;
  const remove = (s: LiveWriteState, role: Parameters<typeof access>[0] = "owner") => removeFromLiveCanvas(makeCtx(), access(role), s, { canvasItemId: card.id, expectedVersion: card.version });

  it("takes a direct label off the element; the card stays as context when its rows or mappings carry the label", () => {
    const r = remove(state({ labelLinks: [labelLink(ids.linkCustomer), labelLink(ids.linkEmail), labelLink(ids.linkMapping)] }));
    expect(r).toMatchObject({ ok: true, value: { name: "Customer", label: "CR-23", mode: "direct", what: "1 attribute and 1 mapping", keptAsContext: true } });
    expect(r.ok && r.writeSet.writes.map((w) => (w as { before: { id: string } }).before.id)).toEqual([ids.linkCustomer]);
  });

  it("takes the label off the rows and mappings of a context card", () => {
    const s = state({ labelLinks: [labelLink(ids.linkEmail), labelLink(ids.linkMapping)], canvasItems: [canvasItem(), { ...card, live_level: "context", row_filter: "labeled" }] });
    const r = remove(s);
    expect(r).toMatchObject({ ok: true, value: { mode: "context", what: "1 attribute and 1 mapping", keptAsContext: false } });
    expect(r.ok && r.writeSet.writes.length).toBe(2);
  });

  it("is for those who may change labels, and only on live canvases", () => {
    expect(remove(state(), "reviewer")).toMatchObject({ ok: false, error: { code: "forbidden" } });
    const normal = removeFromLiveCanvas(makeCtx(), owner, state(), { canvasItemId: ids.itemCustomer, expectedVersion: 1 });
    expect(normal).toMatchObject({ ok: false, error: { message: "This is not a live canvas." } });
  });
});

describe("what other commands do on a live canvas (PRD items 9, 12, 13, 14)", () => {
  const liveCanvas = canvas(LIVE, { live_label_id: CR });
  const item = canvasItem("01900000-0000-7000-8000-00000000c101", { canvas_id: LIVE, live_level: "full" });

  it("refuses bulk adds and a plain remove there", () => {
    const many = placeManyOnCanvas(makeCtx(), owner, { canvas: liveCanvas, entities: [entity(ids.salesOrder)], sourceTables: [], items: [] }, { canvasId: LIVE, cards: [{ entityId: ids.salesOrder, x: 0, y: 0 }] });
    expect(many).toMatchObject({ ok: false, error: { message: LIVE_ONE_AT_A_TIME } });
    expect(removeFromCanvas(makeCtx(), owner, { item, canvas: liveCanvas }, { canvasItemId: item.id, expectedVersion: 1 })).toMatchObject({ ok: false, error: { message: LIVE_REMOVE_UNLABELS } });
    expect(removeCanvasItems(makeCtx(), owner, { canvas: liveCanvas, items: [item] }, { canvasId: LIVE, items: [{ canvasItemId: item.id, expectedVersion: 1 }] })).toMatchObject({ ok: false, error: { message: LIVE_REMOVE_UNLABELS } });
  });

  it("offers the labeled filter on live canvases only", () => {
    expect(updateCanvasItem(makeCtx(), owner, { item, canvas: liveCanvas }, { canvasItemId: item.id, expectedVersion: 1, rowFilter: "labeled" })).toMatchObject({ ok: true });
    expect(updateCanvasItem(makeCtx(), owner, { item: canvasItem(), canvas: canvas() }, { canvasItemId: ids.itemCustomer, expectedVersion: 1, rowFilter: "labeled" })).toMatchObject({ ok: false });
  });

  it("renames the live canvas with its label while it still has the label's name", () => {
    const r = renameLabel(makeCtx(), owner, { labels: [label()], canvases: [canvas(LIVE, { name: "CR-23", live_label_id: CR })] }, { labelId: CR, expectedVersion: 1, name: "CR-24" });
    expect(r.ok && r.writeSet.writes.map((w) => [w.table, (w as { row: { name: string } }).row.name])).toEqual([["label", "CR-24"], ["canvas", "CR-24"]]);
    const kept = renameLabel(makeCtx(), owner, { labels: [label()], canvases: [canvas(LIVE, { name: "My ticket", live_label_id: CR })] }, { labelId: CR, expectedVersion: 1, name: "CR-24" });
    expect(kept.ok && kept.value.canvasRenamed).toBe(false);
  });

  it("duplicating a live canvas gives a normal canvas from the start (Q6)", () => {
    const labeledFilter = { ...item, live_level: "context" as const, row_filter: "labeled" as const };
    const r = duplicateCanvas(makeCtx(), owner, { canvas: liveCanvas, project: project(), projectLinks: [link(ids.projectA, LIVE)], frames: [], items: [labeledFilter] }, { projectId: ids.projectA, canvasId: LIVE });
    const rows = r.ok ? r.writeSet.writes.map((w) => (w as unknown as { table: string; row: Record<string, unknown> })) : [];
    expect(rows.find((w) => w.table === "canvas")?.row).toMatchObject({ live_label_id: null });
    expect(rows.find((w) => w.table === "canvas_item")?.row).toMatchObject({ live_level: null, row_filter: "all" });
  });

  it("deleting the label makes its live canvas normal in the same change group (Q5)", () => {
    const labeledFilter = { ...item, live_level: "context" as const, row_filter: "labeled" as const };
    const r = deleteLabel(makeCtx(), owner, { label: label(), links: [], pins: [], canvases: [canvas(LIVE, { live_label_id: CR })], canvasItems: [labeledFilter] }, { labelId: CR, expectedVersion: 1 });
    expect(r.ok && r.value.liveCanvasId).toBe(LIVE);
    const rows = r.ok ? r.writeSet.writes.map((w) => (w as unknown as { row: Record<string, unknown> }).row) : [];
    expect(rows.find((x) => x.id === LIVE)).toMatchObject({ live_label_id: null });
    expect(rows.find((x) => x.id === item.id)).toMatchObject({ live_level: null, row_filter: "all" });
  });
});
