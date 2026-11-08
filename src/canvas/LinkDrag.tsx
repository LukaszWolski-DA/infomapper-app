"use client";

// A requirement's link drag from its card's handle (slice 17, D-72; prototype "rqlink", #rqtmp): a dashed line in the
// requirement colour from the card's nearer side to the pointer, drawn in the overlay from a value store, as the lasso
// is, so dragging never re-renders the canvas, the cards or the miniature. The target under the pointer is lit by the
// left panel's drop mark (`DropTargetMark`), from the same store as a drop from the left panel (slice 4b-2).

import { memo } from "react";
import type { Pt } from "./geometry";
import { REQ_CARD } from "./requirement-card-data";
import { useValue, type ValueStore } from "./value-store";

export interface LinkDragLine {
  from: Pt;
  to: Pt;
}

/** The middle of the card's header row: 14 px down, on its left side when the pointer is left of its middle (prototype). */
export function linkLineStart(card: Pt, pointer: Pt): Pt {
  const left = pointer.x < card.x + REQ_CARD.width / 2;
  return { x: left ? card.x : card.x + REQ_CARD.width, y: card.y + 14 };
}

/** The line as a curve: out horizontally from the card, into the pointer (prototype's path). */
export function linkLinePath({ from: a, to: w }: LinkDragLine): string {
  const mx = (a.x + w.x) / 2;
  return `M${a.x} ${a.y} C${mx} ${a.y} ${mx} ${w.y} ${w.x} ${w.y}`;
}

export const LinkDragLayer = memo(function LinkDragLayer({ store }: { store: ValueStore<LinkDragLine | null> }) {
  const line = useValue(store);
  if (!line) return null;
  return (
    <svg className="hover-layer link-drag-layer" width={1} height={1} data-testid="layer-link-drag">
      <path d={linkLinePath(line)} />
      <circle cx={line.to.x} cy={line.to.y} r={4} />
    </svg>
  );
});
