"use client";

// Card width (slice 1b, D-37, C-09; prototype .c-rs, "cresize"): drag the handle on a card's right edge, 200–600 px
// in steps of 8. The card and its lines follow live; the width is saved per canvas when the drag ends. While dragging,
// will-change is off on the viewport (the spike's follow-up: Chrome then repaints the one card instead of re-rastering
// the whole layer). Double-click the handle to fit the width to the names.

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useReactFlow } from "@xyflow/react";
import type { CardData } from "./card-data";
import type { CardNodeT } from "./CardNode";
import { CARD_W, CARD_W_MAX, CARD_W_MIN, cardWidth, clamp, snap8 } from "./geometry";

type WidthPatch = { width: number | null };

/** The stored value for a width: the default width is stored as null. */
export const storedWidth = (w: number): number | null => (w === CARD_W ? null : w);

export function useCardResize(
  editable: boolean,
  patchCard: (id: string, patch: WidthPatch) => void,
  change: (id: string, patch: WidthPatch, undo: WidthPatch) => void,
) {
  const rf = useReactFlow();
  const [resizing, setResizing] = useState(false);
  const press = useRef<{ cardId: string; original: CardData["width"]; startW: number; sx: number; zoom: number; last: number } | null>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      const w = clamp(snap8(p.startW + (e.clientX - p.sx) / p.zoom), CARD_W_MIN, CARD_W_MAX);
      if (w === p.last) return;
      p.last = w;
      patchCard(p.cardId, { width: w });
    };
    const up = () => {
      const p = press.current;
      if (!p) return;
      press.current = null;
      setResizing(false);
      if (p.last !== p.startW) change(p.cardId, { width: storedWidth(p.last) }, { width: p.original });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [patchCard, change]);

  /** Capture phase on the canvas: a press on a card's width handle. Returns whether it took the press. */
  const onPointerDown = useCallback(
    (e: ReactPointerEvent): boolean => {
      if (!editable || e.button !== 0) return false;
      const cardId = (e.target as HTMLElement).closest<HTMLElement>("[data-resize]")?.dataset.resize;
      const card = cardId ? (rf.getNode(cardId) as CardNodeT | undefined)?.data.card : undefined;
      if (!cardId || !card) return false;
      e.preventDefault();
      e.stopPropagation();
      const startW = cardWidth(card);
      press.current = { cardId, original: card.width, startW, sx: e.clientX, zoom: rf.getZoom(), last: startW };
      setResizing(true);
      return true;
    },
    [editable, rf],
  );

  return { resizing, onPointerDown };
}
