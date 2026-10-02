"use client";

import { memo, useContext } from "react";
import { useInternalNode, type Edge, type EdgeProps } from "@xyflow/react";
import type { Relationship } from "@/data/generate";
import { CanvasCtx } from "./context";
import { useLineHl } from "./highlight";
import { ieMarker, multText, nodeRect, relGeom, umlMarker } from "./geometry";

export type RelEdgeData = { rel: Relationship; offset: number };
export type RelEdgeT = Edge<RelEdgeData, "rel">;

/*
 * Relationship line between two entity cards. Like MappingEdge, geometry comes from the internal nodes,
 * not React Flow's handle positions, so the line picks sides and the markers sit on the card edge.
 * Markers are drawn as paths (not SVG <marker>) so they can take the IE / UML notation switch and cardinality.
 */
function RelEdge({ id, source, target, data }: EdgeProps<RelEdgeT>) {
  const { notation } = useContext(CanvasCtx);
  const hl = useLineHl(id);
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s || !t || !data) return null;
  const r = data.rel;
  const g = relGeom(nodeRect(s), nodeRect(t), data.offset);

  let marks: React.ReactNode;
  if (notation === "ie") {
    const a = ieMarker(g.pa, g.na, r.fromMin, r.fromMax), b = ieMarker(g.pb, g.nb, r.toMin, r.toMax);
    marks = (
      <>
        <path className="mk" d={a.d + b.d} />
        {a.circle && <circle className="mk" cx={a.circle.x} cy={a.circle.y} r={4} />}
        {b.circle && <circle className="mk" cx={b.circle.x} cy={b.circle.y} r={4} />}
      </>
    );
  } else {
    const a = umlMarker(g.pa, g.na), b = umlMarker(g.pb, g.nb);
    marks = (
      <>
        <text className="mult" x={a.x} y={a.y}>{multText(r.fromMin, r.fromMax)}</text>
        <text className="mult" x={b.x} y={b.y}>{multText(r.toMin, r.toMax)}</text>
      </>
    );
  }

  const lw = r.label ? r.label.length * 6.1 + 14 : 0;
  return (
    <g className={`lnk rel${hl ? " " + hl : ""}`} data-edge={id}>
      <path className="hit" d={g.d} />
      <path className="s" d={g.d} />
      {marks}
      {r.label && (
        <g className="rlab">
          <rect x={g.mid.x - lw / 2} y={g.mid.y - 9} width={lw} height={18} rx={9} />
          <text x={g.mid.x} y={g.mid.y}>{r.label}</text>
        </g>
      )}
    </g>
  );
}

export default memo(RelEdge);
