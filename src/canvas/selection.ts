// Selecting several cards (slice 2a, D-15, D-16; prototype V.msel, setMulti, lassoHits). The selection of several
// items is a set of keys, `entity:<id>` and `source:<id>` (the element, not its card, so the same keys work on every
// canvas); slice 2b adds `frame:<id>`. One key is the ordinary single card selection, none is no selection.
// Lasso hits come from the card rectangles in the store, not from the page, so they work at every zoom.

import type { CardData } from "./card-data";
import type { Rect } from "./geometry";
import type { Selection } from "./line-data";

export type SelectionKey = `entity:${string}` | `source:${string}`;

export const cardKey = (card: Pick<CardData, "kind" | "targetId">): SelectionKey =>
  card.kind === "ent" ? `entity:${card.targetId}` : `source:${card.targetId}`;

/** A card on this canvas: its id, key and rectangle on the board. */
export interface CardBox {
  id: string;
  key: SelectionKey;
  rect: Rect;
}

/** The keys a selection holds: several cards, one card, or none (a row or a line is not a card selection). */
export function selectedKeys(sel: Selection, cards: readonly CardBox[]): SelectionKey[] {
  if (sel?.t === "multi") return [...sel.keys];
  if (sel?.t === "card") {
    const card = cards.find((c) => c.id === sel.id);
    return card ? [card.key] : [];
  }
  return [];
}

/** The selection for a set of keys, keeping only cards on this canvas: none, one card, or several. */
export function fromKeys(keys: Iterable<SelectionKey>, cards: readonly CardBox[]): Selection {
  const here = new Map(cards.map((c) => [c.key, c.id]));
  const kept = [...new Set(keys)].filter((k) => here.has(k));
  if (kept.length === 0) return null;
  if (kept.length === 1) return { t: "card", id: here.get(kept[0]!)! };
  return { t: "multi", keys: kept };
}

/** Shift+click: the card goes in or out; the selection so far is the starting set (a row or line counts as none). */
export function toggleCard(sel: Selection, cardId: string, cards: readonly CardBox[]): Selection {
  const card = cards.find((c) => c.id === cardId);
  if (!card) return sel;
  const keys = new Set(selectedKeys(sel, cards));
  if (keys.has(card.key)) keys.delete(card.key);
  else keys.add(card.key);
  return fromKeys(keys, cards);
}

/** The rectangle between two corners, whichever way it was drawn. */
export const rectBetween = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x),
  h: Math.abs(a.y - b.y),
});

/** The cards fully inside the lasso (D-16); a card only partly inside is not caught. */
export const lassoHits = (cards: readonly CardBox[], lasso: Rect): SelectionKey[] =>
  cards
    .filter(({ rect: r }) => r.x >= lasso.x && r.y >= lasso.y && r.x + r.w <= lasso.x + lasso.w && r.y + r.h <= lasso.y + lasso.h)
    .map((c) => c.key);

/** After a lasso: its hits, added to the selection so far when Shift was held at the start. */
export function afterLasso(sel: Selection, hits: readonly SelectionKey[], add: boolean, cards: readonly CardBox[]): Selection {
  return fromKeys(add ? [...selectedKeys(sel, cards), ...hits] : hits, cards);
}

/** The box drawn around several selected cards: their bounds, 12 px out (prototype #selbox). */
export function selectionBounds(rects: readonly Rect[], margin = 12): Rect | null {
  if (rects.length === 0) return null;
  const x0 = Math.min(...rects.map((r) => r.x)), y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w)), y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0 - margin, y: y0 - margin, w: x1 - x0 + 2 * margin, h: y1 - y0 + 2 * margin };
}
