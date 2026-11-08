// A canvas's thumbnail (slice 12b, PRD P2 and P6; step 1, answers 1, 2, 4 and 5; step 2: the paths).

import { describe, expect, it } from "vitest";
import {
  attribute,
  canvas,
  canvasItem,
  concept,
  entity,
  frame,
  ids,
  label,
  labelLink,
  mapping,
  mappingInput,
  note,
  requirement,
  sourceColumn,
  sourceTable,
} from "../__fixtures__/domain";
import type { CanvasItem, Frame, LabelLink, Note, WorkspaceModel } from "../types";
import { cardHeightFor } from "./card-size";
import { NO_CONCEPT_COLOR } from "./concept-colors";
import { BLOCK, blockHeight, CARD_HEADER_HEIGHT, FREE_FRAME_COLORS } from "./frames";
import {
  canvasThumbnail,
  canvasThumbnails,
  thumbnailDrawing,
  thumbnailIndex,
  THUMBNAIL_NOTE_HEIGHT,
  THUMBNAIL_REQUIREMENT_HEIGHT,
  THUMBNAIL_SPACE,
  type Thumbnail,
  type ThumbnailRect,
} from "./thumbnail";

const itemSales = "01900000-0000-7000-8000-00000000c003";
const itemReq = "01900000-0000-7000-8000-00000000c004";
const firstNameMap = "01900000-0000-7000-8000-00000000a002";
const firstNameIn = "01900000-0000-7000-8000-00000000b002";

/** Customer (customer_id PK, email) and Sales Order (order_id PK); crm.customer (cust_id PK, email, first_name); email ← email. */
const model = (over: Partial<WorkspaceModel> = {}): WorkspaceModel => ({
  concepts: [concept(ids.conceptCustomer), concept(ids.conceptSales)],
  entities: [entity(ids.customer), entity(ids.salesOrder)],
  attributes: [attribute(ids.customerId), attribute(ids.email), attribute(ids.orderId)],
  relationships: [],
  sourceSystems: [],
  sourceTables: [sourceTable()],
  sourceColumns: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
  mappings: [mapping()],
  mappingInputs: [mappingInput()],
  attributeInputs: [],
  sourceRelationships: [],
  sourceRelationshipColumns: [],
  classifications: [],
  classificationLinks: [],
  lostOriginals: [],
  ...over,
});

const customerCard = (over: Partial<CanvasItem> = {}) => canvasItem(ids.itemCustomer, { x: 400, y: 100, ...over });
const tableCard = (over: Partial<CanvasItem> = {}) => canvasItem(ids.itemCrmCustomer, { x: 0, y: 100, ...over });
const salesCard = (over: Partial<CanvasItem> = {}) => canvasItem(itemSales, { entity_id: ids.salesOrder, x: 800, y: 100, ...over });
const reqCard = (over: Partial<CanvasItem> = {}) => canvasItem(itemReq, { entity_id: null, requirement_id: ids.req101, x: 1200, y: 0, ...over });

function thumb(
  rows: { items?: CanvasItem[]; frames?: Frame[]; notes?: Note[] },
  options: { model?: WorkspaceModel; live?: string; labels?: string[]; links?: LabelLink[]; requirements?: string[] } = {},
): Thumbnail {
  const ix = thumbnailIndex(options.model ?? model(), {
    requirements: (options.requirements ?? [ids.req101]).map((id) => requirement(id)),
    labels: (options.labels ?? [ids.labelCr23]).map((id) => label(id)),
    labelLinks: options.links ?? [],
  });
  return canvasThumbnail({ live_label_id: options.live ?? null }, { items: rows.items ?? [], frames: rows.frames ?? [], notes: rows.notes ?? [] }, ix);
}

const rects = (t: Thumbnail, kind: ThumbnailRect["kind"]) => t.shapes.filter((s): s is ThumbnailRect => s.kind === kind);
const kinds = (t: Thumbnail) => t.shapes.map((s) => s.kind);

describe("canvasThumbnail: what is drawn (P2)", () => {
  it("draws entity cards in their concept's colour, table cards physical, and a line between a mapped pair, centre to centre", () => {
    const t = thumb({ items: [customerCard(), tableCard(), salesCard()] });
    expect(rects(t, "entity").map((s) => s.color)).toEqual(["#2F7DD1", "#0F8B8D"]);
    expect(rects(t, "table")).toEqual([{ kind: "table", color: "physical", x: 0, y: 100, width: 256, height: cardHeightFor(3) }]);
    // Customer is 2 rows high, crm.customer 3: the centres of both cards
    expect(t.shapes.filter((s) => s.kind === "line")).toEqual([{ kind: "line", color: null, x1: 128, y1: 100 + cardHeightFor(3) / 2, x2: 528, y2: 100 + cardHeightFor(2) / 2 }]);
  });

  it("draws in the prototype's order: frames, lines, tables, entities, notes, requirement cards", () => {
    const t = thumb({ items: [reqCard(), customerCard(), tableCard()], frames: [frame(ids.frameA, { x: -40, y: 40, width: 1000, height: 400 })], notes: [note()] });
    expect(kinds(t)).toEqual(["frame", "line", "table", "entity", "note", "requirement"]);
  });

  it("draws an entity whose concept is not in the model in the canvas's neutral colour", () => {
    const t = thumb({ items: [customerCard()] }, { model: model({ concepts: [] }) });
    expect(rects(t, "entity")[0]!.color).toBe(NO_CONCEPT_COLOR);
  });

  it("colours frames as the canvas does: a concept's colour, the first free colour without one, physical for a source frame, a free frame's own", () => {
    const frames = [
      frame(ids.frameA, { kind: "concept", concept_id: ids.conceptSales, color: null, width: 900 }),
      frame(ids.frameB, { kind: "concept", concept_id: "01900000-0000-7000-8000-00000000f0ff", color: null, width: 800 }),
      frame("01900000-0000-7000-8000-00000000f003", { kind: "source_system", source_system_id: ids.crm, color: null, width: 700 }),
      frame("01900000-0000-7000-8000-00000000f004", { color: "#C0437A", width: 600 }),
    ];
    expect(rects(thumb({ frames }), "frame").map((s) => s.color)).toEqual(["#0F8B8D", FREE_FRAME_COLORS[0], "physical", "#C0437A"]);
  });

  it("draws the larger frames first, so a smaller frame on a bigger one lies above it", () => {
    const small = frame(ids.frameA, { width: 200, height: 100 });
    const big = frame(ids.frameB, { width: 900, height: 600 });
    expect(rects(thumb({ frames: [small, big] }), "frame").map((s) => s.width)).toEqual([900, 200]);
  });

  it("draws free notes at their width and 80 high in their paper colour, resolved ones too; pinned notes not", () => {
    const t = thumb({
      items: [customerCard()],
      notes: [note(ids.noteFree, { color: "blue", width: 300 }), note("01900000-0000-7000-8000-00000000d003", { status: "resolved", x: 0, y: 0 }), note(ids.notePinned)],
    });
    expect(rects(t, "note")).toEqual([
      { kind: "note", color: "blue", x: 1000, y: 900, width: 300, height: THUMBNAIL_NOTE_HEIGHT },
      { kind: "note", color: "yellow", x: 0, y: 0, width: 220, height: THUMBNAIL_NOTE_HEIGHT },
    ]);
  });

  it("draws a requirement card 230 × 94 in the requirement colour, whatever its name (answer 2)", () => {
    expect(rects(thumb({ items: [reqCard()] }), "requirement")).toEqual([{ kind: "requirement", color: "req", x: 1200, y: 0, width: 230, height: THUMBNAIL_REQUIREMENT_HEIGHT }]);
  });
});

describe("canvasThumbnail: heights as the canvas (P6, answer 1)", () => {
  it("draws a card as high as its rows, a collapsed card as its header, at its stored width", () => {
    const t = thumb({ items: [customerCard({ width: 320 }), salesCard({ collapsed: true })] });
    expect(rects(t, "entity").map((s) => [s.width, s.height])).toEqual([
      [320, cardHeightFor(2)],
      [256, CARD_HEADER_HEIGHT],
    ]);
  });

  it("counts only the rows the card's filter shows", () => {
    // crm.customer: cust_id is a key, email is mapped, first_name neither
    const of = (row_filter: CanvasItem["row_filter"]) => rects(thumb({ items: [tableCard({ row_filter })] }), "table")[0]!.height;
    expect(of("mapped")).toBe(cardHeightFor(1));
    expect(of("unmapped")).toBe(cardHeightFor(2));
    expect(of("keys")).toBe(cardHeightFor(1));
  });

  it("counts a mapping's rows as the canvas does: not when the mapping's attribute is gone", () => {
    const orphan = mapping({ id: firstNameMap, attribute_id: "01900000-0000-7000-8000-0000000050ff" });
    const m = model({ mappings: [mapping(), orphan], mappingInputs: [mappingInput(), mappingInput(firstNameIn, { mapping_id: firstNameMap, source_column_id: ids.colFirstName })] });
    expect(rects(thumb({ items: [tableCard({ row_filter: "mapped" })] }, { model: m }), "table")[0]!.height).toBe(cardHeightFor(1));
  });

  it("shows a stored `labeled` filter as every row outside a live canvas", () => {
    expect(rects(thumb({ items: [customerCard({ row_filter: "labeled" })] }), "entity")[0]!.height).toBe(cardHeightFor(2));
  });

  it("draws a live canvas's context card with the rows its label makes relevant", () => {
    const links = [labelLink(ids.linkEmail)];
    const t = thumb({ items: [customerCard({ row_filter: "labeled", live_level: "context" })] }, { live: ids.labelCr23, links });
    expect(rects(t, "entity")[0]!.height).toBe(cardHeightFor(1));
  });

  it("draws a live canvas whose label is deleted as the canvas page does: every row", () => {
    const t = thumb({ items: [customerCard({ row_filter: "labeled" })] }, { live: ids.labelCr23, labels: [], links: [labelLink(ids.linkEmail)] });
    expect(rects(t, "entity")[0]!.height).toBe(cardHeightFor(2));
  });
});

describe("canvasThumbnail: collapsed frames (P2, answers 4 and 5)", () => {
  const area = frame(ids.frameA, { x: 300, y: 50, width: 600, height: 400, collapsed: true, kind: "concept", concept_id: ids.conceptCustomer });

  it("draws a collapsed frame as its block, as high as its cards need, and leaves out its cards, their lines and its free notes", () => {
    const t = thumb({
      items: [tableCard(), customerCard({ frame_id: ids.frameA }), salesCard({ frame_id: ids.frameA })],
      frames: [area],
      notes: [note(ids.noteFree, { frame_id: ids.frameA })],
    });
    expect(rects(t, "block")).toEqual([{ kind: "block", color: "#2F7DD1", x: 300, y: 50, width: BLOCK.width, height: blockHeight(2) }]);
    expect(kinds(t)).toEqual(["block", "table"]);
  });

  it("does not count a card whose entity is deleted among the block's members", () => {
    const m = model({ entities: [entity(ids.customer)] });
    const t = thumb({ items: [customerCard({ frame_id: ids.frameA }), salesCard({ frame_id: ids.frameA })], frames: [area] }, { model: m });
    expect(rects(t, "block")[0]!.height).toBe(blockHeight(1));
  });
});

describe("canvasThumbnail: deleted things (S12B-05)", () => {
  it("draws no card of a deleted entity, table or requirement, and no line to it", () => {
    const m = model({ entities: [entity(ids.salesOrder)], sourceTables: [] });
    const t = thumb({ items: [customerCard(), tableCard(), salesCard(), reqCard()] }, { model: m, requirements: [] });
    expect(kinds(t)).toEqual(["entity"]);
  });

  it("is empty with nothing to draw: no bounds and no drawing", () => {
    const t = thumb({ items: [reqCard()], notes: [note(ids.notePinned)] }, { requirements: [] });
    expect(t).toEqual({ shapes: [], bounds: null });
    expect(thumbnailDrawing(t)).toBeNull();
  });
});

describe("canvasThumbnail: lines", () => {
  it("draws one line per pair, however many mappings join it", () => {
    const m = model({
      mappings: [mapping(), mapping({ id: firstNameMap, attribute_id: ids.customerId })],
      mappingInputs: [mappingInput(), mappingInput(firstNameIn, { mapping_id: firstNameMap, source_column_id: ids.colFirstName })],
    });
    expect(thumb({ items: [customerCard(), tableCard()] }, { model: m }).shapes.filter((s) => s.kind === "line")).toHaveLength(1);
  });

  it("draws no line without both cards on the canvas", () => {
    expect(thumb({ items: [tableCard(), salesCard()] }).shapes.filter((s) => s.kind === "line")).toEqual([]);
  });
});

describe("canvasThumbnail: bounds", () => {
  it("holds every drawn shape", () => {
    const t = thumb({ items: [tableCard(), reqCard()], notes: [note()], frames: [frame(ids.frameA, { x: -50, y: -20, width: 100, height: 100 })] });
    expect(t.bounds).toEqual({ x: -50, y: -20, width: 1200 + 230 + 50, height: 900 + THUMBNAIL_NOTE_HEIGHT + 20 });
  });
});

describe("canvasThumbnails", () => {
  it("gives each canvas the thumbnail of its own rows", () => {
    const ix = thumbnailIndex(model(), { requirements: [], labels: [], labelLinks: [] });
    const other = canvas(ids.canvas2);
    const map = canvasThumbnails([canvas(ids.canvas1), other], { items: [customerCard(), tableCard({ canvas_id: ids.canvas2 })], frames: [], notes: [] }, ix);
    expect(kinds(map.get(ids.canvas1)!)).toEqual(["entity"]);
    expect(kinds(map.get(ids.canvas2)!)).toEqual(["table"]);
  });
});

describe("thumbnailDrawing (step 2: one path per kind and colour)", () => {
  it("scales the content and a 6 % margin to 400 units on its longer side, in whole numbers", () => {
    const d = thumbnailDrawing(thumb({ items: [tableCard({ y: 0 })] }))!;
    // 256 × 144 plus 15.36 on each side: 286.72 × 174.72, scaled by 400 / 286.72
    expect(d).toEqual({ width: THUMBNAIL_SPACE, height: 244, paths: [{ kind: "table", color: "physical", d: "M21 21h357v201h-357z" }] });
  });

  it("writes one path per kind and colour, in drawing order, lines as M x y L x y", () => {
    const d = thumbnailDrawing(thumb({ items: [customerCard(), tableCard(), salesCard()], notes: [note()] }))!;
    expect(d.paths.map((p) => [p.kind, p.color])).toEqual([
      ["line", null],
      ["table", "physical"],
      ["entity", "#2F7DD1"],
      ["entity", "#0F8B8D"],
      ["note", "yellow"],
    ]);
    expect(d.paths[0]!.d).toMatch(/^M\d+ \d+L\d+ \d+$/);
    for (const p of d.paths.slice(1)) expect(p.d).toMatch(/^(M\d+ \d+h\d+v\d+h-\d+z)+$/);
  });

  it("draws a sliver at least one unit wide", () => {
    const t: Thumbnail = { shapes: [{ kind: "frame", color: "#7C8998", x: 0, y: 0, width: 100_000, height: 1 }], bounds: { x: 0, y: 0, width: 100_000, height: 1 } };
    expect(thumbnailDrawing(t)!.paths[0]!.d).toMatch(/v1h/);
  });
});
