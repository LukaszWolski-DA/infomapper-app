// Line geometry, independent of how lines are drawn (slice 2p, item 4): where a mapping line runs, from the cards'
// positions in React Flow's store and the rows in the card data (AD-24 rule 2). Used by the SVG line layer and the
// canvas renderer; relationship geometry is `relGeom` in geometry.ts.

import type { InternalNode } from "@xyflow/react";
import type { CardNodeT } from "./CardNode";
import { curve, fNode, rowEnd, type End, type Placed } from "./geometry";
import type { MapLineData } from "./line-data";

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
