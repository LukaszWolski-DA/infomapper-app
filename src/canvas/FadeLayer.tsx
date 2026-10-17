"use client";

// Fading (slice 4b-1, F4; AD-24): one veil with holes on a compositing layer of its own, in the overlay above the cards,
// in the canvas background's colour at 75 % (cards, frames and notes under it at about the prototype's 25 %), with a
// hole for every lit card, every block of a collapsed frame with a lit card, and every note pinned to a lit card; the lit
// lines and rows drawn again above it. Nothing in the viewport's big layer is restyled, moved or re-ordered, so switching
// repaints only the veil's and the overlay's layers (slice 4b-1, step 0: F1 lifted the lit cards by a stylesheet rule,
// which re-ordered the big layer's paint and re-rastered all of it, 300–550 ms at 30 %). The holes follow the nodes
// (drags, resizes, collapses, the card heights by zoom level) and the notes; panning and zooming move the veil with the
// viewport, with no script per frame; the veil reaches one pane at the minimum zoom beyond the content (T1). The request
// comes from its store (`fade.ts`), so switching re-renders this layer only, never the canvas.

import { useEffect } from "react";
import { useStore } from "@xyflow/react";
import type { CardNodeT } from "./CardNode";
import { LitLines } from "./LineLayer";
import { LitRows, litNodeIds, nodeRect, useLit, type FadeData, type FadeNote } from "./fade-canvas";
import type { CanvasLines, MapLineData } from "./line-data";
import type { Bundle } from "./line-geometry";
import { MIN_ZOOM, type Rect } from "./geometry";

export interface FadeLayerProps {
  data: FadeData | undefined;
  notes: readonly FadeNote[];
  lines: CanvasLines;
  bundles?: readonly Bundle[];
  blocks?: ReadonlyMap<string, Rect>;
  mapsById?: ReadonlyMap<string, MapLineData>;
}

const n1 = (v: number) => +v.toFixed(1);

/** A rounded rectangle as a sub-path, starting at its top edge's first straight point (`M x+r,y`). */
export function roundRect({ x, y, w, h }: Rect, r: number): string {
  r = Math.min(r, w / 2, h / 2);
  return `M${n1(x + r)},${n1(y)}H${n1(x + w - r)}A${r},${r} 0 0 1 ${n1(x + w)},${n1(y + r)}V${n1(y + h - r)}A${r},${r} 0 0 1 ${n1(x + w - r)},${n1(y + h)}H${n1(x + r)}A${r},${r} 0 0 1 ${n1(x)},${n1(y + h - r)}V${n1(y + r)}A${r},${r} 0 0 1 ${n1(x + r)},${n1(y)}Z`;
}

/** The veil's margin beyond the content: the pane's width and height at the minimum zoom (a 1 px pane until measured). */
export const veilMargin = (paneW: number, paneH: number): [number, number] => [Math.ceil(Math.max(1, paneW) / MIN_ZOOM), Math.ceil(Math.max(1, paneH) / MIN_ZOOM)];

export default function FadeLayer({ data, notes, lines, bundles, blocks, mapsById }: FadeLayerProps) {
  const shown = useLit(data);
  useStore((s) => s.nodes); // the holes follow drags, resizes and collapses
  const lookup = useStore((s) => s.nodeLookup);
  // the pane's size (slice 4b-1, T1): a resize re-renders the veil, a pan or zoom does not
  const paneW = useStore((s) => s.width);
  const paneH = useStore((s) => s.height);
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
    // the corners of a block, an entity card and a source card (canvas.css)
    if (ids.has(id)) holes.push(roundRect(r, n.type === "block" ? 12 : (n as unknown as CardNodeT).data.card.kind === "src" ? 3 : 10));
  }
  let litNotes = 0;
  for (const note of notes) {
    grow(note.rect);
    if (note.pinCardId && ids.has(note.pinCardId)) {
      holes.push(roundRect(note.rect, 4));
      litNotes++;
    }
  }
  if (!Number.isFinite(x0)) return null;
  // beyond the content by one pane at the minimum zoom on every side (slice 4b-1, T1; before, a fixed 20,000 px): the view
  // is at most that wide, so while any of the content is in view the whole view lies inside the veil and its edge never
  // shows; the smaller layer costs less on every pan frame
  const [mx, my] = veilMargin(paneW, paneH);
  const outer = `M${n1(x0 - mx)},${n1(y0 - my)}H${n1(x1 + mx)}V${n1(y1 + my)}H${n1(x0 - mx)}Z`;

  return (
    <>
      <svg className="fade-veil" width={1} height={1} data-testid="layer-fade" data-fade={key} data-lit-cards={ids.size} data-lit-notes={litNotes}>
        <path d={outer + holes.join("")} fillRule="evenodd" />
      </svg>
      <LitLines maps={lit.mappings} rels={lit.relationships} lines={lines} bundles={bundles} blocks={blocks} mapsById={mapsById} />
      <LitRows rows={lit.rows} />
    </>
  );
}
