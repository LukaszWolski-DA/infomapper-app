// What a change of positions or widths does to cards and frames (slice 2b), computed in the browser with the domain's
// rules so the canvas shows it at once; the server's `moveOnCanvas` computes the same again and saves it. Moved frames
// carry their cards, which keep their frame; every other changed card joins the smallest frame under the middle of its
// header, or none, and that frame grows to hold it (D-05, answer 1). Pure, tested without a browser.

import type { Uuid } from "@/domain/ids";
import { cardWidthOf, dropCards, membershipAfterResize, type FrameBox } from "@/domain/model/frames";

export interface PlanCard {
  id: Uuid;
  x: number;
  y: number;
  width: number | null;
  height: number;
  frameId: Uuid | null;
}

export interface LayoutChange {
  /** Frames with a new position: they carry their cards. */
  frames?: readonly { id: Uuid; x: number; y: number }[];
  /** Cards with a new position, width, or both. */
  cards?: readonly { id: Uuid; x?: number; y?: number; width?: number | null }[];
}

export interface LayoutPlan {
  /** Every frame after the change (moved or grown). */
  frames: FrameBox[];
  /** Every card after the change. */
  cards: PlanCard[];
  /** Cards that moved with their frame. */
  carried: Set<Uuid>;
  /** Cards whose position or width changed by themselves: their frame was decided again. */
  changed: Set<Uuid>;
}

export function planLayout(frames: readonly FrameBox[], cards: readonly PlanCard[], change: LayoutChange): LayoutPlan {
  const nextFrames = new Map(frames.map((f) => [f.id, { ...f }]));
  const nextCards = new Map(cards.map((c) => [c.id, { ...c }]));
  const carried = new Set<Uuid>();
  for (const m of change.frames ?? []) {
    const f = nextFrames.get(m.id);
    if (!f) continue;
    const dx = m.x - f.x, dy = m.y - f.y;
    Object.assign(f, { x: m.x, y: m.y });
    for (const c of nextCards.values()) {
      if (c.frameId !== f.id) continue;
      c.x += dx;
      c.y += dy;
      carried.add(c.id);
    }
  }
  const changed = new Set<Uuid>();
  for (const m of change.cards ?? []) {
    const c = nextCards.get(m.id);
    if (!c) continue;
    if (m.width !== undefined) c.width = m.width;
    if (carried.has(c.id)) continue;
    if (m.x !== undefined && m.y !== undefined) Object.assign(c, { x: m.x, y: m.y });
    changed.add(c.id);
  }
  const dropped = dropCards(
    [...nextFrames.values()],
    [...changed].map((id) => {
      const c = nextCards.get(id)!;
      return { id, x: c.x, y: c.y, width: cardWidthOf(c), height: c.height, frameId: c.frameId };
    }),
  );
  for (const m of dropped.membership) nextCards.get(m.cardId)!.frameId = m.frameId;
  return { frames: dropped.frames, cards: [...nextCards.values()], carried, changed };
}

/** A frame given a new rectangle (resize handle, fit to content): the cards whose frame changes (D-06). */
export function planReframe(frames: readonly FrameBox[], cards: readonly PlanCard[], frame: FrameBox): { cardId: Uuid; frameId: Uuid | null }[] {
  return membershipAfterResize(
    frame,
    frames.map((f) => (f.id === frame.id ? frame : f)),
    cards.map((c) => ({ id: c.id, x: c.x, y: c.y, width: cardWidthOf(c), height: c.height, frameId: c.frameId })),
  );
}
