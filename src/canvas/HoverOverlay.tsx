"use client";

// Hover highlight (slice 1b, C-10; prototype V.hover, .row.hl, .hnd): hovering a row emphasises its lines (the line
// layer fades the others) and marks the rows at their other ends; hovering a mapping line marks its rows. The marks
// and the row's connection dots are drawn in one overlay above the cards, so the cards themselves are not restyled
// (the spike's follow-up for C-10). The same overlay flashes a row that was just moved (D-36, prototype .row.moved)
// and draws the outline of a card whose width is being dragged (C-09).
// Below 40 % zoom there are no rows, so only the lines are emphasised.

import { memo } from "react";
import { useStore, ViewportPortal } from "@xyflow/react";
import type { CardNodeT } from "./CardNode";
import type { ResizeOutline } from "./CardResize";
import { cardWidth, LOD_ZOOM, ROW_H, rowEnd } from "./geometry";
import { hoverRows, type CanvasLines, type Selection } from "./line-data";

function HoverOverlay({
  hover,
  lines,
  flash,
  outline,
}: {
  hover: Selection;
  lines: CanvasLines;
  flash: { rowId: string; n: number } | null;
  outline: ResizeOutline | null;
}) {
  useStore((s) => s.nodes); // follow drags, collapses and widths
  const lod = useStore((s) => s.transform[2] < LOD_ZOOM);
  const lookup = useStore((s) => s.nodeLookup);
  if (lod && !outline) return null;

  const box = (cardId: string, rowId: string) => {
    const n = lookup.get(cardId);
    if (!n) return null;
    const card = (n as unknown as CardNodeT).data.card;
    const { x, y } = n.internals.positionAbsolute;
    const end = rowEnd({ x, y, card }, rowId);
    return end.hidden ? null : { x, y: end.y - ROW_H / 2, w: cardWidth(card), cy: end.y };
  };

  const marks = lod ? [] : hoverRows(hover, lines).map(({ cardId, rowId }) => ({ key: `${cardId}|${rowId}`, b: box(cardId, rowId) }));
  const own = !lod && hover?.t === "row" ? box(hover.cardId, hover.id) : null;
  let flashBox = null;
  if (flash && !lod) {
    for (const [id, n] of lookup) {
      if ((n as unknown as CardNodeT).data.card.rows.some((r) => r.id === flash.rowId)) flashBox = box(id, flash.rowId);
      if (flashBox) break;
    }
  }
  if (!marks.length && !flashBox && !outline) return null;

  return (
    <ViewportPortal>
      <svg className="hover-layer" width={1} height={1} data-testid="layer-hover">
        {marks.map(({ key, b }) => b && <rect key={key} className="hl" data-testid="hover-row" x={b.x} y={b.y} width={b.w} height={ROW_H} />)}
        {own && (
          <>
            <circle className="hnd" cx={own.x} cy={own.cy} r={4.5} />
            <circle className="hnd" cx={own.x + own.w} cy={own.cy} r={4.5} />
          </>
        )}
        {outline && <rect className="resize-outline" data-testid="outline-card-width" x={outline.x} y={outline.y} width={outline.w} height={outline.h} rx={8} />}
        {flashBox && <rect key={flash!.n} className="moved" data-testid="row-moved" x={flashBox.x} y={flashBox.y} width={flashBox.w} height={ROW_H} />}
      </svg>
    </ViewportPortal>
  );
}

export default memo(HoverOverlay);
