// The working layer of “Performance test” (slice 3a, S3A-14), so the canvas is measured with labels and notes on it:
// five labels on 25 attributes, 25 columns, 30 mappings and five entity and five table headers; 24 notes, half of
// them pinned (one card in each of the 8 frames, 4 frames) and half free (6 inside frames, 6 outside them), every
// fourth resolved. Notes go on spots that touch no card, frame name or other note, so the measuring tests' clicks,
// drags and lassos on cards are not caught by a note.

import type { Uuid } from "@/domain/ids";
import { labelKey, targetColumns, type LabelTarget } from "@/domain/model/labels";
import { NOTE_PIN_GAP, NOTE_WIDTH } from "@/domain/model/notes";
import { plainTextPair } from "@/domain/model/plain-text";
import type { Label, LabelLink, Note, NoteColor } from "@/domain/types";
import { CARD_W, cardHeight, type GenDataSet } from "./large-generator";
import type { DevDb } from "./schema";

/** A note's height on the canvas is at most this with the short texts below (header, two lines, footer), with room. */
const NOTE_H = 120;
/** Room kept between a note and anything else. */
const CLEAR = 16;
/** A frame's name strip sits above its top edge. */
const NAME_STRIP = 32;

const LABELS = ["PERF-1", "PERF-2", "PERF-3", "PERF-4", "PERF-5"];
const COLORS: NoteColor[] = ["yellow", "blue", "green", "pink", "grey"];
const TEXTS = [
  "Check the load window with the source team.",
  "Is this the golden source? Ask the data owner.",
  "Key changes after the migration in March.",
  "Split into two satellites before go-live?",
  "Nulls in about 2 % of rows; agree a default.",
  "Confirmed with the business last week.",
];

type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w + CLEAR && b.x < a.x + a.w + CLEAR && a.y < b.y + b.h + CLEAR && b.y < a.y + a.h + CLEAR;

export interface LargeWorkingLayerOptions {
  db: DevDb;
  data: GenDataSet;
  workspaceId: Uuid;
  canvasId: Uuid;
  by: Uuid;
  at: string;
  /** The seed's id for a generated key (`entity:ent:3`, `card:src:7`, `frame:f2`, …). */
  id: (key: string) => Uuid;
}

export function addLargeWorkingLayer({ db, data, workspaceId, canvasId, by, at, id }: LargeWorkingLayerOptions): void {
  const std = (key: string) => ({
    id: id(key),
    workspace_id: workspaceId,
    version: 1,
    created_at: at,
    created_by: by,
    updated_at: at,
    updated_by: by,
    deleted_at: null,
  });

  // Labels: rows, mappings and a few headers, spread over the canvas.
  const targets: LabelTarget[] = [];
  const entities = data.cards.filter((c) => c.kind === "ent");
  const tables = data.cards.filter((c) => c.kind === "src");
  entities.slice(0, 25).forEach((c) => targets.push({ kind: "attribute", id: id(`attribute:${c.rows[1]!.id}`) }));
  tables.slice(0, 25).forEach((c) => targets.push({ kind: "source_column", id: id(`column:${c.rows[1]!.id}`) }));
  data.mappings.filter((_, i) => i % 10 === 0).forEach((m) => targets.push({ kind: "mapping", id: id(`mapping:${m.id}`) }));
  entities.slice(0, 5).forEach((c) => targets.push({ kind: "entity", id: id(`entity:${c.id}`) }));
  tables.slice(0, 5).forEach((c) => targets.push({ kind: "source_table", id: id(`table:${c.id}`) }));
  const labels: Label[] = LABELS.map((name) => ({ ...std(`label:${labelKey(name)}`), name, name_key: labelKey(name) }));
  db.label.push(...labels);
  targets.forEach((target, i) => {
    const label = labels[i % labels.length]!;
    const link: LabelLink = { ...std(`label_link:${label.name_key}>${target.id}`), label_id: label.id, ...targetColumns(target) };
    db.label_link.push(link);
  });

  // Notes: what they must keep clear of.
  const cardBox = new Map(data.cards.map((c) => [c.id, { x: c.x, y: c.y, w: CARD_W, h: cardHeight(c.rows.length) }]));
  const taken: Box[] = [...cardBox.values(), ...data.frames.map((f) => ({ x: f.x, y: f.y - NAME_STRIP, w: f.w, h: NAME_STRIP }))];
  const frameBoxes = data.frames.map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h }));
  const free = (b: Box, alsoFrames = false) => !taken.some((t) => overlaps(b, t)) && !(alsoFrames && frameBoxes.some((f) => overlaps(b, f)));
  const box = (x: number, y: number): Box => ({ x, y, w: NOTE_WIDTH.initial, h: NOTE_H });

  let n = 0;
  const note = (place: Pick<Note, "x" | "y" | "pin_canvas_item_id" | "pin_frame_id" | "frame_id">, at_: Box) => {
    const i = n++;
    const body = plainTextPair(TEXTS[i % TEXTS.length]!);
    const resolved = i % 4 === 3;
    db.note.push({
      ...std(`note:${i}`),
      canvas_id: canvasId,
      body_html: body.html,
      body_text: body.text,
      color: COLORS[i % COLORS.length]!,
      status: resolved ? "resolved" : "open",
      resolved_at: resolved ? at : null,
      resolved_by: resolved ? by : null,
      width: NOTE_WIDTH.initial,
      ...place,
    });
    taken.push(at_);
  };

  // 8 notes pinned to a card in each frame: to its right, below or to its left, wherever there is room.
  for (const f of data.frames) {
    const placed = f.cards.some((cardId) => {
      const c = cardBox.get(cardId)!;
      const offsets = [
        { x: CARD_W + NOTE_PIN_GAP, y: 0 },
        { x: 0, y: c.h + NOTE_PIN_GAP },
        { x: -NOTE_WIDTH.initial - NOTE_PIN_GAP, y: 0 },
      ];
      const o = offsets.find((o) => free(box(c.x + o.x, c.y + o.y)));
      if (!o) return false;
      note({ x: o.x, y: o.y, pin_canvas_item_id: id(`card:${cardId}`), pin_frame_id: null, frame_id: null }, box(c.x + o.x, c.y + o.y));
      return true;
    });
    if (!placed) throw new Error(`No room for a note on a card of the frame ${f.name}.`);
  }

  // 4 notes pinned to frames: above the frame's name, or to its right.
  for (const f of data.frames.slice(0, 4)) {
    const offsets = [
      { x: 0, y: -NAME_STRIP - NOTE_PIN_GAP - NOTE_H },
      { x: f.w + NOTE_PIN_GAP, y: 0 },
    ];
    const o = offsets.find((o) => free(box(f.x + o.x, f.y + o.y), true));
    if (!o) throw new Error(`No room for a note on the frame ${f.name}.`);
    note({ x: o.x, y: o.y, pin_canvas_item_id: null, pin_frame_id: id(`frame:${f.id}`), frame_id: null }, box(f.x + o.x, f.y + o.y));
  }

  // 6 free notes inside frames: the first empty spot in each of the frames that has one.
  let inFrames = 0;
  for (const f of data.frames) {
    if (inFrames === 6) break;
    const spot = scan(f.x + CLEAR, f.y + CLEAR, f.x + f.w - NOTE_WIDTH.initial - CLEAR, f.y + f.h - NOTE_H - CLEAR, (x, y) => free(box(x, y)));
    if (!spot) continue;
    note({ ...spot, pin_canvas_item_id: null, pin_frame_id: null, frame_id: id(`frame:${f.id}`) }, box(spot.x, spot.y));
    inFrames++;
  }
  if (inFrames < 6) throw new Error(`Room for only ${inFrames} free notes inside frames.`);

  // 6 free notes outside frames: the first free spots below the frames (the gap above the cards in no frame).
  const bottom = Math.max(...data.frames.map((f) => f.y + f.h));
  const right = Math.max(...data.cards.map((c) => c.x + CARD_W));
  for (let k = 0; k < 6; k++) {
    const spot = scan(0, bottom + CLEAR, right, bottom + 4000, (x, y) => free(box(x, y), true));
    if (!spot) throw new Error("No room for a free note outside the frames.");
    note({ ...spot, pin_canvas_item_id: null, pin_frame_id: null, frame_id: null }, box(spot.x, spot.y));
  }
}

/** The first spot on an 8 px grid inside the bounds (top to bottom, left to right) that `ok` accepts. */
function scan(x0: number, y0: number, x1: number, y1: number, ok: (x: number, y: number) => boolean): { x: number; y: number } | null {
  const snap = (v: number) => Math.ceil(v / 8) * 8;
  for (let y = snap(y0); y <= y1; y += 8) for (let x = snap(x0); x <= x1; x += 8) if (ok(x, y)) return { x, y };
  return null;
}
