"use client";

// Fading, candidate F1 (slice 4p, step 2; built only as far as the comparison needs): one veil in the viewport's big
// layer (no layer of its own), above the cards at z-index 1, in the canvas background's colour at 75 %; the lit cards
// and blocks lifted above it (z-index 2 on their React Flow wrappers); the lit lines and the lens's rows drawn again in
// the overlay (z-index 3, canvas.css). Lifting is done on the wrappers' style directly, because lifting through the
// nodes array would re-render the canvas (S4P-12); React Flow puts its own z-index back when a lifted node re-renders
// (e.g. while it is dragged). Notes are not lifted (all notes fade).

import { useEffect, useLayoutEffect } from "react";
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

export default function FadeLayer({ data, notes, lines, bundles, blocks, mapsById }: FadeLayerProps) {
  const shown = useLit(data);
  useStore((s) => s.nodes);
  const lookup = useStore((s) => s.nodeLookup);
  const ids = shown ? litNodeIds(lookup, shown.lit) : null;
  const idsKey = ids ? [...ids].sort().join(",") : "";
  // Development only (slice 4p): its commits are counted, as F4's.
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const w = window as unknown as { __imFadeCommits?: number };
      w.__imFadeCommits = (w.__imFadeCommits ?? 0) + 1;
    }
  });

  // lift the lit nodes above the veil
  useLayoutEffect(() => {
    if (!idsKey) return;
    const lifted = idsKey
      .split(",")
      .map((id) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`))
      .filter((el): el is HTMLElement => !!el);
    for (const el of lifted) el.style.zIndex = "2";
    return () => {
      for (const el of lifted) el.style.zIndex = "0";
    };
  }, [idsKey]);

  if (!shown || !ids) return null;
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
  const { key, lit } = shown;

  return (
    <>
      <ViewportPortal>
        <div
          className="fade-veil-f1"
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
