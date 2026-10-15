"use client";

// Fading (slice 4p, F1, chosen after step 2; AD-24): one veil in the viewport's big layer, above the cards at z-index 1,
// in the canvas background's colour at 75 % (cards, frames and notes at about the prototype's 25 %); the lit cards and
// blocks, and the notes pinned to a lit card, lifted above it by one stylesheet rule (z-index 2); the lit lines and the
// lens's rows drawn again in the overlay (z-index 3, canvas.css). The rule is a stylesheet, not the nodes' z-index: React
// Flow writes its own z-index on a wrapper whenever it renders it (e.g. while it is dragged), and changing the nodes
// array would re-render the canvas (S4P-12); `!important` in a stylesheet wins over that inline style. The veil and the
// rule move with the viewport, so panning and zooming run no script for them. The request comes from its store
// (`fade.ts`), so switching re-renders this layer only.

import { useEffect } from "react";
import { useStore, ViewportPortal } from "@xyflow/react";
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

/** The stylesheet rule lifting the lit nodes and notes above the veil. */
export function liftRule(nodeIds: Iterable<string>, noteIds: Iterable<string>): string {
  const q = (v: string) => `"${v.replace(/["\\]/g, "\\$&")}"`;
  const sel = [...[...nodeIds].map((id) => `.im-canvas .react-flow__node[data-id=${q(id)}]`), ...[...noteIds].map((id) => `.im-canvas .nt[data-note=${q(id)}]`)];
  return sel.length ? `${sel.join(",\n")} { z-index: 2 !important }` : "";
}

export default function FadeLayer({ data, notes, lines, bundles, blocks, mapsById }: FadeLayerProps) {
  const shown = useLit(data);
  useStore((s) => s.nodes); // follow drags, collapses and widths (the veil's size; which blocks are lit)
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
  for (const n of lookup.values()) if (!n.hidden) grow(nodeRect(n));
  for (const note of notes) grow(note.rect);
  if (!Number.isFinite(x0)) return null;
  const litNotes = notes.filter((n) => n.pinCardId && ids.has(n.pinCardId)).map((n) => n.id);

  return (
    <>
      <style data-testid="style-fade-lift">{liftRule(ids, litNotes)}</style>
      <ViewportPortal>
        <div
          className="fade-veil"
          data-testid="layer-fade"
          data-fade={key}
          data-lit-cards={ids.size}
          style={{ left: x0 - MARGIN, top: y0 - MARGIN, width: x1 - x0 + 2 * MARGIN, height: y1 - y0 + 2 * MARGIN }}
        />
      </ViewportPortal>
      <LitLines maps={lit.mappings} rels={lit.relationships} lines={lines} bundles={bundles} blocks={blocks} mapsById={mapsById} />
      <LitRows rows={lit.rows} />
    </>
  );
}
