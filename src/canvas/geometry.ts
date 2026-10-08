// Canvas geometry, as in the prototype: card sizes come from data (header, body padding, row height and the rows a
// card shows), never from measuring the DOM (AD-24 rule 2). Pure functions, tested without a browser.

import { CARD_HEADER_HEIGHT, DEFAULT_CARD_WIDTH } from "@/domain/model/frames";
import { visibleRows, type CardData } from "./card-data";

/** Default card width (D-37), header height, row height and body padding: prototype W, H, R, PAD. The first two are
 * the domain's, because frame membership is decided by the middle of a card's header (D-05). */
export const CARD_W = DEFAULT_CARD_WIDTH;
/** A card can be made 200–600 px wide, in steps of 8 (D-37, C-09). */
export const CARD_W_MIN = 200;
export const CARD_W_MAX = 600;
export const HEAD_H = CARD_HEADER_HEIGHT;
export const ROW_H = 26;
export const BODY_PAD = 6;

/** Below this zoom cards draw the header and a plain block instead of rows (AD-24 rule 1). */
export const LOD_ZOOM = 0.4;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 3;
/** Fit never zooms in further than this (prototype fitRect). */
export const FIT_MAX_ZOOM = 1.1;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const cardWidth = (card: Pick<CardData, "width">): number => card.width ?? CARD_W;

/** Height of a card: the header only when collapsed, else header, padding and its shown rows (at least one line). */
export function cardHeight(card: Pick<CardData, "rows" | "collapsed" | "rowFilter">): number {
  if (card.collapsed) return HEAD_H;
  return HEAD_H + BODY_PAD * 2 + Math.max(1, visibleRows(card).length) * ROW_H;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** The box around all cards, or null for an empty canvas. */
export function contentBounds(cards: readonly Pick<CardData, "x" | "y" | "width" | "rows" | "collapsed" | "rowFilter">[]): Rect | null {
  if (!cards.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of cards) {
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x + cardWidth(c));
    y1 = Math.max(y1, c.y + cardHeight(c));
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * The view that shows a box (prototype fitRect): 40 px padding, and on wide screens the bottom-right overview panel
 * is kept clear. An empty canvas gets 100 % at (40, 40).
 */
export function fitViewport(bounds: Rect | null, screen: { width: number; height: number }, overviewOpen: boolean): Viewport {
  if (!bounds) return { x: 40, y: 40, zoom: 1 };
  const pad = 40;
  const padRight = overviewOpen && screen.width > 700 ? 250 : pad;
  const aw = Math.max(1, screen.width - pad - padRight);
  const ah = Math.max(1, screen.height - pad * 2);
  const zoom = clamp(Math.min(aw / Math.max(1, bounds.w), ah / Math.max(1, bounds.h)), MIN_ZOOM, FIT_MAX_ZOOM);
  return { zoom, x: pad + (aw - bounds.w * zoom) / 2 - bounds.x * zoom, y: pad + (ah - bounds.h * zoom) / 2 - bounds.y * zoom };
}

/** Zooming by a factor around the middle of the screen (prototype zoomBy), within 10–300 %. */
export function zoomAround(v: Viewport, factor: number, screen: { width: number; height: number }): Viewport {
  const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const mx = screen.width / 2, my = screen.height / 2;
  return { zoom, x: mx - ((mx - v.x) * zoom) / v.zoom, y: my - ((my - v.y) * zoom) / v.zoom };
}

// ---- placing new cards (prototype placeNear, createEntity) ----

/** Space kept free around a new card. */
const PLACE_GAP = 24;
/** Height assumed for a new entity, which has no rows yet (prototype createEntity). */
export const NEW_CARD_H = 140;

export const snap8 = (v: number) => Math.round(v / 8) * 8;

/** Height of a new, expanded card with this many rows. */
export const newCardHeight = (rows: number) => HEAD_H + BODY_PAD * 2 + Math.max(1, rows) * ROW_H;

const clashes = (occupied: readonly Rect[], x: number, y: number, w: number, h: number) =>
  occupied.some((r) => x < r.x + r.w + PLACE_GAP && x + w + PLACE_GAP > r.x && y < r.y + r.h + PLACE_GAP && y + h + PLACE_GAP > r.y);

/**
 * Where a clicked item from the left panel lands (prototype placeNear): in the middle of the view, 80 px below its
 * top, moved down until it covers no other card.
 */
export function stackSpot(view: Rect, occupied: readonly Rect[], h: number, w = CARD_W): Pt {
  const x = snap8(view.x + view.w / 2 - w / 2);
  let y = snap8(view.y + 80);
  for (let n = 0; n < 600 && clashes(occupied, x, y, w, h); n++) y += 16;
  return { x, y };
}

/**
 * Where a new entity from "+" lands (prototype createEntity, D-46): the first free spot on rings of 48 px around a
 * point in the middle of the view, a third down from its top.
 */
export function freeSpot(view: Rect, occupied: readonly Rect[], h = NEW_CARD_H, w = CARD_W): Pt {
  const cx = view.x + view.w / 2 - w / 2, cy = view.y + view.h / 3;
  const dirs = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const;
  for (let ring = 0; ring < 40; ring++) {
    for (const [dx, dy] of dirs) {
      const x = cx + dx * ring * 48, y = cy + dy * ring * 48;
      if (!clashes(occupied, x, y, w, h)) return { x: snap8(x), y: snap8(y) };
    }
  }
  return { x: snap8(cx), y: snap8(cy) };
}

/** Gap between a card and the cards placed beside it (prototype placeNear). */
export const BESIDE_GAP = 160;

/**
 * Where feeding sources (left) or fed entities (right) land next to a card (prototype placeNear, B-08): a column
 * 160 px beside it, from its top down, each card moved down until it covers no other card, 32 px apart.
 */
export function besideSpots(anchor: Rect, side: "left" | "right", heights: readonly number[], occupied: readonly Rect[], w = CARD_W): Pt[] {
  const x = snap8(side === "left" ? anchor.x - w - BESIDE_GAP : anchor.x + anchor.w + BESIDE_GAP);
  const taken = [...occupied];
  const spots: Pt[] = [];
  let y = snap8(anchor.y);
  for (const h of heights) {
    for (let n = 0; n < 600 && clashes(taken, x, y, w, h); n++) y += 16;
    spots.push({ x, y });
    taken.push({ x, y, w, h });
    y = snap8(y + h + 32);
  }
  return spots;
}

/** Whether a box lies fully inside the view. */
export const inside = (view: Rect, r: Rect) => r.x >= view.x && r.y >= view.y && r.x + r.w <= view.x + view.w && r.y + r.h <= view.y + view.h;

// ---- lines (prototype rowY, endOf, curve, relGeomRects, ieMarker, umlMarker) ----

export interface Pt {
  x: number;
  y: number;
}

/** A card where it is now: React Flow's position, the card's width and its data (rows, collapse, filter). */
export interface Placed {
  x: number;
  y: number;
  card: Pick<CardData, "rows" | "collapsed" | "rowFilter" | "width">;
}

/** One end of a line on a card: the card's left edge and width, and the anchor height. */
export interface End {
  x: number;
  w: number;
  y: number;
  cx: number;
  /** The row is not shown (collapsed card, row filter): the line re-anchors to the header. */
  hidden: boolean;
}

/** Where a row's line starts or ends; a hidden row anchors at the middle of the header. */
/**
 * Where each visible row of a card is, by row id; built once per card object (a changed card is a new object), so a
 * drag does not filter a card's rows again for every line end on every frame (slice 2a step 3b).
 */
const rowIndexOf = new WeakMap<object, Map<string, number>>();
function rowIndex(card: Placed["card"], rowId: string): number {
  let index = rowIndexOf.get(card);
  if (!index) {
    index = new Map(visibleRows(card).map((r, i) => [r.id, i]));
    rowIndexOf.set(card, index);
  }
  return index.get(rowId) ?? -1;
}

export function rowEnd(p: Placed, rowId: string): End {
  const w = cardWidth(p.card);
  const i = rowIndex(p.card, rowId);
  const y = i < 0 ? p.y + HEAD_H / 2 : p.y + HEAD_H + BODY_PAD + i * ROW_H + ROW_H / 2;
  return { x: p.x, w, y, cx: p.x + w / 2, hidden: i < 0 };
}

export const bez = (a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
};

/** A curve between two ends, leaving and entering on the sides that face each other. */
export function curve(a: End, b: End) {
  const ltr = a.cx <= b.cx, sn = ltr ? 1 : -1;
  const p0 = { x: ltr ? a.x + a.w : a.x, y: a.y };
  const p3 = { x: ltr ? b.x : b.x + b.w, y: b.y };
  const k = Math.max(60, Math.abs(p3.x - p0.x) * 0.45);
  const p1 = { x: p0.x + sn * k, y: p0.y }, p2 = { x: p3.x - sn * k, y: p3.y };
  return { d: `M${p0.x},${p0.y} C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`, mid: bez(p0, p1, p2, p3, 0.5), p0, p3 };
}

/** Distance of the ƒ node from the attribute's card edge (D-49). */
export const F_NODE_GAP = 36;

/**
 * A combined mapping (D-49): the inputs meet in an ƒ node next to the attribute, on the side facing the inputs, and
 * one line continues to the attribute's row. Returns the node and the end the input curves go to.
 */
export function fNode(attribute: End, inputs: readonly End[]) {
  const mean = inputs.reduce((s, e) => s + e.cx, 0) / Math.max(1, inputs.length);
  const left = mean <= attribute.cx;
  const node = { x: left ? attribute.x - F_NODE_GAP : attribute.x + attribute.w + F_NODE_GAP, y: attribute.y };
  const to = { x: left ? attribute.x : attribute.x + attribute.w, y: attribute.y };
  const end: End = { x: node.x, w: 0, y: node.y, cx: node.x, hidden: false };
  return { node, end, out: `M${node.x},${node.y} L${to.x},${to.y}`, to };
}

/** The rectangle of a card for relationship lines. */
export const cardRect = (p: Placed): Rect => ({ x: p.x, y: p.y, w: cardWidth(p.card), h: cardHeight(p.card) });

/** Side to side when the cards are apart horizontally, otherwise top to bottom; anchored at header height. */
export function relGeom(A: Rect, B: Rect, off: number) {
  let pa: Pt, pb: Pt, na: Pt, nb: Pt;
  if (A.x + A.w + 24 < B.x || B.x + B.w + 24 < A.x) {
    const aLeft = A.x < B.x;
    pa = { x: aLeft ? A.x + A.w : A.x, y: A.y + HEAD_H / 2 + off };
    na = { x: aLeft ? 1 : -1, y: 0 };
    pb = { x: aLeft ? B.x : B.x + B.w, y: B.y + HEAD_H / 2 + off };
    nb = { x: -na.x, y: 0 };
  } else {
    const aTop = A.y < B.y;
    pa = { x: A.x + A.w / 2 + off, y: aTop ? A.y + A.h : A.y };
    na = { x: 0, y: aTop ? 1 : -1 };
    pb = { x: B.x + B.w / 2 + off, y: aTop ? B.y : B.y + B.h };
    nb = { x: 0, y: -na.y };
  }
  const dist = Math.hypot(pb.x - pa.x, pb.y - pa.y), k = Math.max(40, dist * 0.4);
  const c1 = { x: pa.x + na.x * k, y: pa.y + na.y * k }, c2 = { x: pb.x + nb.x * k, y: pb.y + nb.y * k };
  return { d: `M${pa.x},${pa.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${pb.x},${pb.y}`, mid: bez(pa, c1, c2, pb, 0.5), pa, pb, na, nb };
}

/** Crow's foot end: many = foot, one = bar; optional = circle, mandatory = a second bar. */
export function ieMarker(p: Pt, n: Pt, min: 0 | 1, max: "1" | "n") {
  const t = { x: -n.y, y: n.x };
  let d = "";
  if (max === "n") {
    const tip = { x: p.x + n.x * 14, y: p.y + n.y * 14 };
    d += `M${tip.x},${tip.y}L${p.x + t.x * 7},${p.y + t.y * 7}M${tip.x},${tip.y}L${p.x},${p.y}M${tip.x},${tip.y}L${p.x - t.x * 7},${p.y - t.y * 7}`;
  } else {
    const b = { x: p.x + n.x * 9, y: p.y + n.y * 9 };
    d += `M${b.x + t.x * 6},${b.y + t.y * 6}L${b.x - t.x * 6},${b.y - t.y * 6}`;
  }
  const q = { x: p.x + n.x * 22, y: p.y + n.y * 22 };
  if (min !== 0) d += `M${q.x + t.x * 6},${q.y + t.y * 6}L${q.x - t.x * 6},${q.y - t.y * 6}`;
  return { d, circle: min === 0 ? q : null };
}

/** UML multiplicity, written next to the end. */
export const multText = (min: 0 | 1, max: "1" | "n") => (max === "n" ? (min ? "1..*" : "0..*") : min ? "1" : "0..1");

export function umlMarker(p: Pt, n: Pt): Pt {
  const t = { x: -n.y, y: n.x };
  return { x: p.x + n.x * 16 + t.x * 11, y: p.y + n.y * 16 + t.y * 11 };
}

// ---- auto-scroll while dragging (prototype autoPan) ----

/** Within this distance of the canvas edge, a drag scrolls the view. */
export const EDGE_ZONE = 56;
/** Scroll per frame at the very edge, in screen pixels. */
export const EDGE_SPEED = 18;

/**
 * How far to move the view this frame while dragging at screen point `pt` over the canvas `box`: towards the edge the
 * pointer is near, faster the closer it is (and faster still beyond it). The view moves, so content slides in from
 * that side: positive x moves the content right (the pointer is at the left edge).
 */
export function edgePush(pt: Pt, box: { left: number; top: number; right: number; bottom: number }): Pt {
  const push = (d: number) => (d < EDGE_ZONE ? Math.ceil(((EDGE_ZONE - d) / EDGE_ZONE) * EDGE_SPEED) : 0);
  return { x: push(pt.x - box.left) - push(box.right - pt.x), y: push(pt.y - box.top) - push(box.bottom - pt.y) };
}
