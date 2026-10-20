// Selecting several cards (slice 2a, D-15, D-16; prototype V.msel, setMulti, lassoHits). The selection of several
// items is a set of keys, `entity:<id>` and `source:<id>` (the element, not its card, so the same keys work on every
// canvas) and, since slice 2b, `frame:<id>`. One key is the ordinary single card or frame selection, none is no
// selection. Lasso hits come from the rectangles in the store, not from the page, so they work at every zoom.
// Slice 2b (D-16, D-17; prototype lassoHits, selectAll, movingItems): a frame stands for its cards. A lasso that
// catches a frame does not also select its cards; Ctrl+A selects every frame and the cards in no frame; a selection
// moves and arranges as units, each selected frame with its cards and each other selected card on its own.
// Slice 3a (item 13; prototype lassoHits, selectAll, movingItems): notes too, `note:<id>`. A lasso catches a note fully
// inside it unless its frame is caught as well; Ctrl+A takes the free notes in no frame; a note moves with a selection
// unless its frame (a free note) or its card or frame (a pinned note) moves anyway, so nothing moves twice.
// Slice 4b-2 (L): requirement cards too, `req:<requirement id>`; one such key is the requirement selected. A lasso or
// Ctrl+A takes them; they are in no frame, so they always move on their own.

import type { CardData } from "./card-data";
import type { Rect } from "./geometry";
import type { Selection } from "./line-data";

export type SelectionKey = `entity:${string}` | `source:${string}` | `frame:${string}` | `note:${string}` | `req:${string}`;

export const cardKey = (card: Pick<CardData, "kind" | "targetId">): SelectionKey =>
  card.kind === "ent" ? `entity:${card.targetId}` : `source:${card.targetId}`;
export const frameKey = (frameId: string): SelectionKey => `frame:${frameId}`;
export const isFrameKey = (key: string): key is `frame:${string}` => key.startsWith("frame:");
export const noteKey = (noteId: string): SelectionKey => `note:${noteId}`;
export const isNoteKey = (key: string): key is `note:${string}` => key.startsWith("note:");
/** A requirement card's key (slice 4b-2): the requirement, as for elements, so the same key works on every canvas. */
export const reqKey = (requirementId: string): SelectionKey => `req:${requirementId}`;
export const isReqKey = (key: string): key is `req:${string}` => key.startsWith("req:");
/** A card's key: an entity or a source table. */
export const isCardKey = (key: string): boolean => !isFrameKey(key) && !isNoteKey(key) && !isReqKey(key);

/** A card, frame or note on this canvas: its id, key and rectangle on the board; a card or free note names its frame. */
export interface ItemBox {
  id: string;
  key: SelectionKey;
  rect: Rect;
  /** A card's or a free note's frame (none for a frame, or a card or note in no frame). */
  frameId?: string | null;
  /** A card hidden in a collapsed frame (slice 2c): a lasso does not catch it. */
  hidden?: boolean;
  /** A pinned note: the card (its id) or frame it is pinned to (slice 3a). */
  pinnedTo?: string | null;
}

/** The keys a selection holds: several items, one card or frame, or none (a row or a line is not such a selection). */
export function selectedKeys(sel: Selection, items: readonly ItemBox[]): SelectionKey[] {
  if (sel?.t === "multi") return [...sel.keys];
  // a requirement whose card is on this canvas (slice 4b-2): selecting the card is selecting the requirement
  if (sel?.t === "req") return items.some((i) => i.key === reqKey(sel.id)) ? [reqKey(sel.id)] : [];
  if (sel?.t === "card" || sel?.t === "frame" || sel?.t === "note") {
    const item = items.find((c) => c.id === sel.id);
    return item ? [item.key] : [];
  }
  return [];
}

/** The selection for a set of keys, keeping only items on this canvas: none, one card or frame, or several. */
export function fromKeys(keys: Iterable<SelectionKey>, items: readonly ItemBox[]): Selection {
  const here = new Map(items.map((c) => [c.key, c.id]));
  const kept = [...new Set(keys)].filter((k) => here.has(k));
  if (kept.length === 0) return null;
  if (kept.length === 1 && isReqKey(kept[0]!)) return { t: "req", id: kept[0]!.slice(4) };
  if (kept.length === 1) return { t: isFrameKey(kept[0]!) ? "frame" : isNoteKey(kept[0]!) ? "note" : "card", id: here.get(kept[0]!)! };
  return { t: "multi", keys: kept };
}

/** Shift+click: the item goes in or out; the selection so far is the starting set (a row or line counts as none). */
export function toggleItem(sel: Selection, key: SelectionKey, items: readonly ItemBox[]): Selection {
  if (!items.some((c) => c.key === key)) return sel;
  const keys = new Set(selectedKeys(sel, items));
  if (keys.has(key)) keys.delete(key);
  else keys.add(key);
  return fromKeys(keys, items);
}

/** Shift+click on a card. */
export function toggleCard(sel: Selection, cardId: string, items: readonly ItemBox[]): Selection {
  const card = items.find((c) => c.id === cardId && (isCardKey(c.key) || isReqKey(c.key)));
  return card ? toggleItem(sel, card.key, items) : sel;
}

/** The rectangle between two corners, whichever way it was drawn. */
export const rectBetween = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x),
  h: Math.abs(a.y - b.y),
});

const within = (r: Rect, lasso: Rect) => r.x >= lasso.x && r.y >= lasso.y && r.x + r.w <= lasso.x + lasso.w && r.y + r.h <= lasso.y + lasso.h;

/**
 * The items fully inside the lasso (D-16); one only partly inside is not caught. A caught frame stands for its cards
 * and its free notes (D-17): they are not caught separately. Frames come first, then cards, then notes, each in the
 * order given.
 */
export function lassoHits(items: readonly ItemBox[], lasso: Rect): SelectionKey[] {
  const frames = items.filter((i) => isFrameKey(i.key) && within(i.rect, lasso));
  const caught = new Set(frames.map((f) => f.id));
  const loose = (i: ItemBox) => !i.hidden && !(i.frameId && caught.has(i.frameId)) && within(i.rect, lasso);
  const cards = items.filter((i) => isCardKey(i.key) && loose(i));
  const notes = items.filter((i) => isNoteKey(i.key) && loose(i));
  // requirement cards are in no frame (slice 4b-2): a caught frame never stands for them
  const reqs = items.filter((i) => isReqKey(i.key) && within(i.rect, lasso));
  return [...frames, ...cards, ...notes, ...reqs].map((i) => i.key);
}

/** After a lasso: its hits, added to the selection so far when Shift was held at the start. */
export function afterLasso(sel: Selection, hits: readonly SelectionKey[], add: boolean, items: readonly ItemBox[]): Selection {
  return fromKeys(add ? [...selectedKeys(sel, items), ...hits] : hits, items);
}

/** Ctrl+A: every frame, every card in no frame, and the free notes shown in no frame (prototype selectAll). */
export const allKeys = (items: readonly ItemBox[]): SelectionKey[] => [
  ...items.filter((i) => isFrameKey(i.key)).map((i) => i.key),
  ...items.filter((i) => isCardKey(i.key) && !i.frameId).map((i) => i.key),
  ...items.filter((i) => isNoteKey(i.key) && !i.frameId && !i.pinnedTo && !i.hidden).map((i) => i.key),
  ...items.filter((i) => isReqKey(i.key)).map((i) => i.key),
];

/** What a selection moves and arranges (prototype movingItems): each part named by its id. */
export interface Units {
  /** Selected frames: each moves with its cards. */
  frames: string[];
  /** Selected cards that are not in a selected frame: each moves on its own. */
  cards: string[];
  /** The cards of the selected frames: they move with their frame (once, even when also selected). */
  members: string[];
  /**
   * Selected notes that move by themselves (slice 3a): not a free note whose frame moves (the frame carries it), not a
   * pinned note whose card or frame moves (it follows).
   */
  notes: string[];
  /** Selected requirement cards (slice 4b-2): each moves on its own; nothing carries them. */
  reqs: string[];
}

export function unitsOf(keys: readonly SelectionKey[], items: readonly ItemBox[]): Units {
  const byKey = new Map(items.map((i) => [i.key, i]));
  const chosen = keys.map((k) => byKey.get(k)).filter((i): i is ItemBox => !!i);
  const frames = chosen.filter((i) => isFrameKey(i.key)).map((i) => i.id);
  const inFrames = new Set(frames);
  const members = items.filter((i) => isCardKey(i.key) && i.frameId && inFrames.has(i.frameId)).map((i) => i.id);
  const carried = new Set(members);
  const cards = chosen.filter((i) => isCardKey(i.key) && !carried.has(i.id)).map((i) => i.id);
  const moving = new Set([...frames, ...members, ...cards]);
  const notes = chosen
    .filter((i) => isNoteKey(i.key) && !(i.pinnedTo ? moving.has(i.pinnedTo) : i.frameId && inFrames.has(i.frameId)))
    .map((i) => i.id);
  const reqs = chosen.filter((i) => isReqKey(i.key)).map((i) => i.id);
  return { frames, cards, members, notes, reqs };
}

/** The selected cards themselves, not frames (fit widths, remove, put in a new frame act on these). */
export const selectedCardIds = (keys: readonly SelectionKey[], items: readonly ItemBox[]): string[] => {
  const byKey = new Map(items.map((i) => [i.key, i]));
  return keys.filter(isCardKey).map((k) => byKey.get(k)?.id).filter((id): id is string => !!id);
};

/** The selected requirement cards (slice 4b-2: removing a selection takes them off too). */
export const selectedReqCardIds = (keys: readonly SelectionKey[], items: readonly ItemBox[]): string[] => {
  const byKey = new Map(items.map((i) => [i.key, i]));
  return keys.filter(isReqKey).map((k) => byKey.get(k)?.id).filter((id): id is string => !!id);
};

/** The box drawn around several selected items: their bounds, 12 px out (prototype #selbox). */
export function selectionBounds(rects: readonly Rect[], margin = 12): Rect | null {
  if (rects.length === 0) return null;
  const x0 = Math.min(...rects.map((r) => r.x)), y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w)), y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0 - margin, y: y0 - margin, w: x1 - x0 + 2 * margin, h: y1 - y0 + 2 * margin };
}
