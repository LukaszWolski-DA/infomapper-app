// What the canvas draws for its notes (slice 3a, D-20, D-21), as plain serialisable data built on the server, and where
// each note shows now (prototype notePos, noteVisible, tethers). Pure TypeScript, tested without a browser.
// A free note in a frame keeps the frame's place as it was when the note's own place was read (`anchor`): while the
// frame is dragged, or after a frame move saved without a fresh page, the note shows moved by the same amount, as the
// server stores it (moveOnCanvas carries the frame's free notes).

import type { Uuid } from "@/domain/ids";
import { notePlaces, notePosition, noteVisible, type NotePlaces } from "@/domain/model/notes";
import type { Frame, Note, NoteColor, NoteStatus } from "@/domain/types";
import type { Rect } from "./geometry";

export interface NoteData {
  id: Uuid;
  version: number;
  /** Plain text (AD-30); empty for an emptied note. */
  text: string;
  color: NoteColor;
  status: NoteStatus;
  width: number;
  pinCardId: Uuid | null;
  pinFrameId: Uuid | null;
  /** Free: its place on the canvas. Pinned: its offset from the card or frame. */
  x: number;
  y: number;
  frameId: Uuid | null;
  /** Where its frame was when `x` and `y` were read (free notes in a frame); see the file's comment. */
  anchor: { x: number; y: number } | null;
  /** ISO timestamp, and who created it (“Created {date} by {name}.”, Łukasz's step 0 answer 4). */
  createdAt: string;
  createdBy: string;
}

/** The notes of one canvas for the client; `userName` names the creator. */
export function buildNotes(notes: readonly Note[], frames: readonly Pick<Frame, "id" | "x" | "y">[], userName: (id: Uuid) => string): NoteData[] {
  const frameById = new Map(frames.map((f) => [f.id, f]));
  return notes.map((n) => {
    const f = n.frame_id ? frameById.get(n.frame_id) : undefined;
    return {
      id: n.id,
      version: n.version,
      text: n.body_text ?? "",
      color: n.color,
      status: n.status,
      width: n.width,
      pinCardId: n.pin_canvas_item_id,
      pinFrameId: n.pin_frame_id,
      x: n.x,
      y: n.y,
      frameId: n.frame_id,
      anchor: f ? { x: f.x, y: f.y } : null,
      createdAt: n.created_at,
      createdBy: userName(n.created_by),
    };
  });
}

/** The note's columns as the domain's note rules read them. */
const asRow = (n: NoteData) => ({
  x: n.x,
  y: n.y,
  pin_canvas_item_id: n.pinCardId,
  pin_frame_id: n.pinFrameId,
  frame_id: n.frameId,
  status: n.status,
});

/** A card as placed now (its node's position during a drag) and a frame as shown now. */
export type PlacedCard = { id: Uuid; x: number; y: number; width: number | null; frameId: Uuid | null };
export type ShownFrame = { id: Uuid; x: number; y: number; width: number; height: number; collapsed: boolean };

export function placesOf(cards: readonly PlacedCard[], frames: readonly ShownFrame[]): NotePlaces {
  return notePlaces(
    cards.map((c) => ({ id: c.id, x: c.x, y: c.y, width: c.width, frame_id: c.frameId })),
    frames,
  );
}

/** Where a note is drawn now: a pinned one at its element plus its offset, a free one in a frame moved with that frame. */
export function noteAt(n: NoteData, places: NotePlaces): { x: number; y: number } {
  if (n.pinCardId || n.pinFrameId) return notePosition(asRow(n), places);
  const f = n.frameId ? places.frames.get(n.frameId) : undefined;
  return f && n.anchor ? { x: n.x + f.x - n.anchor.x, y: n.y + f.y - n.anchor.y } : { x: n.x, y: n.y };
}

/** Whether a note is drawn now (resolved ones hidden only when the user hides them, step 4). */
export const noteShown = (n: NoteData, places: NotePlaces, hideResolved = false): boolean => noteVisible(asRow(n), places, hideResolved);

/** “10 Oct 2026”, as the prototype's fmtDate. */
export const noteDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/**
 * The dashed tether from a pinned note to its card or frame (prototype tethers): between the points of each rectangle
 * nearest to the other's centre, with a dot on the element; none when they touch (under 6 px).
 */
export function tether(note: Rect, target: Rect): { x1: number; y1: number; x2: number; y2: number } | null {
  const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
  const nc = { x: note.x + note.w / 2, y: note.y + note.h / 2 };
  const rc = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
  const onTarget = { x: clamp(nc.x, target.x, target.x + target.w), y: clamp(nc.y, target.y, target.y + target.h) };
  const onNote = { x: clamp(rc.x, note.x, note.x + note.w), y: clamp(rc.y, note.y, note.y + note.h) };
  if (Math.hypot(onTarget.x - onNote.x, onTarget.y - onNote.y) < 6) return null;
  return { x1: onNote.x, y1: onNote.y, x2: onTarget.x, y2: onTarget.y };
}
