// A frame resized from any edge or corner (slice 17, D-72; prototype dragUpdate's "fresize" with `dir`): the moving
// edges follow the pointer on the 8 px grid, the others stay, and the frame keeps its minimum size (D-06).

import { FRAME_MIN_SIZE } from "@/domain/model/frames";
import type { Uuid } from "@/domain/ids";
import { snap8, type Pt } from "./geometry";

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** `dir` names the moving edges ("se", "w", "nw", …); `dx`, `dy` the pointer's move in canvas units. */
export function resizedRect(start: FrameRect, dir: string, dx: number, dy: number): FrameRect {
  const r = { ...start };
  const right = start.x + start.w, bottom = start.y + start.h;
  if (dir.includes("e")) r.w = Math.max(FRAME_MIN_SIZE.width, snap8(start.w + dx));
  if (dir.includes("s")) r.h = Math.max(FRAME_MIN_SIZE.height, snap8(start.h + dy));
  if (dir.includes("w")) {
    r.x = Math.min(snap8(start.x + dx), right - FRAME_MIN_SIZE.width);
    r.w = right - r.x;
  }
  if (dir.includes("n")) {
    r.y = Math.min(snap8(start.y + dy), bottom - FRAME_MIN_SIZE.height);
    r.h = bottom - r.y;
  }
  return r;
}

export const sameRect = (a: FrameRect, b: FrameRect) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

/** Pinned notes' offsets moved back by the frame's move, so they stay where they are on the canvas (D-20). */
export const shiftedBack = (offsets: ReadonlyMap<Uuid, Pt>, dx: number, dy: number): Map<Uuid, Pt> =>
  new Map([...offsets].map(([id, o]) => [id, { x: o.x - dx, y: o.y - dy }]));
