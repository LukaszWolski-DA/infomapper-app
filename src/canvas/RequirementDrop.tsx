"use client";

// While a requirement from the left panel is dragged over the canvas (slice 4b-2, item 18): the drop target lit in the
// overlay (a row or a card as a violet outline from data, a mapping line drawn again, lit), and a hint at the pointer
// saying what a drop does. Both read the target from a value store, written by the canvas's `dragover` only when the
// target changes, so dragging re-renders only these two, never the canvas, the cards or the miniature (S4B2-15). The
// hint's position is set on its element directly on each `dragover` (`moveDropHint`), with no render.

import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useStore, useStoreApi } from "@xyflow/react";
import type { CardNodeT } from "./CardNode";
import { cardHeight, cardWidth, ROW_H, rowEnd, type Rect } from "./geometry";
import type { CanvasLines, MapLineData } from "./line-data";
import { LitLines } from "./LineLayer";
import { placedOf, type Bundle } from "./line-geometry";
import { dropHint, type DropTarget } from "./requirement-drop";
import { useValue, type ValueStore } from "./value-store";

const NO_RELS = new Set<string>();

/** The lit drop target, in the overlay above the cards. */
export const DropTargetMark = memo(function DropTargetMark({
  store,
  lines,
  bundles,
  blocks,
  mapsById,
}: {
  store: ValueStore<DropTarget | null>;
  lines: CanvasLines;
  bundles?: readonly Bundle[];
  blocks?: ReadonlyMap<string, Rect>;
  mapsById?: ReadonlyMap<string, MapLineData>;
}) {
  const target = useValue(store);
  useStore((s) => s.nodes); // the view may follow an edge scroll; the target's place comes from the nodes
  const lookup = useStoreApi().getState().nodeLookup;
  if (!target || target.t === "place") return null;
  if (target.t === "map") {
    return <LitLines maps={new Set([target.mappingId])} rels={NO_RELS} lines={lines} bundles={bundles} blocks={blocks} mapsById={mapsById} testId="layer-drop-line" />;
  }
  const p = placedOf(lookup.get(target.cardId));
  if (!p) return null;
  const card = (lookup.get(target.cardId) as unknown as CardNodeT).data.card;
  let r: Rect;
  if (target.t === "row") {
    const end = rowEnd(p, target.rowId);
    r = { x: p.x, y: end.y - ROW_H / 2, w: cardWidth(card), h: ROW_H };
  } else r = { x: p.x, y: p.y, w: cardWidth(card), h: cardHeight(card) };
  return (
    <svg className="hover-layer drop-layer" width={1} height={1} data-testid="layer-drop-target">
      <rect className={`drop-mark${target.linked ? " linked" : ""}`} data-testid="mark-drop-target" data-target={target.target.id} x={r.x} y={r.y} width={r.w} height={r.h} rx={target.t === "row" ? 2 : 10} />
    </svg>
  );
});

/** Where the hint is drawn: set on its element directly from `dragover`, never through a render. */
export const moveDropHint = (el: HTMLElement | null, x: number, y: number) => {
  if (el) el.style.transform = `translate(${Math.round(x + 14)}px, ${Math.round(y + 16)}px)`;
};

/** The hint at the pointer (“Link to birth_date”, “Already linked to …”, “Place card”, “Move card”). */
export function DropHint({ store, hintRef }: { store: ValueStore<DropTarget | null>; hintRef: React.RefObject<HTMLDivElement | null> }) {
  const target = useValue(store);
  // on the page only after it mounted (no portal while the server renders)
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- once, after mount
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div ref={hintRef} className="drop-hint" data-testid="hint-drop" hidden={!target} data-kind={target?.t}>
      {target ? dropHint(target) : ""}
    </div>,
    document.body,
  );
}
