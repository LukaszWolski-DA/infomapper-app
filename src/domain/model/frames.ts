// Frame rules (slice 2b, D-05, D-06, D-23): which frame a card belongs to, what a new or resized frame takes, how a
// frame grows to hold a dropped card, what does not belong in a frame, and the “Arrange into frames” layout. Pure
// functions on rectangles; card heights come from the canvas, which knows the rows it draws.
// Behaviour as in the prototype: frameAt, claimFree, afterResize, afterCardDrop, misfits, frameAroundSelection,
// arrangeLayout.
// Slice 2c (D-07): a collapsed frame is drawn as a block (prototype BW, blockH, blockRect) and only the block counts as
// the frame for membership. A card joins a collapsed frame only when it is dragged and dropped on the block; it is then
// filed at the bottom of the frame (prototype afterCardDrop), snapped to the grid, and the frame grows to hold it.
// Every other change of position or width (nudge, align, stack, line up, resize, fit widths, placing a new card)
// leaves collapsed frames alone: no card joins one, and a card in one keeps it (Łukasz, slice 2c step 0, answer 2).

import type { Uuid } from "../ids";
import type { FrameKind } from "../types";

/** A card's header: the middle of it decides membership (D-05). Same as the canvas draws it. */
export const CARD_HEADER_HEIGHT = 54;
/** A card's width when `canvas_item.width` is null (D-37). */
export const DEFAULT_CARD_WIDTH = 256;

/** The six colours of a free frame (the prototype's FREE_COLORS); a new frame takes the first. */
export const FREE_FRAME_COLORS = ["#7C8998", "#2F7DD1", "#0B8A72", "#A0660F", "#7A4FD0", "#C0437A"] as const;
export const NEW_FRAME_NAME = "New frame";
/** A frame drawn with a click instead of a drag. */
export const NEW_FRAME_SIZE = { width: 480, height: 320 } as const;
/** Frames are never smaller (resize handle, D-06). */
export const FRAME_MIN_SIZE = { width: 160, height: 96 } as const;
/** Room a frame keeps around a card that joins it by a drop. */
export const FRAME_GROW = { side: 24, top: 40, bottom: 24 } as const;
/** Room a frame drawn around cards keeps (“Put in a new frame”, “Fit frame to its content”). */
export const FRAME_PADDING = { side: 32, top: 40, bottom: 32 } as const;

/**
 * A collapsed frame's block (D-07, prototype BW and blockH): a fixed width; the card header, the body padding, one
 * 22 px row per member up to six, one more for “and N more” (or one for “Empty frame”), and the 30 px footer.
 */
export const BLOCK = { width: 280, bodyPad: 6, rowHeight: 22, maxRows: 6, footer: 30 } as const;
/** Where a card dropped on a block is filed (prototype afterCardDrop): 32 px in from the frame's left, 8 px above its bottom. */
export const BLOCK_FILING = { left: 32, aboveBottom: 8 } as const;
const GRID_STEP = 8;
const snapToGrid = (v: number) => Math.round(v / GRID_STEP) * GRID_STEP;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** A frame's place on the canvas; a collapsed one also needs its member count (the block's height). */
export interface FrameBox extends Rect {
  id: Uuid;
  collapsed?: boolean;
  members?: number;
}

/** The height of a collapsed frame's block with this many cards in the frame. */
export function blockHeight(members: number): number {
  const rows = Math.max(1, Math.min(members, BLOCK.maxRows) + (members > BLOCK.maxRows ? 1 : 0));
  return CARD_HEADER_HEIGHT + BLOCK.bodyPad * 2 + rows * BLOCK.rowHeight + BLOCK.footer;
}

/** What a collapsed frame shows: the block's rectangle at the frame's top-left corner. */
export const blockRect = (frame: Pick<Rect, "x" | "y">, members: number): Rect => ({ x: frame.x, y: frame.y, width: BLOCK.width, height: blockHeight(members) });

/** The rectangle that counts as the frame: its block when collapsed (prototype rectOf). */
export const shapeOf = (f: Rect & { collapsed?: boolean; members?: number }): Rect => (f.collapsed ? blockRect(f, f.members ?? 0) : f);

/** A card's place: x, y and width from the data, height from the canvas. */
export interface CardBox extends Rect {
  id: Uuid;
  frameId: Uuid | null;
}

export const cardWidthOf = (item: { width: number | null }): number => item.width ?? DEFAULT_CARD_WIDTH;

/** The middle of a card's header. */
export const headerMiddle = (card: Pick<Rect, "x" | "y" | "width">): Point => ({
  x: card.x + card.width / 2,
  y: card.y + CARD_HEADER_HEIGHT / 2,
});

const containsPoint = (r: Rect, p: Point) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

const containsRect = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

const area = (r: Rect) => r.width * r.height;
type Shaped = Rect & { collapsed?: boolean; members?: number };

/**
 * The smallest frame containing the point, or null. Frames may overlap; membership is always one frame (D-23). A
 * collapsed frame counts by its block (slice 2c).
 */
export function frameAt<F extends Shaped>(frames: readonly F[], p: Point): F | null {
  let best: F | null = null;
  for (const f of frames) {
    if (containsPoint(shapeOf(f), p) && (!best || area(shapeOf(f)) < area(shapeOf(best)))) best = f;
  }
  return best;
}

/** The frame a card at this place belongs to (D-05): the smallest one around the middle of its header. */
export const frameOfCard = <F extends Shaped>(frames: readonly F[], card: Pick<Rect, "x" | "y" | "width">): F | null =>
  frameAt(frames, headerMiddle(card));

/** A new frame takes the cards that are fully inside it and in no other frame (D-06). */
export const cardsFullyInside = (rect: Rect, cards: readonly CardBox[]): CardBox[] =>
  cards.filter((c) => c.frameId === null && containsRect(rect, c));

/** The frame grown so the card fits inside, with room around it (24 px at the sides and below, 40 px above). */
export function grownToHold(frame: Rect, card: Rect): Rect {
  const x0 = Math.min(frame.x, card.x - FRAME_GROW.side);
  const y0 = Math.min(frame.y, card.y - FRAME_GROW.top);
  const x1 = Math.max(frame.x + frame.width, card.x + card.width + FRAME_GROW.side);
  const y1 = Math.max(frame.y + frame.height, card.y + card.height + FRAME_GROW.bottom);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export interface DropResult {
  /** The frame of each card afterwards (null: none); `filed`: its new place when it was dropped on a block. */
  membership: { cardId: Uuid; frameId: Uuid | null; filed?: Point }[];
  /** Every frame, grown where a card joined it. */
  frames: FrameBox[];
}

/**
 * After cards are dropped, or otherwise moved or resized (at their new places, frames at theirs): each card joins the
 * frame under the middle of its header, or none, and that frame grows to hold it. Cards are taken one after the other,
 * so a frame that grew for one card is the grown frame for the next, as in the prototype.
 * Collapsed frames (slice 2c): with `drag` (a drag drop), a card whose header lands on a block joins that frame, is
 * filed at its bottom (snapped to 8 px) and the frame grows to hold it. Without `drag` they are left alone: no card
 * joins one, and a card in one keeps it.
 */
export function dropCards(frames: readonly FrameBox[], dropped: readonly CardBox[], options: { drag?: boolean } = {}): DropResult {
  const now = frames.map((f) => ({ ...f }));
  const byId = new Map(now.map((f) => [f.id, f]));
  const membership = dropped.map((card) => {
    const current = card.frameId ? byId.get(card.frameId) : undefined;
    if (current?.collapsed && !options.drag) return { cardId: card.id, frameId: current.id };
    const f = frameOfCard(options.drag ? now : now.filter((x) => !x.collapsed), card);
    if (!f) return { cardId: card.id, frameId: null };
    if (!f.collapsed) {
      Object.assign(f, grownToHold(f, card));
      return { cardId: card.id, frameId: f.id };
    }
    const filed = { x: snapToGrid(f.x + BLOCK_FILING.left), y: snapToGrid(f.y + f.height - BLOCK_FILING.aboveBottom) };
    Object.assign(f, grownToHold(f, { ...card, ...filed }));
    if (card.frameId !== f.id) f.members = (f.members ?? 0) + 1;
    return { cardId: card.id, frameId: f.id, filed };
  });
  return { membership, frames: now };
}

/**
 * After a frame is resized (D-06): its cards whose header middle is now outside go to the frame under them or to
 * none; free cards whose header middle is now inside join. Cards of other frames are never taken. Returns only the
 * cards whose frame changes.
 */
export function membershipAfterResize(
  resized: FrameBox,
  frames: readonly FrameBox[],
  cards: readonly CardBox[],
): { cardId: Uuid; frameId: Uuid | null }[] {
  // a card the resize releases never goes into a collapsed frame (slice 2c)
  const others = frames.filter((f) => f.id !== resized.id && !f.collapsed);
  const changes: { cardId: Uuid; frameId: Uuid | null }[] = [];
  for (const card of cards) {
    const p = headerMiddle(card);
    if (card.frameId === resized.id) {
      if (!containsPoint(resized, p)) changes.push({ cardId: card.id, frameId: frameAt(others, p)?.id ?? null });
    } else if (card.frameId === null && containsPoint(resized, p)) {
      changes.push({ cardId: card.id, frameId: resized.id });
    }
  }
  return changes;
}

/** The frame drawn around cards: 32 px at the sides, 40 above, 32 below (“Put in a new frame”, “Fit to content”). */
export function frameAround(cards: readonly Rect[]): Rect {
  const x0 = Math.min(...cards.map((c) => c.x));
  const y0 = Math.min(...cards.map((c) => c.y));
  const x1 = Math.max(...cards.map((c) => c.x + c.width));
  const y1 = Math.max(...cards.map((c) => c.y + c.height));
  return {
    x: x0 - FRAME_PADDING.side,
    y: y0 - FRAME_PADDING.top,
    width: x1 - x0 + 2 * FRAME_PADDING.side,
    height: y1 - y0 + FRAME_PADDING.top + FRAME_PADDING.bottom,
  };
}

/** What a card shows, as far as frames care: an entity of a concept, or a table of a source system. */
export type CardSubject = { entityConceptId: Uuid; sourceSystemId?: undefined } | { sourceSystemId: Uuid; entityConceptId?: undefined };

/** What a frame around these cards stands for: one concept, one source system, or a free area. */
export function kindFor(cards: readonly CardSubject[]): { kind: FrameKind; refId: Uuid | null } {
  const concepts = new Set(cards.map((c) => c.entityConceptId).filter((v) => v !== undefined));
  const systems = new Set(cards.map((c) => c.sourceSystemId).filter((v) => v !== undefined));
  if (cards.length && systems.size === 0 && concepts.size === 1) return { kind: "concept", refId: [...concepts][0]! };
  if (cards.length && concepts.size === 0 && systems.size === 1) return { kind: "source_system", refId: [...systems][0]! };
  return { kind: "free", refId: null };
}

/**
 * Whether a card does not belong in its frame: in a concept frame, anything that is not an entity of that concept;
 * in a source frame, anything that is not a table of that system. A free frame takes anything.
 */
export function isMisplaced(frame: { kind: FrameKind; concept_id: Uuid | null; source_system_id: Uuid | null }, card: CardSubject): boolean {
  if (frame.kind === "concept") return card.entityConceptId !== frame.concept_id;
  if (frame.kind === "source_system") return card.sourceSystemId !== frame.source_system_id;
  return false;
}

/** An entity dropped into a concept frame of another concept: the question “Move it to {concept}?” (D-05, D-17). */
export interface ConceptQuestion {
  cardId: Uuid;
  entityId: Uuid;
  /** The frame's concept. */
  conceptId: Uuid;
}

/**
 * The entities to ask about after a drop: those that joined a concept frame they were not in before, and whose
 * concept is another. An entity that stays in its frame is not asked again.
 */
export function conceptQuestions(
  frames: readonly { id: Uuid; kind: FrameKind; concept_id: Uuid | null }[],
  dropped: readonly { cardId: Uuid; entityId: Uuid | null; conceptId: Uuid | null; frameBefore: Uuid | null; frameAfter: Uuid | null }[],
): ConceptQuestion[] {
  const byId = new Map(frames.map((f) => [f.id, f]));
  return dropped.flatMap((d) => {
    const f = d.frameAfter ? byId.get(d.frameAfter) : undefined;
    if (!f || d.frameAfter === d.frameBefore || !d.entityId || f.kind !== "concept" || !f.concept_id || f.concept_id === d.conceptId) return [];
    return [{ cardId: d.cardId, entityId: d.entityId, conceptId: f.concept_id }];
  });
}

// ---- Arrange into frames (prototype arrangeLayout) ----

const ARRANGE = { gap: 32, frameGap: 96, conceptsLeft: 240 } as const;
const GRID = 8;
const up = (v: number) => Math.ceil(v / GRID) * GRID;

/** One group of cards: the tables of one source system, or the entities of one concept, in their order. */
export interface ArrangeGroup {
  refId: Uuid;
  cards: readonly { id: Uuid; width: number; height: number }[];
}

export interface ArrangedFrame extends Rect {
  kind: "concept" | "source_system";
  refId: Uuid;
  cardIds: Uuid[];
}

/**
 * The prototype's “Arrange into frames”: one source frame per system on the left (one column of tables each), one
 * concept frame per concept on the right (two columns when it has more than two entities), frames 96 px apart, the
 * concept frames 240 px right of the widest source frame. Cards go into the shortest column, 32 px apart. Heights are
 * rounded up to the 8 px grid so every position stays on it.
 */
export function arrangeIntoFrames(
  systems: readonly ArrangeGroup[],
  concepts: readonly ArrangeGroup[],
): { frames: ArrangedFrame[]; positions: Map<Uuid, Point> } {
  const positions = new Map<Uuid, Point>();
  const frames: ArrangedFrame[] = [];
  const block = (group: ArrangeGroup, kind: ArrangedFrame["kind"], x0: number, y0: number, cols: number): ArrangedFrame => {
    const colH: number[] = Array<number>(cols).fill(0);
    const cw = Math.max(DEFAULT_CARD_WIDTH, ...group.cards.map((c) => c.width));
    for (const c of group.cards) {
      const col = colH.indexOf(Math.min(...colH));
      positions.set(c.id, { x: x0 + FRAME_PADDING.side + col * (cw + ARRANGE.gap), y: y0 + FRAME_PADDING.top + colH[col]! });
      colH[col]! += up(c.height) + ARRANGE.gap;
    }
    return {
      kind,
      refId: group.refId,
      cardIds: group.cards.map((c) => c.id),
      x: x0,
      y: y0,
      width: FRAME_PADDING.side * 2 + cols * cw + (cols - 1) * ARRANGE.gap,
      height: Math.max(...colH) - ARRANGE.gap + FRAME_PADDING.top + FRAME_PADDING.bottom,
    };
  };

  let y = 0;
  let widest = 0;
  for (const g of systems.filter((s) => s.cards.length)) {
    const f = block(g, "source_system", 0, y, 1);
    frames.push(f);
    y += f.height + ARRANGE.frameGap;
    widest = Math.max(widest, f.width);
  }
  const left = frames.length ? widest + ARRANGE.conceptsLeft : 0;
  y = 0;
  for (const g of concepts.filter((c) => c.cards.length)) {
    const f = block(g, "concept", left, y, g.cards.length > 2 ? 2 : 1);
    frames.push(f);
    y += f.height + ARRANGE.frameGap;
  }
  return { frames, positions };
}
