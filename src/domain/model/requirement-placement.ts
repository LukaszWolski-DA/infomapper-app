// Where requirement cards go when they are placed next to an element (slice 4b-2, PRD item 15; prototype
// placeReqCards): to the right of the element, at its top, on the 8 px grid; each card the first free place going down
// in 16 px steps, keeping 20 px from cards, blocks, notes and other requirement cards; several cards stack with 24 px
// between them. Without an element: the view's top centre. Pure, so the seed and the canvas place the same way.

import { REQUIREMENT_CARD_WIDTH } from "./card-kinds";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The gap between the element and the cards (prototype), the free margin, the step and the stacking gap, in px. */
export const REQUIREMENT_PLACING = { gap: 80, margin: 20, step: 16, stack: 24, maxSteps: 400 } as const;

const snap8 = (v: number) => Math.round(v / 8) * 8;

/**
 * The top-left corners for cards of these heights, next to `anchor` (its right edge + 80, its top), or at the view's
 * top centre without one. `occupied`: what a card must keep clear of.
 */
export function requirementCardSpots(anchor: Box | null, view: Box, heights: readonly number[], occupied: readonly Box[]): { x: number; y: number }[] {
  const { gap, margin, step, stack, maxSteps } = REQUIREMENT_PLACING;
  const w = REQUIREMENT_CARD_WIDTH;
  const x = snap8(anchor ? anchor.x + anchor.w + gap : view.x + view.w / 2 - w / 2);
  let y = snap8(anchor ? anchor.y : view.y + 80);
  const taken = [...occupied];
  const spots: { x: number; y: number }[] = [];
  for (const h of heights) {
    const free = (yy: number) => !taken.some((r) => x < r.x + r.w + margin && x + w + margin > r.x && yy < r.y + r.h + margin && yy + h + margin > r.y);
    let yy = y;
    for (let n = 0; !free(yy) && n < maxSteps; n++) yy += step;
    spots.push({ x, y: yy });
    taken.push({ x, y: yy, w, h });
    y = yy + h + stack;
  }
  return spots;
}
