import { describe, expect, it } from "vitest";
import { bez, HEAD_H, relGeom, type Pt, type Rect } from "./geometry";
import type { CanvasLines, RelLineData } from "./line-data";
import { bundleLines } from "./line-geometry";

// A relationship from an entity to itself (slice 10a, D-61): the loop at the card's top right corner, and which loops
// the line layer draws (collapsed frames, layers).

const card: Rect = { x: 100, y: 200, w: 280, h: 300 };
const corner = { x: card.x + card.w, y: card.y };
const dist = (p: Pt) => Math.hypot(p.x - corner.x, p.y - corner.y);
/** The loop's points at t, from its path (one cubic Bézier). */
const along = (d: string, t: number): Pt => {
  const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const pt = (i: number) => ({ x: n[i]!, y: n[i + 1]! });
  return bez(pt(0), pt(2), pt(4), pt(6), t);
};

describe("the loop (slice 10a, D-61)", () => {
  it("leaves the right edge at the header's middle (from) and comes back through the top edge near the right corner (to)", () => {
    const g = relGeom(card, card, 0, true);
    expect(g.pa).toEqual({ x: corner.x, y: card.y + HEAD_H / 2 });
    expect(g.pb.y).toBe(card.y);
    expect(g.pb.x).toBeLessThan(corner.x);
    expect(g.pb.x).toBeGreaterThan(corner.x - 60);
    expect(g.d.startsWith(`M${g.pa.x},${g.pa.y} C`)).toBe(true);
    expect(g.d.endsWith(` ${g.pb.x},${g.pb.y}`)).toBe(true);
  });

  it("meets the card at right angles: out of the right edge to the right, out of the top edge upwards", () => {
    const g = relGeom(card, card, 0, true);
    expect(g.na).toEqual({ x: 1, y: 0 });
    expect(g.nb).toEqual({ x: 0, y: -1 });
    // the first control point lies straight right of the from end, the second straight above the to end
    const [, , c1x, c1y, c2x, c2y] = g.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(c1y).toBe(g.pa.y);
    expect(c1x).toBeGreaterThan(g.pa.x);
    expect(c2x).toBe(g.pb.x);
    expect(c2y).toBeLessThan(g.pb.y);
  });

  it("puts the label's point outside the card, up and to the right of its corner", () => {
    const { mid } = relGeom(card, card, 0, true);
    expect(mid.x).toBeGreaterThan(corner.x);
    expect(mid.y).toBeLessThan(corner.y);
  });

  it("stays outside the card between its ends", () => {
    const { d } = relGeom(card, card, 0, true);
    for (let t = 0.05; t < 1; t += 0.05) {
      const p = along(d, t);
      expect(p.x > corner.x || p.y < corner.y, `t = ${t.toFixed(2)}`).toBe(true);
    }
  });

  it("nests a second and a third loop outside the first: ends 16 px further from the corner, outer points 22 px further out on both axes, every point further from the corner", () => {
    const [g0, g1, g2] = [0, 16, 32].map((off) => relGeom(card, card, off, true));
    for (const [inner, outer] of [[g0!, g1!], [g1!, g2!]] as const) {
      expect(outer.pa.y - inner.pa.y).toBe(16);
      expect(inner.pb.x - outer.pb.x).toBe(16);
      expect(outer.mid.x - inner.mid.x).toBeCloseTo(22, 5);
      expect(inner.mid.y - outer.mid.y).toBeCloseTo(22, 5); // more than a label's height (18 px) apart
    }
    for (let t = 0; t <= 1; t += 0.1) {
      expect(dist(along(g1!.d, t))).toBeGreaterThan(dist(along(g0!.d, t)));
      expect(dist(along(g2!.d, t))).toBeGreaterThan(dist(along(g1!.d, t)));
    }
  });

  it("follows the card: a move, a width change and a collapsed card", () => {
    const g = relGeom(card, card, 0, true);
    const moved = relGeom({ ...card, x: card.x + 40, y: card.y - 24 }, { ...card, x: card.x + 40, y: card.y - 24 }, 0, true);
    expect(moved.pa).toEqual({ x: g.pa.x + 40, y: g.pa.y - 24 });
    expect(moved.pb).toEqual({ x: g.pb.x + 40, y: g.pb.y - 24 });
    const wide = { ...card, w: 400 };
    expect(relGeom(wide, wide, 0, true).pa.x).toBe(card.x + 400);
    // collapsed: the header only; the from end stays on the card, nested loops included
    const collapsed = { ...card, h: HEAD_H };
    for (const off of [0, 16, 32, 48]) {
      const c = relGeom(collapsed, collapsed, off, true);
      expect(c.pa.y, `offset ${off}`).toBeLessThan(collapsed.y + collapsed.h);
      expect(c.pa.x).toBe(corner.x);
    }
    expect(relGeom(collapsed, collapsed, 0, true).pa).toEqual(g.pa);
  });

  it("joins two cards as before when the ends are on two cards", () => {
    const other = { ...card, x: 600 };
    expect(relGeom(card, other, 0)).toEqual(relGeom(card, other, 0, false));
    expect(relGeom(card, other, 0).pa).toEqual({ x: corner.x, y: card.y + HEAD_H / 2 });
  });
});

const self = (id: string, cardId: string, offset = 0): RelLineData => ({ id, fromCardId: cardId, toCardId: cardId, label: null, fromMin: 0, fromMax: "1", toMin: 0, toMax: "n", offset });
const lines: CanvasLines = { mappings: [], relationships: [self("loop", "cust"), self("loop2", "cust", 16), self("other", "line"), { ...self("r1", "cust"), toCardId: "line" }] };
const inC = (cardId: string) => (cardId === "cust" ? "C" : null);

describe("which loops the line layer draws (slice 10a, item 13)", () => {
  it("draws a loop of a card in no collapsed frame as it is, nested ones with their offsets", () => {
    expect(bundleLines(lines, () => null).relationships.map((r) => [r.id, r.offset])).toEqual([["loop", 0], ["loop2", 16], ["other", 0], ["r1", 0]]);
  });

  it("draws no loop of a member of a collapsed frame and counts it in no bundle", () => {
    const b = bundleLines(lines, inC);
    expect(b.relationships.map((r) => r.id)).toEqual(["other"]);
    expect(b.bundles.flatMap((x) => x.ids)).toEqual(["r1"]); // the one line that leaves the frame
  });

  it("hides loops in Mappings and shows them in Relationships and Everything", () => {
    expect(bundleLines(lines, () => null, "mappings").relationships).toEqual([]);
    expect(bundleLines(lines, () => null, "relationships").relationships.map((r) => r.id)).toContain("loop");
    expect(bundleLines(lines, () => null, "all").relationships.map((r) => r.id)).toContain("loop");
  });
});
