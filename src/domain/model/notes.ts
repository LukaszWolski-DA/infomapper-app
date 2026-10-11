// Notes on a canvas (D-20, D-21, slice 3a): where a note is, which frame a free note belongs to, and when it shows
// (prototype notePos, afterNoteDrop, noteVisible, createNote).

import type { Uuid } from "../ids";
import type { CanvasItem, Frame, Note } from "../types";
import { blockRect, cardWidthOf, frameAt, type Point, type Rect } from "./frames";

/** A new note is 220 px wide; the right edge changes it within 160–520 px (`note_width_ck`). */
export const NOTE_WIDTH = { initial: 220, min: 160, max: 520 } as const;

/** A note pinned from the Note tool or a toolbox sits this far to the right of its card or frame. */
export const NOTE_PIN_GAP = 24;

/** The point of a free note that decides its frame (prototype afterNoteDrop: x + 20, y + 13). */
export const NOTE_FRAME_POINT = { x: 20, y: 13 } as const;

type CardPlace = Pick<CanvasItem, "id" | "x" | "y" | "width" | "frame_id">;
type FramePlace = Pick<Frame, "id" | "x" | "y" | "width" | "height" | "collapsed">;

/** The canvas's cards and frames by id, as the note rules read them. A collapsed frame's block needs its card count. */
export interface NotePlaces {
  cards: ReadonlyMap<Uuid, CardPlace>;
  frames: ReadonlyMap<Uuid, FramePlace>;
  /** Cards per frame, for the height of a collapsed frame's block. */
  members?: ReadonlyMap<Uuid, number>;
}

export function notePlaces(items: readonly CardPlace[], frames: readonly FramePlace[]): NotePlaces {
  const members = new Map<Uuid, number>();
  for (const i of items) if (i.frame_id) members.set(i.frame_id, (members.get(i.frame_id) ?? 0) + 1);
  return { cards: new Map(items.map((i) => [i.id, i])), frames: new Map(frames.map((f) => [f.id, f])), members };
}

/** The rectangle a pinned note hangs on: the card, or the frame (its block when collapsed). Null when it is gone. */
export function pinTargetRect(note: Pick<Note, "pin_canvas_item_id" | "pin_frame_id">, places: NotePlaces): Rect | null {
  if (note.pin_canvas_item_id) {
    const card = places.cards.get(note.pin_canvas_item_id);
    return card ? { x: card.x, y: card.y, width: cardWidthOf(card), height: 0 } : null;
  }
  if (note.pin_frame_id) {
    const frame = places.frames.get(note.pin_frame_id);
    if (!frame) return null;
    return frame.collapsed ? blockRect(frame, places.members?.get(frame.id) ?? 0) : frame;
  }
  return null;
}

/** A pinned note's offset when it is pinned from the Note tool or a toolbox: to the right of its element, at the top. */
export const pinOffset = (target: Pick<Rect, "width">): Point => ({ x: target.width + NOTE_PIN_GAP, y: 0 });

export const isPinned = (note: Pick<Note, "pin_canvas_item_id" | "pin_frame_id">): boolean =>
  note.pin_canvas_item_id !== null || note.pin_frame_id !== null;

/**
 * Where a note is on the canvas: a free note at its own place; a pinned note at its element's corner plus its offset
 * (a frame's block sits at the frame's corner, so a note on a collapsed frame follows the block). A pinned note whose
 * element is gone is at its offset, as the prototype leaves it until it is freed.
 */
export function notePosition(note: Pick<Note, "x" | "y" | "pin_canvas_item_id" | "pin_frame_id">, places: NotePlaces): Point {
  const target = isPinned(note) ? pinTargetRect(note, places) : null;
  return target ? { x: target.x + note.x, y: target.y + note.y } : { x: note.x, y: note.y };
}

/** The frame a free note at this place belongs to (prototype afterNoteDrop): the smallest frame around x + 20, y + 13. */
export function noteFrameAt(frames: readonly FramePlace[], place: Point, members?: ReadonlyMap<Uuid, number>): Uuid | null {
  const boxes = frames.map((f) => ({ ...f, members: members?.get(f.id) ?? 0 }));
  return frameAt(boxes, { x: place.x + NOTE_FRAME_POINT.x, y: place.y + NOTE_FRAME_POINT.y })?.id ?? null;
}

/**
 * Whether a note shows on the canvas (prototype noteVisible): not when resolved notes are hidden and it is resolved;
 * a note pinned to a card only while that card shows (not in a collapsed frame); a note pinned to a frame always (it
 * follows the block); a free note not while its frame is collapsed.
 */
export function noteVisible(note: Pick<Note, "status" | "pin_canvas_item_id" | "pin_frame_id" | "frame_id">, places: NotePlaces, hideResolved: boolean): boolean {
  if (hideResolved && note.status === "resolved") return false;
  if (note.pin_canvas_item_id) {
    const card = places.cards.get(note.pin_canvas_item_id);
    if (!card) return false;
    return !(card.frame_id && places.frames.get(card.frame_id)?.collapsed);
  }
  if (note.pin_frame_id) return places.frames.has(note.pin_frame_id);
  if (note.frame_id) return !places.frames.get(note.frame_id)?.collapsed;
  return true;
}

/**
 * A pinned note whose card leaves the canvas or whose frame is deleted stays as a free note at its place, in no frame
 * (prototype renderNotes). The place is read from the element before it goes.
 */
export function freedAtPlace(note: Note, places: NotePlaces): Pick<Note, "x" | "y" | "pin_canvas_item_id" | "pin_frame_id" | "frame_id"> {
  const at = notePosition(note, places);
  return { x: at.x, y: at.y, pin_canvas_item_id: null, pin_frame_id: null, frame_id: null };
}
