import { describe, expect, it } from "vitest";
import { canvasItem, frame, ids } from "../__fixtures__/domain";
import type { Note } from "../types";
import { BLOCK } from "./frames";
import { freedAtPlace, noteFrameAt, notePlaces, notePosition, noteVisible, NOTE_WIDTH, pinOffset, pinTargetRect } from "./notes";

const { frameA, frameB, itemCustomer, itemCrmCustomer } = ids;

const note = (over: Partial<Note> = {}): Note => ({
  id: "01900000-0000-7000-8000-00000000d001",
  workspace_id: ids.ws,
  canvas_id: ids.canvas1,
  body_html: "<p>Check this</p>",
  body_text: "Check this",
  color: "yellow",
  status: "open",
  resolved_at: null,
  resolved_by: null,
  width: NOTE_WIDTH.initial,
  pin_canvas_item_id: null,
  pin_frame_id: null,
  x: 1000,
  y: 900,
  frame_id: null,
  version: 1,
  created_at: "2026-10-01T08:00:00.000Z",
  created_by: ids.actor,
  updated_at: "2026-10-01T08:00:00.000Z",
  updated_by: ids.actor,
  deleted_at: null,
  ...over,
});

// Customer (400, 120, default width 256) in frame A (0, 0, 800 × 600); CRM customer (1200, 120, 320 wide) free;
// frame B a small frame (100, 100, 200 × 200) inside A.
const items = [canvasItem(itemCustomer, { frame_id: frameA }), canvasItem(itemCrmCustomer, { x: 1200, width: 320 })];
const frames = [frame(frameA), frame(frameB, { x: 100, y: 100, width: 200, height: 200 })];
const places = notePlaces(items, frames);

describe("where a note is (prototype notePos)", () => {
  it("puts a free note at its own place", () => {
    expect(notePosition(note(), places)).toEqual({ x: 1000, y: 900 });
  });

  it("puts a pinned note at its card's or frame's corner plus its offset", () => {
    expect(notePosition(note({ pin_canvas_item_id: itemCustomer, x: 280, y: 0 }), places)).toEqual({ x: 680, y: 120 });
    expect(notePosition(note({ pin_frame_id: frameB, x: 224, y: 10 }), places)).toEqual({ x: 324, y: 110 });
  });

  it("follows a collapsed frame's block, which sits at the frame's corner", () => {
    const collapsed = notePlaces(items, [frame(frameA, { x: 40, y: 48, collapsed: true })]);
    expect(pinTargetRect(note({ pin_frame_id: frameA }), collapsed)).toMatchObject({ x: 40, y: 48, width: BLOCK.width });
    expect(notePosition(note({ pin_frame_id: frameA, x: 304, y: 0 }), collapsed)).toEqual({ x: 344, y: 48 });
  });

  it("is placed to the right of its element when pinned from the tool: width + 24", () => {
    expect(pinOffset(pinTargetRect(note({ pin_canvas_item_id: itemCustomer }), places)!)).toEqual({ x: 280, y: 0 });
    expect(pinOffset(pinTargetRect(note({ pin_canvas_item_id: itemCrmCustomer }), places)!)).toEqual({ x: 344, y: 0 });
    expect(pinOffset(pinTargetRect(note({ pin_frame_id: frameA }), places)!)).toEqual({ x: 824, y: 0 });
  });
});

describe("a free note's frame (prototype afterNoteDrop)", () => {
  it("is the smallest frame around x + 20, y + 13", () => {
    expect(noteFrameAt(frames, { x: 500, y: 500 })).toBe(frameA);
    expect(noteFrameAt(frames, { x: 150, y: 150 })).toBe(frameB);
    // the note's corner is outside frame B, but x + 20, y + 13 is inside it
    expect(noteFrameAt(frames, { x: 85, y: 90 })).toBe(frameB);
    expect(noteFrameAt(frames, { x: 900, y: 0 })).toBeNull();
  });

  it("counts a collapsed frame by its block", () => {
    const collapsed = [frame(frameA, { collapsed: true })];
    expect(noteFrameAt(collapsed, { x: 100, y: 40 }, new Map([[frameA, 1]]))).toBe(frameA);
    expect(noteFrameAt(collapsed, { x: 500, y: 500 }, new Map([[frameA, 1]]))).toBeNull();
  });
});

describe("whether a note shows (prototype noteVisible)", () => {
  it("hides resolved notes only when resolved notes are hidden", () => {
    expect(noteVisible(note({ status: "resolved" }), places, false)).toBe(true);
    expect(noteVisible(note({ status: "resolved" }), places, true)).toBe(false);
    expect(noteVisible(note(), places, true)).toBe(true);
  });

  it("hides a note pinned to a card in a collapsed frame, or to a card not on the canvas", () => {
    const collapsed = notePlaces(items, [frame(frameA, { collapsed: true })]);
    expect(noteVisible(note({ pin_canvas_item_id: itemCustomer, x: 280, y: 0 }), places, false)).toBe(true);
    expect(noteVisible(note({ pin_canvas_item_id: itemCustomer, x: 280, y: 0 }), collapsed, false)).toBe(false);
    expect(noteVisible(note({ pin_canvas_item_id: "01900000-0000-7000-8000-00000000c999" }), places, false)).toBe(false);
  });

  it("shows a note pinned to a collapsed frame (on its block) and hides a free note in it", () => {
    const collapsed = notePlaces(items, [frame(frameA, { collapsed: true })]);
    expect(noteVisible(note({ pin_frame_id: frameA }), collapsed, false)).toBe(true);
    expect(noteVisible(note({ frame_id: frameA }), collapsed, false)).toBe(false);
    expect(noteVisible(note({ frame_id: frameA }), places, false)).toBe(true);
  });
});

describe("a pinned note whose element goes", () => {
  it("stays as a free note at its place, in no frame", () => {
    expect(freedAtPlace(note({ pin_canvas_item_id: itemCustomer, x: 280, y: -16 }), places)).toEqual({
      x: 680,
      y: 104,
      pin_canvas_item_id: null,
      pin_frame_id: null,
      frame_id: null,
    });
  });
});
