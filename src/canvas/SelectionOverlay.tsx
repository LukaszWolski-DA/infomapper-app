"use client";

// Several selected cards and the lasso (slice 2a; prototype #lasso, #selbox, .card.msel): each selected card gets a
// mark and a dashed box around the group shows “N selected”. Drawn in an overlay above the cards, so no card is
// restyled (AD-24, as the hover highlight). Positions come from the store, so the marks follow a drag.

import { memo } from "react";
import { useStore, ViewportPortal } from "@xyflow/react";
import type { CardNodeT } from "./CardNode";
import { cardHeight, cardWidth, type Rect } from "./geometry";
import type { Selection } from "./line-data";
import { cardKey, selectionBounds } from "./selection";

function SelectionOverlay({ selection, lasso }: { selection: Selection; lasso: Rect | null }) {
  const nodes = useStore((s) => s.nodes) as CardNodeT[]; // follow drags, collapses and widths
  const keys = selection?.t === "multi" ? new Set(selection.keys) : null;
  if (!keys && !lasso) return null;

  const marks: { id: string; r: Rect }[] = [];
  if (keys) {
    for (const n of nodes) {
      const card = n.data.card;
      if (keys.has(cardKey(card))) marks.push({ id: n.id, r: { x: n.position.x, y: n.position.y, w: cardWidth(card), h: cardHeight(card) } });
    }
  }
  const box = selectionBounds(marks.map((m) => m.r));

  return (
    <ViewportPortal>
      <svg className="hover-layer selection-layer" width={1} height={1} data-testid="layer-selection">
        {marks.map(({ id, r }) => (
          <rect key={id} className="msel" data-testid="mark-selected" data-card={id} x={r.x - 1} y={r.y - 1} width={r.w + 2} height={r.h + 2} rx={9} />
        ))}
        {box && marks.length > 1 && <rect className="selbox" data-testid="box-selection" x={box.x} y={box.y} width={box.w} height={box.h} rx={14} />}
        {lasso && <rect className="lasso" data-testid="lasso" x={lasso.x} y={lasso.y} width={lasso.w} height={lasso.h} rx={2} />}
      </svg>
      {box && marks.length > 1 && <SelectionLabel box={box} count={marks.length} />}
    </ViewportPortal>
  );
}

/** “N selected” above the box's top right corner, the same size at every zoom (prototype --iz). */
function SelectionLabel({ box, count }: { box: Rect; count: number }) {
  const zoom = useStore((s) => s.transform[2]);
  return (
    <div
      className="selbox-label"
      data-testid="label-selection"
      // Anchored at the corner: moved up and left by its own size, then scaled around the corner.
      style={{ left: box.x + box.w, top: box.y, transform: `scale(${1 / zoom}) translate(-100%, calc(-100% - 6px))` }}
    >
      {count} selected
    </div>
  );
}

export default memo(SelectionOverlay);
