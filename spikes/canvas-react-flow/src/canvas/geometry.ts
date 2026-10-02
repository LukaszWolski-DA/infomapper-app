import type { InternalNode } from "@xyflow/react";
import { HEAD_H } from "@/data/generate";

/*
 * Line geometry, ported from the prototype (curve(), bez()).
 * Ends are taken from React Flow's measured handle bounds, so they follow whatever the DOM actually rendered.
 */

export interface Pt { x: number; y: number }
export interface End {
  x: number; // card left
  w: number; // card width
  y: number; // anchor y
  cx: number; // card centre x
  hidden: boolean; // row not rendered → anchored to the header
}

/** Anchor of a row on a card; falls back to the header when the row is hidden (collapse, filter). */
export function rowEnd(node: InternalNode, rowId: string): End {
  const x = node.internals.positionAbsolute.x;
  const w = node.measured.width ?? node.width ?? 0;
  const hb = node.internals.handleBounds?.source ?? [];
  const h = hb.find(b => b.id === rowId + ":l");
  const y = node.internals.positionAbsolute.y + (h ? h.y + h.height / 2 : HEAD_H / 2);
  return { x, w, y, cx: x + w / 2, hidden: !h };
}

export const bez = (a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
};

/** Curve between two card ends, leaving and entering on the sides that face each other. */
export function curve(a: End, b: End) {
  const ltr = a.cx <= b.cx, sn = ltr ? 1 : -1;
  const p0 = { x: ltr ? a.x + a.w : a.x, y: a.y };
  const p3 = { x: ltr ? b.x : b.x + b.w, y: b.y };
  const k = Math.max(60, Math.abs(p3.x - p0.x) * 0.45);
  const p1 = { x: p0.x + sn * k, y: p0.y }, p2 = { x: p3.x - sn * k, y: p3.y };
  return { d: `M${p0.x},${p0.y} C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`, mid: bez(p0, p1, p2, p3, 0.5), p0, p3 };
}

/* ---------- relationships (prototype relGeomRects, ieMarker, umlMarker) ---------- */

export interface Rect { x: number; y: number; w: number; h: number }

export const nodeRect = (n: InternalNode): Rect => ({
  x: n.internals.positionAbsolute.x,
  y: n.internals.positionAbsolute.y,
  w: n.measured.width ?? n.width ?? 0,
  h: n.measured.height ?? n.height ?? HEAD_H,
});

/** Side-to-side when the cards are apart horizontally, otherwise top/bottom; anchored at header height like the prototype. */
export function relGeom(A: Rect, B: Rect, off: number) {
  let pa: Pt, pb: Pt, na: Pt, nb: Pt;
  if (A.x + A.w + 24 < B.x || B.x + B.w + 24 < A.x) {
    const aLeft = A.x < B.x;
    pa = { x: aLeft ? A.x + A.w : A.x, y: A.y + HEAD_H / 2 + off }; na = { x: aLeft ? 1 : -1, y: 0 };
    pb = { x: aLeft ? B.x : B.x + B.w, y: B.y + HEAD_H / 2 + off }; nb = { x: -na.x, y: 0 };
  } else {
    const aTop = A.y < B.y;
    pa = { x: A.x + A.w / 2 + off, y: aTop ? A.y + A.h : A.y }; na = { x: 0, y: aTop ? 1 : -1 };
    pb = { x: B.x + B.w / 2 + off, y: aTop ? B.y : B.y + B.h }; nb = { x: 0, y: -na.y };
  }
  const dist = Math.hypot(pb.x - pa.x, pb.y - pa.y), k = Math.max(40, dist * 0.4);
  const c1 = { x: pa.x + na.x * k, y: pa.y + na.y * k }, c2 = { x: pb.x + nb.x * k, y: pb.y + nb.y * k };
  return { d: `M${pa.x},${pa.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${pb.x},${pb.y}`, mid: bez(pa, c1, c2, pb, 0.5), pa, pb, na, nb };
}

/** Crow's-foot (IE) end marker: many = foot, one = bar; optional = circle, mandatory = second bar. */
export function ieMarker(p: Pt, n: Pt, min: 0 | 1, max: "1" | "N") {
  const t = { x: -n.y, y: n.x };
  let d = "";
  if (max === "N") {
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

export const multText = (min: 0 | 1, max: "1" | "N") => (max === "N" ? (min ? "1..*" : "0..*") : min ? "1" : "0..1");

/** UML end: multiplicity text beside the end. */
export function umlMarker(p: Pt, n: Pt) {
  const t = { x: -n.y, y: n.x };
  return { x: p.x + n.x * 16 + t.x * 11, y: p.y + n.y * 16 + t.y * 11 };
}
