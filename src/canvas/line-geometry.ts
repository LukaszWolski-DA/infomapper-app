// Line geometry, independent of how lines are drawn (slice 2p, item 4): where a mapping line runs, from the cards'
// positions in React Flow's store and the rows in the card data (AD-24 rule 2). Used by the SVG line layer and the
// canvas renderer; relationship geometry is `relGeom` in geometry.ts. Slice 2c: bundled lines for collapsed frames.

import type { InternalNode } from "@xyflow/react";
import type { CardNodeT } from "./CardNode";
import type { CanvasLayer } from "@/domain/types";
import { curve, fNode, rowEnd, type End, type Placed, type Rect } from "./geometry";
import type { CanvasLines, MapLineData, RelLineData } from "./line-data";

export const placedOf = (n: InternalNode | undefined): Placed | null =>
  n && !n.hidden ? { x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, card: (n as unknown as CardNodeT).data.card } : null;

export interface MapGeom {
  /** Input curves (to the attribute, or to the ƒ node of a combined mapping) and the ƒ node's line on. */
  paths: string[];
  dots: [number, number][];
  chip: { x: number; y: number; text: string } | null;
  part: boolean;
}

export function mapGeom(line: MapLineData, lookup: Map<string, InternalNode>): MapGeom | null {
  const target = placedOf(lookup.get(line.cardId));
  if (!target) return null;
  const attr = rowEnd(target, line.attributeId);
  const inputs: End[] = [];
  for (const i of line.inputs) {
    const p = placedOf(lookup.get(i.cardId));
    if (p) inputs.push(rowEnd(p, i.columnId));
  }
  if (!inputs.length) return null;
  const part = attr.hidden || inputs.some((e) => e.hidden);
  if (line.inputCount > 1) {
    const f = fNode(attr, inputs);
    const curves = inputs.map((e) => curve(e, f.end));
    return {
      paths: [...curves.map((c) => c.d), f.out],
      dots: [...curves.map((c) => [c.p0.x, c.p0.y] as [number, number]), [f.to.x, f.to.y]],
      chip: { x: f.node.x, y: f.node.y, text: "ƒ" },
      part,
    };
  }
  const g = curve(inputs[0]!, attr);
  const text = line.warn ? "!" : line.ruled ? "ƒ" : "";
  return {
    paths: [g.d],
    dots: [
      [g.p0.x, g.p0.y],
      [g.p3.x, g.p3.y],
    ],
    chip: text ? { x: g.mid.x, y: g.mid.y, text } : null,
    part,
  };
}

// ---- bundled lines (slice 2c, D-07; prototype “Semantic zoom”, endOf) ----
// Every mapping or relationship with an end in a collapsed frame is grouped per pair of ends, where an end is the
// collapsed frame (its block), or a row (mappings: the attribute, or one input column) or an entity card
// (relationships). Lines with both ends in the same collapsed frame are left out. Mapping bundles are directed (from
// the source end to the attribute end); relationship bundles are not. A mapping with several inputs (D-49) gives one
// pair per input, so it can be in more than one bundle (once in each). Bundles are computed, never stored.

/** One end of a bundled line: a collapsed frame, or a row of a card (mappings), or an entity card (relationships). */
export type BundleEnd = { key: `f:${string}`; frameId: string } | { key: `r:${string}`; cardId: string; rowId: string } | { key: `e:${string}`; cardId: string };

export interface Bundle {
  /** Stable while the same ends are bundled: `m|{from}|{to}` or `r|{end}|{end}` (ends sorted). */
  key: string;
  t: "map" | "rel";
  a: BundleEnd;
  z: BundleEnd;
  /** The mappings or relationships in it, each once, in the order of the canvas's lines. */
  ids: string[];
}

export interface BundledLines {
  /** Lines that touch no collapsed frame, drawn as before. */
  mappings: MapLineData[];
  relationships: RelLineData[];
  bundles: Bundle[];
}

/**
 * Groups the canvas's lines for its collapsed frames. `collapsedFrameOf` names the collapsed frame a card is hidden in
 * (null: the card is drawn). The layer mode (D-22) applies to bundles as to lines.
 */
export function bundleLines(lines: CanvasLines, collapsedFrameOf: (cardId: string) => string | null, layer: CanvasLayer = "all"): BundledLines {
  const bundles = new Map<string, Bundle>();
  const add = (t: Bundle["t"], key: string, a: BundleEnd, z: BundleEnd, id: string) => {
    const b = bundles.get(key) ?? bundles.set(key, { key, t, a, z, ids: [] }).get(key)!;
    if (!b.ids.includes(id)) b.ids.push(id);
  };
  const frameEnd = (frameId: string): BundleEnd => ({ key: `f:${frameId}`, frameId });

  const mappings: MapLineData[] = [];
  if (layer !== "relationships") {
    for (const m of lines.mappings) {
      const targetFrame = collapsedFrameOf(m.cardId);
      const inputFrames = m.inputs.map((i) => collapsedFrameOf(i.cardId));
      if (!targetFrame && inputFrames.every((f) => !f)) {
        mappings.push(m);
        continue;
      }
      const z: BundleEnd = targetFrame ? frameEnd(targetFrame) : { key: `r:${m.attributeId}`, cardId: m.cardId, rowId: m.attributeId };
      m.inputs.forEach((i, n) => {
        const f = inputFrames[n];
        if (f && f === targetFrame) return; // both ends in the same collapsed frame
        const a: BundleEnd = f ? frameEnd(f) : { key: `r:${i.columnId}`, cardId: i.cardId, rowId: i.columnId };
        add("map", `m|${a.key}|${z.key}`, a, z, m.id);
      });
    }
  }

  const relationships: RelLineData[] = [];
  if (layer !== "mappings") {
    for (const r of lines.relationships) {
      const fa = collapsedFrameOf(r.fromCardId), fz = collapsedFrameOf(r.toCardId);
      if (!fa && !fz) {
        relationships.push(r);
        continue;
      }
      if (fa && fa === fz) continue;
      const ends = [fa ? frameEnd(fa) : { key: `e:${r.fromCardId}` as const, cardId: r.fromCardId }, fz ? frameEnd(fz) : { key: `e:${r.toCardId}` as const, cardId: r.toCardId }].sort((x, y) =>
        x.key.localeCompare(y.key),
      );
      add("rel", `r|${ends[0]!.key}|${ends[1]!.key}`, ends[0]!, ends[1]!, r.id);
    }
  }
  return { mappings, relationships, bundles: [...bundles.values()] };
}

/** A bundle's stroke grows with its count (prototype: 1.6 + 1.3 · log2 n, at most 4 more). */
export const bundleWidth = (n: number): number => 1.6 + Math.min(4, Math.log2(n) * 1.3);

/** How a mapping bundle is drawn: as draft when all its mappings are drafts, in the warning colour when any has a type problem. */
export function bundleLook(bundle: Bundle, mappings: ReadonlyMap<string, Pick<MapLineData, "status" | "warn">>): { draft: boolean; warn: boolean } {
  const ms = bundle.ids.map((id) => mappings.get(id)).filter((m) => m !== undefined);
  return { draft: ms.length > 0 && ms.every((m) => m.status === "draft"), warn: ms.some((m) => m.warn) };
}

/** A line's end at a collapsed frame's block: the middle of its facing side (curve() picks the side). */
export const blockEnd = (block: Rect): End => ({ x: block.x, w: block.w, y: block.y + block.h / 2, cx: block.x + block.w / 2, hidden: false });
