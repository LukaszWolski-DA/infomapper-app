"use client";

import { memo, useContext } from "react";
import { EdgeLabelRenderer, useStore, useStoreApi, type InternalNode } from "@xyflow/react";
import type { Relationship } from "@/data/generate";
import { CanvasCtx } from "./context";
import { useLineHl } from "./highlight";
import { curve, frameEnd, ieMarker, LOD_ZOOM, multText, nodeRect, relGeom, rowEnd, umlMarker, type End } from "./geometry";

/*
 * Follow-up step 3: every line in one <svg> inside the viewport, instead of one React Flow edge (and one <svg>) per line.
 * Positions come from React Flow's store (nodeLookup); row positions come from the card data (geometry.rowEnd).
 * The layer is portalled into React Flow's edge-label container, which sits in the viewport before the nodes,
 * so the lines pan and zoom with the canvas and paint above frames and below cards, like the edges did.
 */

export type MapLine = { id: string; kind: "map"; source: string; target: string; column: string; attribute: string };
export type RelLine = { id: string; kind: "rel"; source: string; target: string; rel: Relationship; offset: number };
/** Merged line for a collapsed frame (D-07): one per frame ↔ target card, with a count. */
export type BundleLine = {
  id: string; kind: "bundle"; source: string; target: string;
  lineKind: "map" | "rel"; ids: string[]; sourceRow: string | null; targetRow: string | null;
};
export type Line = MapLine | RelLine | BundleLine;

/* Lines re-render only when their geometry string changes; highlight comes from their own store subscription. */
const sameSig = (a: { sig: string }, b: { sig: string }) => a.sig === b.sig;

const MapPath = memo(function MapPath({ id, d, p0, p3, part, dots }: {
  sig: string; id: string; d: string; p0: [number, number]; p3: [number, number]; part: boolean; dots: boolean;
}) {
  const hl = useLineHl(id);
  return (
    <g className={`lnk map${part ? " part" : ""}${hl ? " " + hl : ""}`} data-edge={id} data-x0={p0[0]} data-y0={p0[1]} data-x1={p3[0]} data-y1={p3[1]}>
      <path className="hit" d={d} />
      <path className="s" d={d} />
      {dots && <circle className="end" cx={p0[0]} cy={p0[1]} r={2.6} />}
      {dots && <circle className="end" cx={p3[0]} cy={p3[1]} r={2.6} />}
    </g>
  );
}, sameSig);

const RelPath = memo(function RelPath({ line, a, z }: { sig: string; line: RelLine; a: InternalNode; z: InternalNode }) {
  const { notation } = useContext(CanvasCtx);
  const hl = useLineHl(line.id);
  const r = line.rel;
  const g = relGeom(nodeRect(a), nodeRect(z), line.offset);
  let marks: React.ReactNode;
  if (notation === "ie") {
    const ma = ieMarker(g.pa, g.na, r.fromMin, r.fromMax), mb = ieMarker(g.pb, g.nb, r.toMin, r.toMax);
    marks = (
      <>
        <path className="mk" d={ma.d + mb.d} />
        {ma.circle && <circle className="mk" cx={ma.circle.x} cy={ma.circle.y} r={4} />}
        {mb.circle && <circle className="mk" cx={mb.circle.x} cy={mb.circle.y} r={4} />}
      </>
    );
  } else {
    const ma = umlMarker(g.pa, g.na), mb = umlMarker(g.pb, g.nb);
    marks = (
      <>
        <text className="mult" x={ma.x} y={ma.y}>{multText(r.fromMin, r.fromMax)}</text>
        <text className="mult" x={mb.x} y={mb.y}>{multText(r.toMin, r.toMax)}</text>
      </>
    );
  }
  const lw = r.label ? r.label.length * 6.1 + 14 : 0;
  return (
    <g className={`lnk rel${hl ? " " + hl : ""}`} data-edge={line.id}>
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
}, (p, q) => p.sig === q.sig);

const bundleEnd = (n: InternalNode, row: string | null): End => (n.type === "frame" ? frameEnd(n) : rowEnd(n, row ?? ""));

const BundlePath = memo(function BundlePath({ line, a, z, dots }: { sig: string; line: BundleLine; a: InternalNode; z: InternalNode; dots: boolean }) {
  const hl = useLineHl(line.ids);
  const n = line.ids.length;
  const sw = 1.6 + Math.min(4, Math.log2(n) * 1.3);
  if (line.lineKind === "rel") {
    const g = relGeom(nodeRect(a), nodeRect(z), 0);
    const lab = `${n} relationship${n > 1 ? "s" : ""}`, w = lab.length * 6.1 + 14;
    return (
      <g className={`lnk rel bundle${hl ? " " + hl : ""}`} data-edge={line.id} data-count={n}>
        <path className="hit" d={g.d} />
        <path className="s" d={g.d} style={{ strokeWidth: sw }} />
        <g className="rlab">
          <rect x={g.mid.x - w / 2} y={g.mid.y - 9} width={w} height={18} rx={9} />
          <text x={g.mid.x} y={g.mid.y}>{lab}</text>
        </g>
      </g>
    );
  }
  const g = curve(bundleEnd(a, line.sourceRow), bundleEnd(z, line.targetRow));
  const r = n > 9 ? 10 : 8.5;
  return (
    <g className={`lnk map bundle${hl ? " " + hl : ""}`} data-edge={line.id} data-count={n} data-x0={g.p0.x} data-y0={g.p0.y} data-x1={g.p3.x} data-y1={g.p3.y}>
      <path className="hit" d={g.d} />
      <path className="s" d={g.d} style={{ strokeWidth: sw }} />
      {n > 1 ? (
        <g className="chip">
          <circle cx={g.mid.x} cy={g.mid.y} r={r} />
          <text x={g.mid.x} y={g.mid.y}>{n}</text>
        </g>
      ) : dots ? (
        <>
          <circle className="end" cx={g.p0.x} cy={g.p0.y} r={2.6} />
          <circle className="end" cx={g.p3.x} cy={g.p3.y} r={2.6} />
        </>
      ) : null}
    </g>
  );
}, (p, q) => p.sig === q.sig);

/* Signature of a node's geometry as the lines see it: position, size and the card state that moves rows. */
const nodeSig = (n: InternalNode) => {
  const p = n.internals.positionAbsolute;
  const d = n.data as { collapsed?: boolean; filter?: string };
  return `${p.x},${p.y},${n.measured.width ?? n.width},${n.measured.height ?? n.height},${d.collapsed ? 1 : 0}${d.filter ?? ""}`;
};

function LineLayer({ lines }: { lines: Line[] }) {
  // re-render on any node change (drag, resize, measure, collapse); panning and zooming leave `nodes` alone
  useStore(s => s.nodes);
  const lod = useStore(s => s.transform[2] < LOD_ZOOM);
  const { notation } = useContext(CanvasCtx);
  const lookup = useStoreApi().getState().nodeLookup;
  const dots = !lod;

  const out: React.ReactNode[] = [];
  for (const l of lines) {
    const a = lookup.get(l.source), z = lookup.get(l.target);
    if (!a || !z || a.hidden || z.hidden) continue;
    if (l.kind === "map") {
      const ea = rowEnd(a, l.column), ez = rowEnd(z, l.attribute);
      const g = curve(ea, ez);
      const part = ea.hidden || ez.hidden;
      out.push(
        <MapPath key={l.id} sig={`${g.d}|${part}|${dots}`} id={l.id} d={g.d} p0={[g.p0.x, g.p0.y]} p3={[g.p3.x, g.p3.y]} part={part} dots={dots} />,
      );
    } else if (l.kind === "rel") {
      out.push(<RelPath key={l.id} sig={`${nodeSig(a)}|${nodeSig(z)}|${notation}`} line={l} a={a} z={z} />);
    } else {
      out.push(<BundlePath key={l.id} sig={`${nodeSig(a)}|${nodeSig(z)}|${dots}|${l.ids.length}`} line={l} a={a} z={z} dots={dots} />);
    }
  }
  return (
    <EdgeLabelRenderer>
      <svg className="line-layer" width={1} height={1}>{out}</svg>
    </EdgeLabelRenderer>
  );
}

export default memo(LineLayer);
