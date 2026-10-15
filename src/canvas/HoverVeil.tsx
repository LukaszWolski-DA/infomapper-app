"use client";

// The hover line fade (slice 4p, trial A variant; Łukasz after step 1): while a row or a line is hovered, one
// semi-transparent element in the canvas background's colour lies above the line layer and below the cards, so every
// line looks faded (prototype: the other lines at 12 %); the hovered lines stay bright in the overlay above the cards.
// A variant to measure: off by default, switched by the measuring hook (`window.__imHoverFade`):
//   "off"    nothing (as since slice 1b)
//   "plain"  the element in the viewport's big layer
//   "layer"  the element on a compositing layer of its own (`will-change: transform`)

import { memo } from "react";
import { EdgeLabelRenderer, useStore } from "@xyflow/react";
import type { Rect } from "./geometry";
import type { Selection } from "./line-data";
import { createValueStore, useValue, type ValueStore } from "./value-store";

export type HoverFadeMode = "off" | "plain" | "layer";

/** The variant in use; only the measuring hook changes it. */
export const hoverFadeMode = createValueStore<HoverFadeMode>("off");

/** Beyond the content on every side, so the edge of the element is never in view. */
const MARGIN = 20_000;

function HoverVeil({ hoverStore, lassoStore, busy }: { hoverStore: ValueStore<Selection>; lassoStore: ValueStore<Rect | null>; busy: boolean }) {
  const mode = useValue(hoverFadeMode);
  const hovered = useValue(hoverStore);
  const lassoing = useValue(lassoStore) !== null;
  const on = mode !== "off" && !busy && !lassoing && hovered !== null;
  const bounds = useStore((s) => {
    if (!on) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of s.nodeLookup.values()) {
      const { x, y } = n.internals.positionAbsolute;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x + (n.measured.width ?? 0));
      y1 = Math.max(y1, y + (n.measured.height ?? 0));
    }
    return Number.isFinite(x0) ? `${x0 - MARGIN},${y0 - MARGIN},${x1 - x0 + 2 * MARGIN},${y1 - y0 + 2 * MARGIN}` : null;
  });
  if (!on || !bounds) return null;
  const [left, top, width, height] = bounds.split(",").map(Number) as [number, number, number, number];
  return (
    <EdgeLabelRenderer>
      <div className={`hover-veil${mode === "layer" ? " own-layer" : ""}`} data-testid="hover-veil" data-mode={mode} style={{ left, top, width, height }} />
    </EdgeLabelRenderer>
  );
}

export default memo(HoverVeil);
