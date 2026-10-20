"use client";

// Several selected cards and the lasso (slice 2a; prototype #lasso, #selbox, .card.msel): each selected card gets a
// mark and a dashed box around the group shows “N selected”. Drawn in an overlay above the cards, so no card is
// restyled (AD-24, as the hover highlight). Positions come from the store, so the marks follow a drag. Slice 2b: a
// selected frame gets a mark around it too and counts in “N selected”. Slice 2c: a collapsed frame's mark goes around
// its block, with the block's corners; a card hidden in a collapsed frame gets none. Slice 3a: a selected note gets a
// mark with the note's corners and counts too. Slice 4p (trial A): drawn in `OverlayLayer` (its own compositing layer);
// the lasso comes from a store, so drawing it re-renders this overlay only, never the canvas.

import { memo } from "react";
import { useStore, type Node } from "@xyflow/react";
import { isCardNode } from "./CardNode";
import { isReqNode } from "./RequirementCardNode";
import { REQ_CARD, requirementCardHeight } from "./requirement-card-data";
import type { FrameData } from "./frame-data";
import { cardHeight, cardWidth, type Rect } from "./geometry";
import type { Selection } from "./line-data";
import { cardKey, frameKey, noteKey, reqKey, selectionBounds } from "./selection";
import { useValue, type ValueStore } from "./value-store";

function SelectionOverlay({
  selection,
  lassoStore,
  frames,
  frameRects,
  noteRects,
}: {
  selection: Selection;
  /** The lasso being drawn. */
  lassoStore: ValueStore<Rect | null>;
  frames: readonly FrameData[];
  /** What stands for each frame: the frame, or its block when collapsed (slice 2c). */
  frameRects: ReadonlyMap<string, Rect>;
  /** The notes shown, by id (slice 3a). */
  noteRects: ReadonlyMap<string, Rect>;
}) {
  const lasso = useValue(lassoStore);
  const all = useStore((s) => s.nodes) as Node[]; // follow drags, collapses and widths
  const nodes = all.filter(isCardNode);
  // a requirement selected whose card is here (slice 4b-2, item 5): its card gets the mark, alone or in a group
  const keys = selection?.t === "multi" ? new Set(selection.keys) : selection?.t === "req" ? new Set([reqKey(selection.id)]) : null;
  if (!keys && !lasso) return null;

  const marks: { id: string; r: Rect; frame?: boolean; note?: boolean; req?: boolean; rx?: number }[] = [];
  if (keys) {
    for (const f of frames) {
      if (keys.has(frameKey(f.id))) marks.push({ id: f.id, r: frameRects.get(f.id) ?? { x: f.x, y: f.y, w: f.width, h: f.height }, frame: true, rx: f.collapsed ? 13 : 17 });
    }
    for (const n of nodes) {
      const card = n.data.card;
      if (!n.hidden && keys.has(cardKey(card))) marks.push({ id: n.id, r: { x: n.position.x, y: n.position.y, w: cardWidth(card), h: cardHeight(card) } });
    }
    for (const [id, r] of noteRects) if (keys.has(noteKey(id))) marks.push({ id, r, note: true });
    for (const n of all) {
      if (!isReqNode(n) || !keys.has(reqKey(n.data.card.requirementId))) continue;
      marks.push({ id: n.id, r: { x: n.position.x, y: n.position.y, w: REQ_CARD.width, h: requirementCardHeight(n.data.card.nameLines) }, req: true });
    }
  }
  if (!marks.length && !lasso) return null;
  const box = selectionBounds(marks.map((m) => m.r));

  return (
    <>
      <svg className="hover-layer selection-layer" width={1} height={1} data-testid="layer-selection">
        {marks.map(({ id, r, frame, note, req, rx }) =>
          req ? (
            <rect key={id} className="msel req" data-testid="mark-selected-requirement" data-card={id} x={r.x - 2} y={r.y - 2} width={r.w + 4} height={r.h + 4} rx={9} />
          ) : note ? (
            <rect key={id} className="msel" data-testid="mark-selected-note" data-note-mark={id} x={r.x - 1} y={r.y - 1} width={r.w + 2} height={r.h + 2} rx={5} />
          ) : frame ? (
            <rect key={id} className="msel" data-testid="mark-selected-frame" data-frame-mark={id} x={r.x - 1} y={r.y - 1} width={r.w + 2} height={r.h + 2} rx={rx} />
          ) : (
            <rect key={id} className="msel" data-testid="mark-selected" data-card={id} x={r.x - 1} y={r.y - 1} width={r.w + 2} height={r.h + 2} rx={9} />
          ),
        )}
        {box && marks.length > 1 && <rect className="selbox" data-testid="box-selection" x={box.x} y={box.y} width={box.w} height={box.h} rx={14} />}
        {lasso && <rect className="lasso" data-testid="lasso" x={lasso.x} y={lasso.y} width={lasso.w} height={lasso.h} rx={2} />}
      </svg>
      {box && marks.length > 1 && <SelectionLabel box={box} count={marks.length} />}
    </>
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
