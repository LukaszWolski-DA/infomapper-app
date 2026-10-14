"use client";

// Fading, candidate F4 (slice 4p, step 2): one veil on a compositing layer of its own, in the overlay above the cards,
// in the canvas background's colour at 75 % (cards at about the prototype's 25 %), with a hole for every lit card, block
// and note; the lit lines and the lens's rows drawn again above it. Nothing in the viewport's big layer is restyled,
// moved or re-ordered, so switching repaints only the veil's and the overlay's layers. The holes follow the nodes
// (drags, resizes, collapses); panning and zooming move the veil with the viewport, with no script per frame. It reads
// the fading request from its store, so switching never re-renders the canvas.

import { useEffect } from "react";
import { useStore } from "@xyflow/react";
import type { CardNodeT } from "./CardNode";
import { LitLines } from "./LineLayer";
import { LitRows, litNodeIds, nodeRect, useLit, type FadeData, type FadeNote } from "./fade-canvas";
import type { CanvasLines, MapLineData } from "./line-data";
import type { Bundle } from "./line-geometry";
import type { Rect } from "./geometry";

export interface FadeLayerProps {
  data: FadeData | undefined;
  notes: readonly FadeNote[];
  lines: CanvasLines;
  bundles?: readonly Bundle[];
  blocks?: ReadonlyMap<string, Rect>;
  mapsById?: ReadonlyMap<string, MapLineData>;
}

/** Beyond the content on every side, so the veil's edge is never in view. */
const MARGIN = 20_000;
const n1 = (v: number) => +v.toFixed(1);

/** A rounded rectangle as a sub-path, starting at its top edge's first straight point (`M x+r,y`). */
function roundRect({ x, y, w, h }: Rect, r: number): string {
  r = Math.min(r, w / 2, h / 2);
  return `M${n1(x + r)},${n1(y)}H${n1(x + w - r)}A${r},${r} 0 0 1 ${n1(x + w)},${n1(y + r)}V${n1(y + h - r)}A${r},${r} 0 0 1 ${n1(x + w - r)},${n1(y + h)}H${n1(x + r)}A${r},${r} 0 0 1 ${n1(x)},${n1(y + h - r)}V${n1(y + r)}A${r},${r} 0 0 1 ${n1(x + r)},${n1(y)}Z`;
}

export default function FadeLayer({ data, notes, lines, bundles, blocks, mapsById }: FadeLayerProps) {
  const shown = useLit(data);
  useStore((s) => s.nodes); // the holes follow drags, resizes and collapses
  const lookup = useStore((s) => s.nodeLookup);
  // Development only (slice 4p): its commits are counted, so a spec can check that panning and zooming with fading on
  // run no script for it.
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const w = window as unknown as { __imFadeCommits?: number };
      w.__imFadeCommits = (w.__imFadeCommits ?? 0) + 1;
    }
  });
  if (!shown) return null;
  const { key, lit } = shown;

  const ids = litNodeIds(lookup, lit);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (r: Rect) => {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  };
  const holes: string[] = [];
  for (const [id, n] of lookup) {
    if (n.hidden) continue;
    const r = nodeRect(n);
    grow(r);
    if (ids.has(id)) holes.push(roundRect(r, n.type === "block" ? 12 : (n as unknown as CardNodeT).data.card.kind === "src" ? 3 : 10));
  }
  for (const note of notes) {
    grow(note.rect);
    if (note.pinCardId && ids.has(note.pinCardId)) holes.push(roundRect(note.rect, 4));
  }
  if (!Number.isFinite(x0)) return null;
  const outer = `M${n1(x0 - MARGIN)},${n1(y0 - MARGIN)}H${n1(x1 + MARGIN)}V${n1(y1 + MARGIN)}H${n1(x0 - MARGIN)}Z`;

  return (
    <>
      <svg className="fade-veil" width={1} height={1} data-testid="layer-fade" data-fade={key} data-lit-cards={ids.size}>
        <path d={outer + holes.join("")} fillRule="evenodd" />
      </svg>
      <LitLines maps={lit.mappings} rels={lit.relationships} lines={lines} bundles={bundles} blocks={blocks} mapsById={mapsById} />
      <LitRows rows={lit.rows} />
    </>
  );
}
