// Slice 3a, step 3: notes on the canvas as plain data — what the client gets, where each note shows, the tethers.
// Step 4: the numbers on card headers and collapsed blocks, and the first line the lists show.

import { describe, expect, it } from "vitest";
import { frame, ids, note } from "@/domain/__fixtures__/domain";
import { buildNotes, countsKey, countsOf, firstLine, frameNoteCounts, noteAt, noteDate, noteShown, cardNoteCounts, placesOf, tether, type NoteData } from "./note-data";

const { itemCustomer, frameA, noteFree, notePinned } = ids;
const names = (id: string) => (id === ids.actor ? "Łukasz" : "Piotr Wiśniewski");

describe("buildNotes", () => {
  it("gives the client the note's text, look, place, pin, frame, the frame's place and who created it", () => {
    const [n] = buildNotes([note(noteFree, { frame_id: frameA, created_by: ids.actor })], [frame(frameA, { x: 40, y: 48 })], names);
    expect(n).toEqual({
      id: noteFree,
      version: 1,
      text: "Check the e-mail source",
      color: "yellow",
      status: "open",
      width: 220,
      pinCardId: null,
      pinFrameId: null,
      x: 1000,
      y: 900,
      frameId: frameA,
      anchor: { x: 40, y: 48 },
      createdAt: note(noteFree).created_at,
      createdBy: "Łukasz",
    });
    expect(buildNotes([note(noteFree, { body_text: null })], [], names)[0]!.text).toBe("");
  });
});

describe("where a note shows (item 9)", () => {
  const [free, pinned] = buildNotes([note(noteFree, { frame_id: frameA, x: 100, y: 100 }), note(notePinned)], [frame(frameA)], names) as [NoteData, NoteData];
  const card = { id: itemCustomer, x: 400, y: 120, width: null, frameId: null };

  it("puts a pinned note at its card plus its offset, following the card while it moves", () => {
    expect(noteAt(pinned, placesOf([card], []))).toEqual({ x: 680, y: 120 });
    expect(noteAt(pinned, placesOf([{ ...card, x: 480, y: 200 }], []))).toEqual({ x: 760, y: 200 });
  });

  it("moves a free note in a frame with its frame (the frame's place now against the place the note was read with)", () => {
    expect(noteAt(free, placesOf([], [frame(frameA)]))).toEqual({ x: 100, y: 100 });
    expect(noteAt(free, placesOf([], [frame(frameA, { x: 64, y: -16 })]))).toEqual({ x: 164, y: 84 });
    // a note outside any frame stays where it is
    expect(noteAt({ ...free, frameId: null, anchor: null }, placesOf([], [frame(frameA, { x: 64 })]))).toEqual({ x: 100, y: 100 });
  });

  it("hides a free note while its frame is collapsed, and a note pinned to a card that is not on the canvas", () => {
    expect(noteShown(free, placesOf([], [frame(frameA)]))).toBe(true);
    expect(noteShown(free, placesOf([], [frame(frameA, { collapsed: true })]))).toBe(false);
    expect(noteShown(pinned, placesOf([], []))).toBe(false);
    expect(noteShown(pinned, placesOf([card], []))).toBe(true);
  });
});

describe("the tether of a pinned note (prototype tethers)", () => {
  it("joins the nearest points of the note and its element, with the dot on the element", () => {
    // a note to the right of a card, level with its top
    expect(tether({ x: 680, y: 120, w: 220, h: 80 }, { x: 400, y: 120, w: 256, h: 200 })).toEqual({ x1: 680, y1: 200, x2: 656, y2: 160 });
  });

  it("draws none when the note lies on its element", () => {
    expect(tether({ x: 418, y: 180, w: 220, h: 80 }, { x: 400, y: 120, w: 256, h: 200 })).toBeNull();
  });
});

describe("noteDate", () => {
  it("reads like the prototype's dates", () => {
    expect(noteDate("2026-10-10T12:00:00.000Z")).toBe("10 Oct 2026");
  });
});

describe("notes elsewhere (item 12, S3A-09)", () => {
  const n = (over: Partial<NoteData>) => ({ pinCardId: null, pinFrameId: null, frameId: null, status: "open" as const, ...over });

  it("counts the notes pinned to each card that are shown: resolved ones only while shown, never free ones", () => {
    const notes = [n({ pinCardId: "c1" }), n({ pinCardId: "c1" }), n({ pinCardId: "c1", status: "resolved" }), n({ pinCardId: "c2" }), n({ frameId: "F1" })];
    expect([...cardNoteCounts(notes)]).toEqual([
      ["c1", 3],
      ["c2", 1],
    ]);
    expect([...cardNoteCounts(notes, true)]).toEqual([
      ["c1", 2],
      ["c2", 1],
    ]);
  });

  it("counts a frame's notes for its block: pinned to it or free in it, resolved ones only while they are shown", () => {
    const notes = [n({ pinFrameId: "F1" }), n({ frameId: "F1", status: "resolved" }), n({ pinCardId: "c1" }), n({ frameId: "F2" }), n({})];
    const counts = frameNoteCounts(notes);
    expect(counts.get("F1")).toBe(2);
    expect(counts.get("F2")).toBe(1);
    expect(counts.size).toBe(2);
    expect(frameNoteCounts(notes, true).get("F1")).toBe(1);
    expect(frameNoteCounts([n({ pinFrameId: "F1", status: "resolved" })], true).size).toBe(0);
  });

  it("keys the counts so a memo changes only when a number does", () => {
    const a = new Map([["c2", 1], ["c1", 3]]);
    expect(countsKey(a)).toBe(countsKey(new Map([["c1", 3], ["c2", 1]])));
    expect(countsOf(countsKey(a))).toEqual(new Map([["c1", 3], ["c2", 1]]));
    expect(countsOf("").size).toBe(0);
  });

  it("shows a note's first line with text, or nothing for an empty note", () => {
    expect(firstLine("\n  Ask the ERP team  \nabout status")).toBe("Ask the ERP team");
    expect(firstLine(" \n ")).toBe("");
  });
});
