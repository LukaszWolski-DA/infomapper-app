"use client";

import { memo } from "react";
import { useInternalNode, type Edge, type EdgeProps, type InternalNode } from "@xyflow/react";
import { useLineHl } from "./highlight";
import { curve, nodeRect, relGeom, rowEnd, type End } from "./geometry";

/*
 * Merged line for a collapsed frame (D-07): one line per frame ↔ target card, with a count.
 * An end on a collapsed frame anchors to the block's middle; an end on a card anchors to its row when all
 * merged mappings land on one row, otherwise to the card header.
 */
export type BundleEdgeData = {
  kind: "map" | "rel";
  ids: string[];
  sourceRow: string | null;
  targetRow: string | null;
};
export type BundleEdgeT = Edge<BundleEdgeData, "bundle">;

function end(n: InternalNode, row: string | null): End {
  if (n.type === "frame") {
    const r = nodeRect(n);
    return { x: r.x, w: r.w, y: r.y + r.h / 2, cx: r.x + r.w / 2, hidden: false };
  }
  return rowEnd(n, row ?? "");
}

function BundleEdge({ id, source, target, data }: EdgeProps<BundleEdgeT>) {
  const hl = useLineHl(data?.ids ?? []);
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s || !t || !data) return null;
  const n = data.ids.length;
  const sw = 1.6 + Math.min(4, Math.log2(n) * 1.3);

  if (data.kind === "rel") {
    const g = relGeom(nodeRect(s), nodeRect(t), 0);
    const lab = `${n} relationship${n > 1 ? "s" : ""}`, w = lab.length * 6.1 + 14;
    return (
      <g className={`lnk rel bundle${hl ? " " + hl : ""}`} data-edge={id} data-count={n}>
        <path className="hit" d={g.d} />
        <path className="s" d={g.d} style={{ strokeWidth: sw }} />
        <g className="rlab">
          <rect x={g.mid.x - w / 2} y={g.mid.y - 9} width={w} height={18} rx={9} />
          <text x={g.mid.x} y={g.mid.y}>{lab}</text>
        </g>
      </g>
    );
  }

  const g = curve(end(s, data.sourceRow), end(t, data.targetRow));
  const r = n > 9 ? 10 : 8.5;
  return (
    <g className={`lnk map bundle${hl ? " " + hl : ""}`} data-edge={id} data-count={n} data-x0={g.p0.x} data-y0={g.p0.y} data-x1={g.p3.x} data-y1={g.p3.y}>
      <path className="hit" d={g.d} />
      <path className="s" d={g.d} style={{ strokeWidth: sw }} />
      {n > 1 ? (
        <g className="chip">
          <circle cx={g.mid.x} cy={g.mid.y} r={r} />
          <text x={g.mid.x} y={g.mid.y}>{n}</text>
        </g>
      ) : (
        <>
          <circle className="end" cx={g.p0.x} cy={g.p0.y} r={2.6} />
          <circle className="end" cx={g.p3.x} cy={g.p3.y} r={2.6} />
        </>
      )}
    </g>
  );
}

export default memo(BundleEdge);
