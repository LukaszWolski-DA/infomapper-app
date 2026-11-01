// A canvas's thumbnail on the home pages' tiles (slice 12b, D-29; PRD P2 and P6, prototype `thumb`): a sketch of the
// canvas's layout from its stored rows, computed on the server on every load (P5), never measured. Frames as tinted
// rectangles (a collapsed one as its block, its cards, lines and free notes not drawn), entity cards in their concept's
// colour, table cards in the physical colour, one line per table and entity pair joined by a mapping, free notes in
// their paper colour and requirement cards in the reserved violet; no text, no relationship lines, no marks, and the
// canvas's layer mode is ignored (step 1, answer 4). Card heights follow the canvas's rules (`cardHeightOf` with the
// row filter, a live canvas's context cards through `liveMembership`, `blockHeight`; step 1, answer 1), so a tall card
// is as tall as on the canvas. `thumbnailDrawing` writes it as one path per kind and colour, whole numbers in a
// 400-unit space (step 2's answer: the bytes). Colours are roles; `src/ui/canvas-thumbnail.tsx` maps them to tokens.

import type { Uuid } from "../ids";
import type { Canvas, CanvasItem, Frame, LabelLink, Note, NoteColor, WorkspaceModel } from "../types";
import { cardHeightOf, type FilterableRow } from "./card-size";
import { REQUIREMENT_CARD_WIDTH } from "./card-kinds";
import { indexOf } from "./classifications";
import { blockHeight, BLOCK, cardWidthOf, FREE_FRAME_COLORS, type Rect } from "./frames";
import { liveMembership } from "./live";
import { isPinned, notePlaces, noteVisible } from "./notes";

/** The drawing's longer side, in units: whole numbers at this size are under a pixel in the tile's 140 px strip. */
export const THUMBNAIL_SPACE = 400;
/** The margin around the drawn content, of its longer side (prototype `thumb`). */
export const THUMBNAIL_MARGIN = 0.06;
/** A requirement card is drawn 94 high, one name line, whatever its name (step 1, answer 2). */
export const THUMBNAIL_REQUIREMENT_HEIGHT = 94;
/** A note's height is not stored; it is drawn 80 high (prototype `thumb`; step 1, F14). */
export const THUMBNAIL_NOTE_HEIGHT = 80;
/** An entity whose concept is not in the model, as the canvas draws it (`CardNode`, the Overview). */
export const NO_CONCEPT_COLOR = "#888899";

/**
 * A colour role: a stored `#RRGGBB` (a concept's, a free frame's), `physical` (tables and source frames), `req`
 * (requirement cards), a note's colour name, or null (lines, drawn in the mapping colour).
 */
export type ThumbnailColor = `#${string}` | "physical" | "req" | NoteColor | null;

export type ThumbnailRect = { kind: "frame" | "block" | "table" | "entity" | "note" | "requirement"; color: ThumbnailColor } & Rect;
export interface ThumbnailLine {
  kind: "line";
  color: null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export type ThumbnailShape = ThumbnailRect | ThumbnailLine;
export type ThumbnailKind = ThumbnailShape["kind"];

/** The shapes in drawing order (frames, lines, tables, entities, notes, requirement cards) and their bounds; null bounds: nothing to draw ("Empty canvas"). */
export interface Thumbnail {
  shapes: ThumbnailShape[];
  bounds: Rect | null;
}

type Row = FilterableRow & { id: Uuid };

/** What one page reads once for all its thumbnails (built once per load, as `ModelIndex`). */
export interface ThumbnailIndex {
  rowsOfEntity: ReadonlyMap<Uuid, readonly Row[]>;
  rowsOfTable: ReadonlyMap<Uuid, readonly Row[]>;
  /** Every live entity's colour role. */
  entityColor: ReadonlyMap<Uuid, ThumbnailColor>;
  tables: ReadonlySet<Uuid>;
  conceptColor: ReadonlyMap<Uuid, string>;
  /** The entities each table is joined to by at least one mapping. */
  entitiesOfTable: ReadonlyMap<Uuid, ReadonlySet<Uuid>>;
  requirements: ReadonlySet<Uuid>;
  labels: ReadonlySet<Uuid>;
  model: WorkspaceModel;
  labelLinks: readonly LabelLink[];
}

/** The page's index from its live rows: the model, the requirements, the labels and their links. */
export function thumbnailIndex(
  model: WorkspaceModel,
  rest: { requirements: readonly { id: Uuid }[]; labels: readonly { id: Uuid }[]; labelLinks: readonly LabelLink[] },
): ThumbnailIndex {
  const classes = indexOf(model);
  const attributes = new Map(model.attributes.map((a) => [a.id, a]));
  const tableOfColumn = new Map(model.sourceColumns.map((c) => [c.id, c.source_table_id]));
  const inputsOf = new Map<Uuid, Uuid[]>();
  for (const i of model.mappingInputs) (inputsOf.get(i.mapping_id) ?? inputsOf.set(i.mapping_id, []).get(i.mapping_id)!).push(i.source_column_id);
  // mappings per row, counted as `buildCards` counts them: a mapping without its attribute counts nowhere
  const mappings = new Map<Uuid, number>();
  const count = (id: Uuid) => mappings.set(id, (mappings.get(id) ?? 0) + 1);
  const entitiesOfTable = new Map<Uuid, Set<Uuid>>();
  for (const m of model.mappings) {
    const attribute = attributes.get(m.attribute_id);
    if (!attribute) continue;
    count(attribute.id);
    for (const c of inputsOf.get(m.id) ?? []) {
      const table = tableOfColumn.get(c);
      if (table === undefined) continue;
      count(c);
      (entitiesOfTable.get(table) ?? entitiesOfTable.set(table, new Set()).get(table)!).add(attribute.entity_id);
    }
  }
  const rowsOfEntity = new Map<Uuid, Row[]>();
  for (const a of model.attributes) {
    const row = { id: a.id, mappings: mappings.get(a.id) ?? 0, pk: a.is_primary_key, fk: a.is_foreign_key, bk: a.is_business_key };
    (rowsOfEntity.get(a.entity_id) ?? rowsOfEntity.set(a.entity_id, []).get(a.entity_id)!).push(row);
  }
  const rowsOfTable = new Map<Uuid, Row[]>();
  for (const c of model.sourceColumns) {
    const row = { id: c.id, mappings: mappings.get(c.id) ?? 0, pk: c.is_primary_key, fk: c.is_foreign_key, bk: classes.has(c.id, "BK") };
    (rowsOfTable.get(c.source_table_id) ?? rowsOfTable.set(c.source_table_id, []).get(c.source_table_id)!).push(row);
  }
  const conceptColor = new Map(model.concepts.map((c) => [c.id, c.color]));
  const entityColor = new Map(model.entities.map((e) => [e.id, (conceptColor.get(e.concept_id) ?? NO_CONCEPT_COLOR) as ThumbnailColor]));
  return {
    rowsOfEntity,
    rowsOfTable,
    entityColor,
    tables: new Set(model.sourceTables.map((t) => t.id)),
    conceptColor,
    entitiesOfTable,
    requirements: new Set(rest.requirements.map((r) => r.id)),
    labels: new Set(rest.labels.map((l) => l.id)),
    model,
    labelLinks: rest.labelLinks,
  };
}

/** A frame's colour role (the canvas's `frameColor`): its concept's, physical for a source frame, or its own. */
function frameColorOf(f: Frame, ix: ThumbnailIndex): ThumbnailColor {
  if (f.kind === "concept") return ((f.concept_id && ix.conceptColor.get(f.concept_id)) || FREE_FRAME_COLORS[0]) as ThumbnailColor;
  if (f.kind === "source_system") return "physical";
  return (f.color ?? FREE_FRAME_COLORS[0]) as ThumbnailColor;
}

/** One canvas's live rows. */
export interface CanvasRows {
  items: readonly CanvasItem[];
  frames: readonly Frame[];
  notes: readonly Note[];
}

/** One canvas's thumbnail from its live rows. Rows of deleted elements, requirements or labels are not drawn. */
export function canvasThumbnail(canvas: Pick<Canvas, "live_label_id">, rows: CanvasRows, ix: ThumbnailIndex): Thumbnail {
  // a live canvas as the canvas page reads it: only while its label exists (D-10)
  const live = canvas.live_label_id && ix.labels.has(canvas.live_label_id) ? liveMembership(canvas.live_label_id, { ...ix.model, links: ix.labelLinks }) : null;
  const collapsed = new Set(rows.frames.filter((f) => f.collapsed).map((f) => f.id));
  const hidden = (frameId: Uuid | null) => frameId !== null && collapsed.has(frameId);

  // element cards whose entity or table is live; they count as frame members (`memberCounts` of the built cards)
  const elements = rows.items.filter((i) => (i.entity_id ? ix.entityColor.has(i.entity_id) : i.source_table_id ? ix.tables.has(i.source_table_id) : false));
  const members = new Map<Uuid, number>();
  for (const i of elements) if (i.frame_id) members.set(i.frame_id, (members.get(i.frame_id) ?? 0) + 1);

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (r: Rect) => {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.width);
    y1 = Math.max(y1, r.y + r.height);
  };

  // frames, the larger first, so a smaller frame lying on a bigger one is drawn above it (`buildFrames`)
  const frames: ThumbnailRect[] = rows.frames
    .map((f): ThumbnailRect =>
      f.collapsed
        ? { kind: "block", color: frameColorOf(f, ix), x: f.x, y: f.y, width: BLOCK.width, height: blockHeight(members.get(f.id) ?? 0) }
        : { kind: "frame", color: frameColorOf(f, ix), x: f.x, y: f.y, width: f.width, height: f.height },
    )
    .sort((a, b) => b.width * b.height - a.width * a.height);
  frames.forEach(grow);

  const tables: ThumbnailRect[] = [];
  const entities: ThumbnailRect[] = [];
  const entityCentre = new Map<Uuid, { x: number; y: number }>();
  const tableCentres: { table: Uuid; x: number; y: number }[] = [];
  for (const i of elements) {
    if (hidden(i.frame_id)) continue;
    const isEntity = i.entity_id !== null;
    const id = (i.entity_id ?? i.source_table_id)!;
    const all = (isEntity ? ix.rowsOfEntity : ix.rowsOfTable).get(id) ?? [];
    // `labeled` shows only on a live canvas; elsewhere it shows as `all` (`buildCards`)
    const rowFilter = i.row_filter === "labeled" && !live ? "all" : i.row_filter;
    const cardRows = live && rowFilter === "labeled" ? all.map((r) => ({ ...r, relevant: live.relevantRows.has(r.id) })) : all;
    const shape: ThumbnailRect = {
      kind: isEntity ? "entity" : "table",
      color: isEntity ? ix.entityColor.get(id)! : "physical",
      x: i.x,
      y: i.y,
      width: cardWidthOf(i),
      height: cardHeightOf({ rows: cardRows, collapsed: i.collapsed, rowFilter }),
    };
    const centre = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
    if (isEntity) {
      entities.push(shape);
      entityCentre.set(id, centre);
    } else {
      tables.push(shape);
      tableCentres.push({ table: id, ...centre });
    }
    grow(shape);
  }

  // one line per table and entity pair on the canvas joined by a mapping, centre to centre
  const lines: ThumbnailLine[] = [];
  for (const t of tableCentres) {
    for (const entityId of ix.entitiesOfTable.get(t.table) ?? []) {
      const e = entityCentre.get(entityId);
      if (e) lines.push({ kind: "line", color: null, x1: t.x, y1: t.y, x2: e.x, y2: e.y });
    }
  }

  // free notes as the canvas shows them, resolved ones too (D-21: hiding them is the person's choice in the browser)
  const places = notePlaces(elements, rows.frames);
  const notes: ThumbnailRect[] = [];
  for (const n of rows.notes) {
    if (isPinned(n) || !noteVisible(n, places, false)) continue;
    const shape: ThumbnailRect = { kind: "note", color: n.color, x: n.x, y: n.y, width: n.width, height: THUMBNAIL_NOTE_HEIGHT };
    notes.push(shape);
    grow(shape);
  }

  const requirements: ThumbnailRect[] = [];
  for (const i of rows.items) {
    if (i.requirement_id === null || !ix.requirements.has(i.requirement_id)) continue;
    const shape: ThumbnailRect = { kind: "requirement", color: "req", x: i.x, y: i.y, width: REQUIREMENT_CARD_WIDTH, height: THUMBNAIL_REQUIREMENT_HEIGHT };
    requirements.push(shape);
    grow(shape);
  }

  return {
    shapes: [...frames, ...lines, ...tables, ...entities, ...notes, ...requirements],
    bounds: x0 <= x1 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null,
  };
}

/** The thumbnails of these canvases from the workspace's live rows, grouped by canvas once. */
export function canvasThumbnails(
  canvases: readonly Pick<Canvas, "id" | "live_label_id">[],
  rows: CanvasRows,
  ix: ThumbnailIndex,
): Map<Uuid, Thumbnail> {
  const of = new Map<Uuid, { items: CanvasItem[]; frames: Frame[]; notes: Note[] }>(canvases.map((c) => [c.id, { items: [], frames: [], notes: [] }]));
  for (const i of rows.items) of.get(i.canvas_id)?.items.push(i);
  for (const f of rows.frames) of.get(f.canvas_id)?.frames.push(f);
  for (const n of rows.notes) of.get(n.canvas_id)?.notes.push(n);
  return new Map(canvases.map((c) => [c.id, canvasThumbnail(c, of.get(c.id)!, ix)]));
}

// ---- writing it (step 2's answer) ----

/** One path: every shape of one kind and colour, in drawing order. */
export interface ThumbnailPath {
  kind: ThumbnailKind;
  color: ThumbnailColor;
  d: string;
}

/** The drawing: its size in units (the longer side `THUMBNAIL_SPACE`) and its paths; null for an empty canvas. */
export interface ThumbnailDrawing {
  width: number;
  height: number;
  paths: ThumbnailPath[];
}

/**
 * The thumbnail as paths, the content plus its margin scaled to `THUMBNAIL_SPACE` units on its longer side, in whole
 * numbers: a rectangle `M x y h w v h h -w z` (at least 1 unit; no rounded corners, under a pixel at this size), a line
 * `M x y L x y`. One path per kind and colour, in the order their first shapes are drawn.
 */
export function thumbnailDrawing(t: Thumbnail): ThumbnailDrawing | null {
  if (!t.bounds) return null;
  const pad = Math.max(t.bounds.width, t.bounds.height) * THUMBNAIL_MARGIN;
  const bx = t.bounds.x - pad, by = t.bounds.y - pad;
  const bw = t.bounds.width + pad * 2, bh = t.bounds.height + pad * 2;
  const s = THUMBNAIL_SPACE / Math.max(bw, bh, 1);
  const X = (v: number) => Math.round((v - bx) * s);
  const Y = (v: number) => Math.round((v - by) * s);
  const L = (v: number) => Math.max(1, Math.round(v * s));
  const groups = new Map<string, ThumbnailPath>();
  for (const sh of t.shapes) {
    const key = `${sh.kind}|${sh.color ?? ""}`;
    const path = groups.get(key) ?? groups.set(key, { kind: sh.kind, color: sh.color, d: "" }).get(key)!;
    if (sh.kind === "line") path.d += `M${X(sh.x1)} ${Y(sh.y1)}L${X(sh.x2)} ${Y(sh.y2)}`;
    else {
      const w = L(sh.width), h = L(sh.height);
      path.d += `M${X(sh.x)} ${Y(sh.y)}h${w}v${h}h-${w}z`;
    }
  }
  return { width: Math.max(1, Math.round(bw * s)), height: Math.max(1, Math.round(bh * s)), paths: [...groups.values()] };
}
