// A draft of the thumbnail's shapes (slice 12b, step 2; PRD P2 and P6 as answered in step 1), for the bench only:
// step 3 writes the real function in `src/domain/model/thumbnail.ts` with its unit tests. Two height rules are kept
// here to time them against each other: "canvas" (cardHeightOf with the row filter, context cards through
// liveMembership) and "prototype" (every row, whatever the filter). Three ways of writing the SVG are kept to count
// their bytes: React elements, one string, and one string in a normalized space with whole numbers.

import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Uuid } from "../../src/domain/ids";
import { cardHeightFor, cardHeightOf, type FilterableRow } from "../../src/domain/model/card-size";
import { indexOf } from "../../src/domain/model/classifications";
import { BLOCK, blockHeight, DEFAULT_CARD_WIDTH, FREE_FRAME_COLORS } from "../../src/domain/model/frames";
import { liveMembership } from "../../src/domain/model/live";
import type { Canvas, CanvasItem, Frame, LabelLink, Note, WorkspaceModel } from "../../src/domain/types";

export type HeightRule = "canvas" | "prototype";

/** What one page reads once for all its thumbnails. */
export interface ThumbIndex {
  rowsOfEntity: Map<Uuid, FilterableRow[]>;
  rowsOfTable: Map<Uuid, FilterableRow[]>;
  rowIdsOfEntity: Map<Uuid, Uuid[]>;
  rowIdsOfTable: Map<Uuid, Uuid[]>;
  conceptColor: Map<Uuid, string | null>;
  conceptColorById: Map<Uuid, string>;
  /** "table|entity" for every pair joined by a mapping. */
  pairs: Set<string>;
  liveRequirements: Set<Uuid>;
  model: WorkspaceModel;
  links: readonly LabelLink[];
}

export function thumbIndex(model: WorkspaceModel, liveRequirementIds: Iterable<Uuid>, links: readonly LabelLink[]): ThumbIndex {
  const classes = indexOf(model);
  const mappingsOfRow = new Map<Uuid, number>();
  const tableOfColumn = new Map(model.sourceColumns.map((c) => [c.id, c.source_table_id]));
  const entityOfAttribute = new Map(model.attributes.map((a) => [a.id, a.entity_id]));
  const pairs = new Set<string>();
  const inputs = new Map<Uuid, Uuid[]>();
  for (const i of model.mappingInputs) inputs.set(i.mapping_id, [...(inputs.get(i.mapping_id) ?? []), i.source_column_id]);
  for (const m of model.mappings) {
    mappingsOfRow.set(m.attribute_id, (mappingsOfRow.get(m.attribute_id) ?? 0) + 1);
    const entity = entityOfAttribute.get(m.attribute_id);
    for (const c of inputs.get(m.id) ?? []) {
      mappingsOfRow.set(c, (mappingsOfRow.get(c) ?? 0) + 1);
      const table = tableOfColumn.get(c);
      if (entity && table) pairs.add(`${table}|${entity}`);
    }
  }
  const rowsOfEntity = new Map<Uuid, FilterableRow[]>(), rowIdsOfEntity = new Map<Uuid, Uuid[]>();
  for (const a of model.attributes) {
    (rowsOfEntity.get(a.entity_id) ?? rowsOfEntity.set(a.entity_id, []).get(a.entity_id)!).push({ mappings: mappingsOfRow.get(a.id) ?? 0, pk: a.is_primary_key, fk: a.is_foreign_key, bk: a.is_business_key });
    (rowIdsOfEntity.get(a.entity_id) ?? rowIdsOfEntity.set(a.entity_id, []).get(a.entity_id)!).push(a.id);
  }
  const rowsOfTable = new Map<Uuid, FilterableRow[]>(), rowIdsOfTable = new Map<Uuid, Uuid[]>();
  for (const c of model.sourceColumns) {
    (rowsOfTable.get(c.source_table_id) ?? rowsOfTable.set(c.source_table_id, []).get(c.source_table_id)!).push({ mappings: mappingsOfRow.get(c.id) ?? 0, pk: c.is_primary_key, fk: c.is_foreign_key, bk: classes.has(c.id, "BK") });
    (rowIdsOfTable.get(c.source_table_id) ?? rowIdsOfTable.set(c.source_table_id, []).get(c.source_table_id)!).push(c.id);
  }
  const conceptColorById = new Map(model.concepts.map((c) => [c.id, c.color]));
  const conceptColor = new Map(model.entities.map((e) => [e.id, (e.concept_id && conceptColorById.get(e.concept_id)) || null]));
  return { rowsOfEntity, rowsOfTable, rowIdsOfEntity, rowIdsOfTable, conceptColor, conceptColorById, pairs, liveRequirements: new Set(liveRequirementIds), model, links };
}

/** A shape in canvas coordinates; `c` is a colour role: a `#RRGGBB`, "physical", "req", or a note colour. */
export type Shape =
  | { k: "frame" | "block"; x: number; y: number; w: number; h: number; c: string }
  | { k: "entity" | "table" | "req"; x: number; y: number; w: number; h: number; c: string }
  | { k: "note"; x: number; y: number; w: number; h: number; c: string }
  | { k: "line"; x1: number; y1: number; x2: number; y2: number };

export interface Thumb {
  shapes: Shape[];
  bounds: { x: number; y: number; w: number; h: number } | null;
}

export function thumbnail(canvas: Pick<Canvas, "live_label_id">, items: readonly CanvasItem[], frames: readonly Frame[], notes: readonly Note[], ix: ThumbIndex, rule: HeightRule): Thumb {
  const live = canvas.live_label_id ? liveMembership(canvas.live_label_id, { ...ix.model, links: ix.links }) : null;
  const members = new Map<Uuid, number>();
  for (const i of items) if (i.frame_id && (i.entity_id || i.source_table_id)) members.set(i.frame_id, (members.get(i.frame_id) ?? 0) + 1);
  const collapsed = new Set(frames.filter((f) => f.collapsed).map((f) => f.id));
  const hidden = (frameId: Uuid | null) => !!frameId && collapsed.has(frameId);
  const out: Shape[] = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (x: number, y: number, w: number, h: number) => {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h);
  };
  for (const f of frames) {
    const c = f.kind === "concept" ? (f.concept_id && ix.conceptColorById.get(f.concept_id)) || FREE_FRAME_COLORS[0] : f.kind === "source_system" ? "physical" : f.color ?? FREE_FRAME_COLORS[0];
    const s = f.collapsed ? { k: "block" as const, x: f.x, y: f.y, w: BLOCK.width, h: blockHeight(members.get(f.id) ?? 0), c } : { k: "frame" as const, x: f.x, y: f.y, w: f.width, h: f.height, c };
    out.push(s);
    grow(s.x, s.y, s.w, s.h);
  }
  const centre = new Map<string, { x: number; y: number }>();
  const lines: Shape[] = [];
  const cards: Shape[] = [];
  for (const i of items) {
    if (hidden(i.frame_id)) continue;
    const w = i.width ?? DEFAULT_CARD_WIDTH;
    if (i.requirement_id) {
      if (!ix.liveRequirements.has(i.requirement_id)) continue;
      cards.push({ k: "req", x: i.x, y: i.y, w: 230, h: 94, c: "req" });
      grow(i.x, i.y, 230, 94);
      continue;
    }
    const isEntity = !!i.entity_id;
    const id = (i.entity_id ?? i.source_table_id)!;
    const rows = (isEntity ? ix.rowsOfEntity : ix.rowsOfTable).get(id) ?? [];
    let h: number;
    if (rule === "prototype") h = cardHeightFor(rows.length, i.collapsed);
    else if (live && i.row_filter === "labeled") {
      const ids = (isEntity ? ix.rowIdsOfEntity : ix.rowIdsOfTable).get(id) ?? [];
      h = cardHeightOf({ rows: rows.map((r, k) => ({ ...r, relevant: live.relevantRows.has(ids[k]!) })), collapsed: i.collapsed, rowFilter: i.row_filter });
    } else h = cardHeightOf({ rows, collapsed: i.collapsed, rowFilter: i.row_filter });
    cards.push({ k: isEntity ? "entity" : "table", x: i.x, y: i.y, w, h, c: isEntity ? ix.conceptColor.get(id) ?? "#888899" : "physical" });
    centre.set(`${isEntity ? "e" : "t"}${id}`, { x: i.x + w / 2, y: i.y + h / 2 });
    grow(i.x, i.y, w, h);
  }
  for (const [key, a] of centre) {
    if (key[0] !== "t") continue;
    for (const [ekey, z] of centre) if (ekey[0] === "e" && ix.pairs.has(`${key.slice(1)}|${ekey.slice(1)}`)) lines.push({ k: "line", x1: a.x, y1: a.y, x2: z.x, y2: z.y });
  }
  const shownNotes: Shape[] = [];
  for (const n of notes) {
    if (n.pin_canvas_item_id || n.pin_frame_id || hidden(n.frame_id)) continue;
    shownNotes.push({ k: "note", x: n.x, y: n.y, w: n.width, h: 80, c: n.color });
    grow(n.x, n.y, n.width, 80);
  }
  // drawing order as the prototype: frames, lines, tables and entities, notes, requirement cards
  const tablesFirst = cards.filter((s) => s.k === "table").concat(cards.filter((s) => s.k === "entity"));
  const shapes = [...out, ...lines, ...tablesFirst, ...shownNotes, ...cards.filter((s) => s.k === "req")];
  return { shapes, bounds: x0 <= x1 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null };
}

// ---- writing it ----

const CLS: Record<string, string> = { frame: "f", block: "b", entity: "e", table: "t", req: "q", note: "n" };

/** The SVG as React elements (what a server component returns); `round`: whole numbers in a 400-unit space. */
export function svgElement(t: Thumb, round = false): ReactElement | null {
  if (!t.bounds) return null;
  const pad = Math.max(t.bounds.w, t.bounds.h) * 0.06;
  const bx = t.bounds.x - pad, by = t.bounds.y - pad, bw = t.bounds.w + pad * 2, bh = t.bounds.h + pad * 2;
  const s = round ? 400 / Math.max(bw, bh) : 1;
  const X = (v: number) => (round ? Math.round((v - bx) * s) : v);
  const Y = (v: number) => (round ? Math.round((v - by) * s) : v);
  const L = (v: number) => (round ? Math.max(1, Math.round(v * s)) : v);
  const viewBox = round ? `0 0 ${Math.round(bw * s)} ${Math.round(bh * s)}` : `${bx} ${by} ${bw} ${bh}`;
  const children = t.shapes.map((sh, i) =>
    sh.k === "line"
      ? createElement("line", { key: i, className: "m", x1: X(sh.x1), y1: Y(sh.y1), x2: X(sh.x2), y2: Y(sh.y2) })
      : createElement("rect", { key: i, className: sh.k === "note" ? `n ${sh.c}` : CLS[sh.k], x: X(sh.x), y: Y(sh.y), width: L(sh.w), height: L(sh.h), ...(sh.c.startsWith("#") ? { fill: sh.c } : {}) }),
  );
  return createElement("svg", { viewBox, preserveAspectRatio: "xMidYMid meet", "aria-hidden": true, "data-testid": "tile-thumbnail" }, ...children);
}

/**
 * The compact way: one `<path>` per class and colour, whole numbers in a 400-unit space, rectangles as `M x y h w v h
 * h -w z` (no rounded corners: at the strip's size they are under a pixel) and lines as `M x y L x y`. A few elements
 * per thumbnail, so its RSC payload is about the markup again.
 */
export function pathsMarkup(t: Thumb): string {
  if (!t.bounds) return "";
  const pad = Math.max(t.bounds.w, t.bounds.h) * 0.06;
  const bx = t.bounds.x - pad, by = t.bounds.y - pad, bw = t.bounds.w + pad * 2, bh = t.bounds.h + pad * 2;
  const s = 400 / Math.max(bw, bh);
  const X = (v: number) => Math.round((v - bx) * s), Y = (v: number) => Math.round((v - by) * s), L = (v: number) => Math.max(1, Math.round(v * s));
  const groups = new Map<string, string[]>();
  for (const sh of t.shapes) {
    const key = sh.k === "line" ? "m" : sh.k === "note" ? `n ${sh.c}` : `${CLS[sh.k]}${sh.c.startsWith("#") ? "|" + sh.c : ""}`;
    const d = sh.k === "line" ? `M${X(sh.x1)} ${Y(sh.y1)}L${X(sh.x2)} ${Y(sh.y2)}` : `M${X(sh.x)} ${Y(sh.y)}h${L(sh.w)}v${L(sh.h)}h-${L(sh.w)}z`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(d);
  }
  const paths = [...groups].map(([key, ds]) => {
    const [cls, fill] = key.split("|");
    return `<path class="${cls}"${fill ? ` fill="${fill}"` : ""} d="${ds.join("")}"></path>`;
  });
  return `<svg viewBox="0 0 ${Math.round(bw * s)} ${Math.round(bh * s)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-testid="tile-thumbnail">${paths.join("")}</svg>`;
}

/** The bytes each way costs per thumbnail: in the HTML, and in the RSC payload (an estimate of its JSON). */
export function bytesOf(t: Thumb) {
  const el = svgElement(t), round = svgElement(t, true);
  const html = el ? renderToStaticMarkup(el) : "";
  const htmlRound = round ? renderToStaticMarkup(round) : "";
  const paths = pathsMarkup(t);
  const flight = (e: ReactElement | null) => (e ? JSON.stringify(asFlight(e)).length : 0);
  return {
    elements: { html: html.length, payload: flight(el) },
    string: { html: html.length, payload: JSON.stringify(html).length },
    elementsRounded: { html: htmlRound.length, payload: flight(round) },
    stringRounded: { html: htmlRound.length, payload: JSON.stringify(htmlRound).length },
    paths: { html: paths.length, payload: JSON.stringify(paths).length },
  };
}

/** How many shapes of each kind. */
export function kindsOf(thumbs: readonly Thumb[]): Record<string, number> {
  const n: Record<string, number> = {};
  for (const t of thumbs) for (const s of t.shapes) n[s.k] = (n[s.k] ?? 0) + 1;
  return n;
}

/** React's flight format writes an element as ["$", type, key, props]. */
function asFlight(e: ReactElement): unknown {
  const props = { ...(e.props as Record<string, unknown>) };
  const kids = props.children;
  delete props.children;
  const children = Array.isArray(kids) ? kids.map((k) => asFlight(k as ReactElement)) : undefined;
  return ["$", e.type, e.key, children ? { ...props, children } : props];
}
