// Align, stack and line up a group of cards (slice 2a; prototype `arrange`): align to the leftmost or topmost edge;
// a column sorted by y with 32 px gaps; a row sorted by x with 64 px gaps. Unlike the prototype, every position is
// rounded to the 8 px grid before it is saved (the domain requires it); a gap is rounded up, so it never shrinks.
// Slice 2b (D-17): a selected frame takes part as one unit with its rectangle; a column leaves 64 px after a frame.

import { snap8, type Pt, type Rect } from "./geometry";

export type ArrangeMode = "left" | "top" | "column" | "row";

export const ARRANGED: Record<ArrangeMode, string> = {
  left: "Aligned to the left edge.",
  top: "Aligned to the top edge.",
  column: "Stacked in a column.",
  row: "Lined up in a row.",
};

const ceil8 = (v: number) => Math.ceil(v / 8) * 8;

/** The new top left corner of each unit (a card, or a frame with `frame`), by id. */
export function arrange(mode: ArrangeMode, cards: readonly { id: string; rect: Rect; frame?: boolean }[]): Map<string, Pt> {
  const out = new Map<string, Pt>();
  if (cards.length === 0) return out;
  if (mode === "left") {
    const x = snap8(Math.min(...cards.map((c) => c.rect.x)));
    for (const c of cards) out.set(c.id, { x, y: snap8(c.rect.y) });
  } else if (mode === "top") {
    const y = snap8(Math.min(...cards.map((c) => c.rect.y)));
    for (const c of cards) out.set(c.id, { x: snap8(c.rect.x), y });
  } else if (mode === "column") {
    const sorted = [...cards].sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
    const x = snap8(sorted[0]!.rect.x);
    let y = snap8(sorted[0]!.rect.y);
    for (const c of sorted) {
      out.set(c.id, { x, y });
      y = ceil8(y + c.rect.h + (c.frame ? 64 : 32));
    }
  } else {
    const sorted = [...cards].sort((a, b) => a.rect.x - b.rect.x || a.rect.y - b.rect.y);
    const y = snap8(sorted[0]!.rect.y);
    let x = snap8(sorted[0]!.rect.x);
    for (const c of sorted) {
      out.set(c.id, { x, y });
      x = ceil8(x + c.rect.w + 64);
    }
  }
  return out;
}
