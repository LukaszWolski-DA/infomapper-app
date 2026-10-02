"use client";

import { memo } from "react";
import { useInternalNode, type Edge, type EdgeProps } from "@xyflow/react";
import { curve, rowEnd } from "./geometry";
import { useLineHl } from "./highlight";

export type MappingEdgeData = { column: string; attribute: string };
export type MappingEdgeT = Edge<MappingEdgeData, "map">;

/*
 * Mapping line: column row → attribute row.
 * React Flow passes positions for the declared handles, but those are fixed sides. We ignore them and
 * compute both ends from the internal nodes, so the line picks the facing sides and re-anchors to the header
 * when its row is hidden.
 */
function MappingEdge({ id, source, target, data }: EdgeProps<MappingEdgeT>) {
  const hl = useLineHl(id);
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s || !t || !data) return null;
  const a = rowEnd(s, data.column), z = rowEnd(t, data.attribute);
  const g = curve(a, z);
  const part = a.hidden || z.hidden;
  return (
    <g className={`lnk map${part ? " part" : ""}${hl ? " " + hl : ""}`} data-edge={id} data-x0={g.p0.x} data-y0={g.p0.y} data-x1={g.p3.x} data-y1={g.p3.y}>
      <path className="hit" d={g.d} />
      <path className="s" d={g.d} />
      <circle className="end" cx={g.p0.x} cy={g.p0.y} r={2.6} />
      <circle className="end" cx={g.p3.x} cy={g.p3.y} r={2.6} />
    </g>
  );
}

export default memo(MappingEdge);
