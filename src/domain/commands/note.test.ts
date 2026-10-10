import { describe, expect, it } from "vitest";
import { access, archived, canvas, canvasItem, frame, ids, makeCtx, note, NOW } from "../__fixtures__/domain";
import { STALE_VERSION_MESSAGE } from "../errors";
import { changeLabel } from "../model/change-label";
import type { WorkspaceRole } from "../types";
import { createNote, deleteNote, EMPTY_NOTE_MESSAGE, moveNote, pinNote, releaseNotes, unpinNote, updateNote } from "./note";
import { isUndoable } from "./undo";

const { canvas1, canvas2, frameA, frameB, itemCustomer, itemCrmCustomer, noteFree, notePinned, actor } = ids;

// Customer (400, 120) and CRM customer (1200, 120, 320 wide) on canvas 1; frame A (0, 0, 800 × 600) around Customer,
// frame B (2000, 0, 400 × 400) empty.
const state = {
  canvas: canvas(canvas1),
  items: [canvasItem(itemCustomer, { frame_id: frameA }), canvasItem(itemCrmCustomer, { x: 1200, width: 320 })],
  frames: [frame(frameA), frame(frameB, { x: 2000, y: 0, width: 400, height: 400 })],
  notes: [note(noteFree), note(notePinned)],
};
type State = typeof state;
const ok = <T>(r: { ok: true; value: T } | { ok: false; error: { message: string } }): T => {
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe("createNote (S3A-06)", () => {
  const create = (input: object, s: Partial<State> = {}, role: WorkspaceRole = "modeler") =>
    createNote(makeCtx(), access(role), { ...state, ...s }, { canvasId: canvas1, text: "Ask the data owner", ...input });

  it("makes a free note, yellow and 220 px wide, open, with the text as html and plain text", () => {
    const r = create({ x: 1600, y: 800 });
    const { note: n } = ok(r);
    expect(n).toMatchObject({
      canvas_id: canvas1,
      x: 1600,
      y: 800,
      frame_id: null,
      pin_canvas_item_id: null,
      pin_frame_id: null,
      color: "yellow",
      width: 220,
      status: "open",
      body_html: "<p>Ask the data owner</p>",
      body_text: "Ask the data owner",
      created_by: actor,
    });
    if (!r.ok) return;
    expect(changeLabel(r.writeSet.events)).toBe("Add note");
    expect(isUndoable(r.writeSet.events)).toBe(true);
  });

  it("puts a free note in the frame it lands in (x + 20, y + 13)", () => {
    expect(ok(create({ x: 2000, y: 0 })).note.frame_id).toBe(frameB);
    expect(ok(create({ x: 1980, y: -12 })).note.frame_id).toBe(frameB);
    expect(ok(create({ x: 1970, y: 0 })).note.frame_id).toBeNull();
  });

  it("pins a note to a card or a frame, to its right (width + 24), in no frame", () => {
    expect(ok(create({ pin: { canvasItemId: itemCustomer } })).note).toMatchObject({ pin_canvas_item_id: itemCustomer, x: 280, y: 0, frame_id: null });
    expect(ok(create({ pin: { canvasItemId: itemCrmCustomer } })).note).toMatchObject({ x: 344, y: 0 });
    expect(ok(create({ pin: { frameId: frameB } })).note).toMatchObject({ pin_frame_id: frameB, x: 424, y: 0 });
    // a collapsed frame: to the right of its block (280 px wide)
    const collapsed = [frame(frameA, { collapsed: true })];
    expect(ok(create({ pin: { frameId: frameA } }, { frames: collapsed })).note).toMatchObject({ x: 304, y: 0 });
  });

  it("refuses an empty note: it is never saved (D-21)", () => {
    expect(create({ x: 0, y: 0, text: "  \n " })).toMatchObject({ ok: false, error: { code: "invalid", message: EMPTY_NOTE_MESSAGE } });
    expect(create({ x: 0, y: 0, text: null })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("needs a place or a pin, not both; a pin on this canvas; a live canvas", () => {
    expect(create({})).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(create({ x: 1 })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(create({ x: 1, y: 2, pin: { canvasItemId: itemCustomer } })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(create({ pin: { canvasItemId: itemCustomer, frameId: frameA } })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(create({ pin: { canvasItemId: itemCustomer } }, { items: [canvasItem(itemCustomer, { canvas_id: canvas2 })] })).toMatchObject({
      ok: false,
      error: { code: "not_found", message: "This card does not exist." },
    });
    expect(create({ pin: { frameId: frameA } }, { frames: [frame(frameA, { deleted_at: NOW })] })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(create({ x: 0, y: 0 }, { canvas: canvas(canvas1, { deleted_at: NOW }) })).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("is open to reviewers; refused to readers and in an archived workspace (S3A-13)", () => {
    expect(create({ x: 0, y: 0 }, {}, "reviewer").ok).toBe(true);
    expect(create({ x: 0, y: 0 }, {}, "reader")).toMatchObject({ ok: false, error: { code: "forbidden", message: "As a reader you cannot change notes." } });
    expect(createNote(makeCtx(), access("owner", archived), state, { canvasId: canvas1, text: "x", x: 0, y: 0 })).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});

describe("updateNote (S3A-07)", () => {
  const update = (input: object, role: WorkspaceRole = "reviewer", s: Partial<State> = {}) =>
    updateNote(makeCtx(), access(role), { ...state, ...s }, { noteId: noteFree, expectedVersion: 1, ...input });

  it("changes the text; empty text is kept for an existing note", () => {
    const r = update({ text: "Line one\nline two" });
    expect(ok(r).note).toMatchObject({ body_html: "<p>Line one<br>line two</p>", body_text: "Line one\nline two", version: 2 });
    if (r.ok) expect(changeLabel(r.writeSet.events)).toBe("Edit note");
    expect(ok(update({ text: "" })).note).toMatchObject({ body_html: null, body_text: null });
  });

  it("resolves (who and when, set by the server) and reopens", () => {
    const r = update({ status: "resolved" });
    expect(ok(r).note).toMatchObject({ status: "resolved", resolved_at: NOW, resolved_by: actor });
    if (r.ok) expect(changeLabel(r.writeSet.events)).toBe("Resolve note");
    const resolved = note(noteFree, { status: "resolved", resolved_at: NOW, resolved_by: ids.someoneElse });
    const back = update({ status: "open" }, "modeler", { notes: [resolved] });
    expect(ok(back).note).toMatchObject({ status: "open", resolved_at: null, resolved_by: null });
    if (back.ok) expect(changeLabel(back.writeSet.events)).toBe("Reopen note");
  });

  it("changes the colour and the width within 160–520 px", () => {
    const c = update({ color: "pink" });
    expect(ok(c).note.color).toBe("pink");
    if (c.ok) expect(changeLabel(c.writeSet.events)).toBe("Change note colour");
    const w = update({ width: 320 });
    expect(ok(w).note.width).toBe(320);
    if (w.ok) expect(changeLabel(w.writeSet.events)).toBe("Resize note");
    expect(update({ width: 159 })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(update({ width: 521 })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(update({ color: "violet" })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("refuses nothing to change, a stale version, a deleted note and readers", () => {
    expect(update({ color: "yellow" })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(update({ color: "blue", expectedVersion: 2 })).toMatchObject({ ok: false, error: { message: STALE_VERSION_MESSAGE } });
    expect(update({ color: "blue" }, "modeler", { notes: [note(noteFree, { deleted_at: NOW })] })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(update({ color: "blue" }, "reader")).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("moveNote (S3A-08)", () => {
  const move = (noteId: string, x: number, y: number) => moveNote(makeCtx(), access("modeler"), state, { noteId, expectedVersion: 1, x, y });

  it("moves a free note, which joins the frame it is dropped in or leaves its frame", () => {
    const r = move(noteFree, 2100, 100);
    expect(ok(r).note).toMatchObject({ x: 2100, y: 100, frame_id: frameB });
    if (r.ok) expect(changeLabel(r.writeSet.events)).toBe("Move note");
    const inFrame = { ...state, notes: [note(noteFree, { x: 2100, y: 100, frame_id: frameB })] };
    expect(ok(moveNote(makeCtx(), access("modeler"), inFrame, { noteId: noteFree, expectedVersion: 1, x: 3000, y: 100 })).note.frame_id).toBeNull();
  });

  it("changes a pinned note's offset; it stays in no frame", () => {
    expect(ok(move(notePinned, 20, 300)).note).toMatchObject({ pin_canvas_item_id: itemCustomer, x: 20, y: 300, frame_id: null });
  });

  it("refuses a move to the same place", () => {
    expect(move(noteFree, 1000, 900)).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });
});

describe("pinNote and unpinNote (S3A-08)", () => {
  it("pins a free note to a card or frame of its canvas; it leaves its frame", () => {
    const inFrame = { ...state, notes: [note(noteFree, { x: 2100, y: 100, frame_id: frameB })] };
    const r = pinNote(makeCtx(), access("reviewer"), inFrame, { noteId: noteFree, expectedVersion: 1, pin: { canvasItemId: itemCrmCustomer } });
    expect(ok(r).note).toMatchObject({ pin_canvas_item_id: itemCrmCustomer, pin_frame_id: null, x: 344, y: 0, frame_id: null });
    if (r.ok) expect(changeLabel(r.writeSet.events)).toBe("Pin note");
    expect(pinNote(makeCtx(), access("reviewer"), state, { noteId: notePinned, expectedVersion: 1, pin: { canvasItemId: itemCustomer } })).toMatchObject({
      ok: false,
      error: { code: "invalid", message: "The note is already pinned there." },
    });
  });

  it("unpins a note where it is, and it joins the frame it is in (prototype unpinNote)", () => {
    // pinned to Customer (400, 120) at offset (280, 0): at (680, 120), inside frame A
    const r = unpinNote(makeCtx(), access("reviewer"), state, { noteId: notePinned, expectedVersion: 1 });
    expect(ok(r).note).toMatchObject({ pin_canvas_item_id: null, pin_frame_id: null, x: 680, y: 120, frame_id: frameA });
    if (r.ok) expect(changeLabel(r.writeSet.events)).toBe("Unpin note");
    expect(unpinNote(makeCtx(), access("reviewer"), state, { noteId: noteFree, expectedVersion: 1 })).toMatchObject({
      ok: false,
      error: { message: "The note is not pinned." },
    });
  });
});

describe("deleteNote", () => {
  it("soft-deletes the note; one undo step; readers may not", () => {
    const r = deleteNote(makeCtx(), access("reviewer"), { note: note(noteFree) }, { noteId: noteFree, expectedVersion: 1 });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toMatchObject([{ kind: "update", table: "note", row: { deleted_at: NOW } }]);
    expect(changeLabel(r.writeSet.events)).toBe("Delete note");
    expect(isUndoable(r.writeSet.events)).toBe(true);
    expect(deleteNote(makeCtx(), access("reader"), { note: note(noteFree) }, { noteId: noteFree, expectedVersion: 1 })).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("releaseNotes (when cards leave and frames go)", () => {
  const before = { items: state.items, frames: state.frames };
  const onFrame = note("01900000-0000-7000-8000-00000000d003", { pin_frame_id: frameB, x: 424, y: 8 });
  const inFrame = note("01900000-0000-7000-8000-00000000d004", { x: 2100, y: 100, frame_id: frameB });
  const notes = [note(noteFree), note(notePinned), onFrame, inFrame];

  it("frees notes pinned to a card that leaves, at their place and in no frame", () => {
    const writes = releaseNotes(makeCtx(), notes, before, { cardIds: [itemCustomer] });
    expect(writes).toMatchObject([
      { kind: "update", table: "note", row: { id: notePinned, x: 680, y: 120, pin_canvas_item_id: null, frame_id: null, version: 2 } },
    ]);
  });

  it("frees notes pinned to a deleted frame and takes free notes out of it", () => {
    const writes = releaseNotes(makeCtx(), notes, before, { frameIds: [frameB] });
    expect(writes).toMatchObject([
      { row: { id: onFrame.id, x: 2424, y: 8, pin_frame_id: null, frame_id: null } },
      { row: { id: inFrame.id, x: 2100, y: 100, frame_id: null } },
    ]);
  });

  it("leaves other notes and deleted notes alone", () => {
    expect(releaseNotes(makeCtx(), [note(notePinned, { deleted_at: NOW })], before, { cardIds: [itemCustomer] })).toEqual([]);
    expect(releaseNotes(makeCtx(), notes, before, { cardIds: [itemCrmCustomer] })).toEqual([]);
    expect(releaseNotes(makeCtx(), undefined, before, { cardIds: [itemCustomer] })).toEqual([]);
  });
});
