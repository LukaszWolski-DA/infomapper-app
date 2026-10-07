"use client";

// Card width (slice 1b, D-37, C-09; prototype .c-rs, "cresize"): drag the handle on a card's right edge, 200–600 px
// in steps of 8. While dragging, only a light outline shows the new width; the card and its lines take it on release,
// when the width is saved per canvas (Łukasz, 4 October 2026: changing the card on every step measured about 20 fps
// against the bar of 45, with or without the rows drawn). will-change is off on the viewport meanwhile (the spike's
// follow-up). Double-click the handle to fit the width to the names.

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useReactFlow } from "@xyflow/react";
import type { CardData } from "./card-data";
import type { CardNodeT } from "./CardNode";
import { CARD_W, CARD_W_MAX, CARD_W_MIN, cardHeight, cardWidth, clamp, snap8 } from "./geometry";

type WidthPatch = { width: number | null };

/** The outline of a card being resized, in canvas coordinates. */
export interface ResizeOutline {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The stored value for a width: the default width is stored as null. */
export const storedWidth = (w: number): number | null => (w === CARD_W ? null : w);

export function useCardResize(editable: boolean, change: (id: string, patch: WidthPatch, undo: WidthPatch) => void) {
  const rf = useReactFlow();
  const [outline, setOutline] = useState<ResizeOutline | null>(null);
  const press = useRef<{ cardId: string; original: CardData["width"]; startW: number; sx: number; zoom: number; last: number; box: ResizeOutline } | null>(null);
  // Stable window listeners that read the latest `change`: a selection change during the same pointerup (the lasso,
  // slice 2a) gives `change` a new identity, and re-subscribing then would drop this pointerup.
  const changeRef = useRef(change);
  useEffect(() => {
    changeRef.current = change;
  }, [change]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      const w = clamp(snap8(p.startW + (e.clientX - p.sx) / p.zoom), CARD_W_MIN, CARD_W_MAX);
      if (w === p.last) return;
      p.last = w;
      setOutline({ ...p.box, w });
    };
    const up = () => {
      const p = press.current;
      if (!p) return;
      press.current = null;
      setOutline(null);
      if (p.last !== p.startW) changeRef.current(p.cardId, { width: storedWidth(p.last) }, { width: p.original });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  /** Capture phase on the canvas: a press on a card's width handle. Returns whether it took the press. */
  const onPointerDown = useCallback(
    (e: ReactPointerEvent): boolean => {
      if (!editable || e.button !== 0) return false;
      const cardId = (e.target as HTMLElement).closest<HTMLElement>("[data-resize]")?.dataset.resize;
      const node = cardId ? (rf.getNode(cardId) as CardNodeT | undefined) : undefined;
      if (!cardId || !node) return false;
      e.preventDefault();
      e.stopPropagation();
      const card = node.data.card;
      const startW = cardWidth(card);
      const box = { x: node.position.x, y: node.position.y, w: startW, h: cardHeight(card) };
      press.current = { cardId, original: card.width, startW, sx: e.clientX, zoom: rf.getZoom(), last: startW, box };
      setOutline(box);
      return true;
    },
    [editable, rf],
  );

  return { resizing: outline !== null, outline, onPointerDown };
}
