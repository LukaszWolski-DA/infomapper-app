// Notes on a canvas (D-20, D-21, slice 3a): free or pinned to a card or a frame, open or resolved. Notes belong to
// the canvas and the working layer, not to the model. Reviewers work on notes as modelers do; readers only read them
// (Łukasz, step 0 answer 1). Every change is an undo step. The text is plain text until the rich-text editor
// (AD-30), stored as the html/text pair the server derives (AD-17). An empty new note is never saved (D-21): the
// canvas creates the note only when its text is written.

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound, type DomainError } from "../errors";
import type { Uuid } from "../ids";
import { freedAtPlace, isPinned, noteFrameAt, notePlaces, notePosition, NOTE_WIDTH, pinOffset, pinTargetRect, type NotePlaces } from "../model/notes";
import { plainTextPair } from "../model/plain-text";
import type { WorkspaceAccess } from "../permissions";
import { NOTE_COLORS, NOTE_STATUSES, type Canvas, type CanvasItem, type Frame, type Note } from "../types";
import { uuidSchema, versionSchema } from "../validation";
import { begin, current, done, isLive, nothingToChange, plainTextSchema, softDelete } from "./shared";

const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const widthSchema = z
  .number()
  .int()
  .min(NOTE_WIDTH.min, `A note is at least ${NOTE_WIDTH.min} px wide.`)
  .max(NOTE_WIDTH.max, `A note is at most ${NOTE_WIDTH.max} px wide.`);
const pinSchema = z
  .object({ canvasItemId: uuidSchema.optional(), frameId: uuidSchema.optional() })
  .strict()
  .refine((v) => (v.canvasItemId === undefined) !== (v.frameId === undefined), "Pin the note to a card or a frame.");

export const EMPTY_NOTE_MESSAGE = "Write something first: an empty note is not saved.";

/** A canvas with its cards, frames and notes (deleted rows may be included; they are skipped). */
export interface NoteCanvasState {
  canvas: Canvas | null;
  items: readonly CanvasItem[];
  frames: readonly Frame[];
  notes: readonly Note[];
}

type Opened = { ok: true; notes: Map<Uuid, Note>; places: NotePlaces; items: CanvasItem[]; frames: Frame[] } | { ok: false; error: DomainError };

function openCanvas(access: WorkspaceAccess, state: NoteCanvasState, canvasId: Uuid): Opened {
  const ws = access.workspace.id;
  if (!isLive(state.canvas, ws) || state.canvas.id !== canvasId) return { ok: false, error: notFound("canvas") };
  const items = state.items.filter((i) => isLive(i, ws) && i.canvas_id === canvasId);
  const frames = state.frames.filter((f) => isLive(f, ws) && f.canvas_id === canvasId);
  const notes = new Map(state.notes.filter((n) => isLive(n, ws) && n.canvas_id === canvasId).map((n) => [n.id, n]));
  return { ok: true, notes, places: notePlaces(items, frames), items, frames };
}

/** The note the input names, live and at the version the user read, with its canvas opened. */
function openNote(access: WorkspaceAccess, state: NoteCanvasState, noteId: Uuid, expectedVersion: number) {
  const got = current(state.notes.find((n) => n.id === noteId), access, noteId, expectedVersion, "note");
  if (!got.ok) return got;
  const opened = openCanvas(access, state, got.row.canvas_id);
  if (!opened.ok) return opened;
  return { ...opened, note: got.row };
}

/** The pin columns and offset for a card or frame of this canvas, to the right of it; not found when it is not here. */
function pinTo(places: NotePlaces, pin: { canvasItemId?: Uuid; frameId?: Uuid }): { ok: true; columns: Pick<Note, "pin_canvas_item_id" | "pin_frame_id" | "x" | "y" | "frame_id"> } | { ok: false; error: DomainError } {
  const columns = { pin_canvas_item_id: pin.canvasItemId ?? null, pin_frame_id: pin.frameId ?? null };
  const rect = pinTargetRect(columns, places);
  if (!rect) return { ok: false, error: notFound(pin.canvasItemId ? "card" : "frame") };
  return { ok: true, columns: { ...columns, ...pinOffset(rect), frame_id: null } };
}

// ---- create ----

const createInput = z
  .object({
    canvasId: uuidSchema,
    text: plainTextSchema,
    color: z.enum(NOTE_COLORS).optional(),
    /** A free note at this place (the Note tool on the empty canvas, “Add a note here”). */
    x: coordinate.optional(),
    y: coordinate.optional(),
    /** Or a note pinned to a card or a frame, placed to its right. */
    pin: pinSchema.optional(),
  })
  .strict()
  .refine((v) => (v.pin === undefined) === (v.x !== undefined && v.y !== undefined), "Place the note on the canvas or pin it to a card or a frame.")
  .refine((v) => v.pin === undefined || (v.x === undefined && v.y === undefined), "A pinned note takes its place from its card or frame.");
export type CreateNoteInput = z.input<typeof createInput>;

/**
 * Creates a note, yellow and 220 px wide unless said otherwise: free at the given place, in the frame it lands in
 * (prototype afterNoteDrop), or pinned to a card or frame of this canvas. Refused without text (D-21).
 */
export function createNote(ctx: CommandContext, access: WorkspaceAccess, state: NoteCanvasState, input: unknown): CommandResult<{ note: Note }> {
  const parsed = begin(access, "note.edit", createInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { canvasId, text, color, x, y, pin } = parsed.data;
  const opened = openCanvas(access, state, canvasId);
  if (!opened.ok) return fail(opened.error);
  const body = plainTextPair(text);
  if (!body.text) return fail(domainError("invalid", EMPTY_NOTE_MESSAGE));

  let place: Pick<Note, "pin_canvas_item_id" | "pin_frame_id" | "x" | "y" | "frame_id">;
  if (pin) {
    const pinned = pinTo(opened.places, pin);
    if (!pinned.ok) return fail(pinned.error);
    place = pinned.columns;
  } else {
    place = { pin_canvas_item_id: null, pin_frame_id: null, x: x!, y: y!, frame_id: noteFrameAt(opened.frames, { x: x!, y: y! }, opened.places.members) };
  }
  const note: Note = {
    ...newRowColumns(ctx),
    workspace_id: access.workspace.id,
    canvas_id: canvasId,
    body_html: body.html,
    body_text: body.text,
    color: color ?? "yellow",
    status: "open",
    resolved_at: null,
    resolved_by: null,
    width: NOTE_WIDTH.initial,
    ...place,
  };
  return done(ctx, access, { note }, [{ kind: "insert", table: "note", row: note }]);
}

// ---- text, colour, status, width ----

const updateInput = z
  .object({
    noteId: uuidSchema,
    expectedVersion: versionSchema,
    text: plainTextSchema.optional(),
    color: z.enum(NOTE_COLORS).optional(),
    status: z.enum(NOTE_STATUSES).optional(),
    width: widthSchema.optional(),
  })
  .strict();
export type UpdateNoteInput = z.input<typeof updateInput>;

/** Changes a note's text, colour, status or width. Resolving records who and when (server-side); reopening clears it. */
export function updateNote(ctx: CommandContext, access: WorkspaceAccess, state: NoteCanvasState, input: unknown): CommandResult<{ note: Note }> {
  const parsed = begin(access, "note.edit", updateInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { noteId, expectedVersion, text, color, status, width } = parsed.data;
  const opened = openNote(access, state, noteId, expectedVersion);
  if (!opened.ok) return fail(opened.error);
  const before = opened.note;

  const patch: Partial<Note> = {};
  if (text !== undefined) {
    const body = plainTextPair(text);
    if (body.text !== before.body_text) Object.assign(patch, { body_html: body.html, body_text: body.text });
  }
  if (color !== undefined && color !== before.color) patch.color = color;
  if (status !== undefined && status !== before.status) {
    Object.assign(patch, status === "resolved" ? { status, resolved_at: ctx.now, resolved_by: ctx.actorId } : { status, resolved_at: null, resolved_by: null });
  }
  if (width !== undefined && width !== before.width) patch.width = width;
  if (!Object.keys(patch).length) return fail(nothingToChange());
  const row = nextVersion(ctx, before, patch);
  return done(ctx, access, { note: row }, [{ kind: "update", table: "note", before, row }]);
}

// ---- move ----

const moveInput = z.object({ noteId: uuidSchema, expectedVersion: versionSchema, x: coordinate, y: coordinate }).strict();
export type MoveNoteInput = z.input<typeof moveInput>;

/**
 * Moves a note: a free note to its new place, joining the frame it is dropped in or leaving its frame (prototype
 * afterNoteDrop); a pinned note gets a new offset from its card or frame (`x`, `y` are the offset then).
 */
export function moveNote(ctx: CommandContext, access: WorkspaceAccess, state: NoteCanvasState, input: unknown): CommandResult<{ note: Note }> {
  const parsed = begin(access, "note.edit", moveInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { noteId, expectedVersion, x, y } = parsed.data;
  const opened = openNote(access, state, noteId, expectedVersion);
  if (!opened.ok) return fail(opened.error);
  const before = opened.note;
  const frame_id = isPinned(before) ? null : noteFrameAt(opened.frames, { x, y }, opened.places.members);
  if (before.x === x && before.y === y && before.frame_id === frame_id) return fail(nothingToChange());
  const row = nextVersion(ctx, before, { x, y, frame_id });
  return done(ctx, access, { note: row }, [{ kind: "update", table: "note", before, row }]);
}

// ---- pin and unpin ----

const pinInput = z.object({ noteId: uuidSchema, expectedVersion: versionSchema, pin: pinSchema }).strict();
export type PinNoteInput = z.input<typeof pinInput>;

/** Pins a note to a card or frame of its canvas (the panel's “Pin to”), placed to its right; it leaves its frame. */
export function pinNote(ctx: CommandContext, access: WorkspaceAccess, state: NoteCanvasState, input: unknown): CommandResult<{ note: Note }> {
  const parsed = begin(access, "note.edit", pinInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { noteId, expectedVersion, pin } = parsed.data;
  const opened = openNote(access, state, noteId, expectedVersion);
  if (!opened.ok) return fail(opened.error);
  const before = opened.note;
  if ((pin.canvasItemId ?? null) === before.pin_canvas_item_id && (pin.frameId ?? null) === before.pin_frame_id) {
    return fail(domainError("invalid", "The note is already pinned there."));
  }
  const pinned = pinTo(opened.places, pin);
  if (!pinned.ok) return fail(pinned.error);
  const row = nextVersion(ctx, before, pinned.columns);
  return done(ctx, access, { note: row }, [{ kind: "update", table: "note", before, row }]);
}

const unpinInput = z.object({ noteId: uuidSchema, expectedVersion: versionSchema }).strict();
export type UnpinNoteInput = z.input<typeof unpinInput>;

/** “Unpin (make it a free note)”: it stays where it is and joins the frame it is in (prototype unpinNote). */
export function unpinNote(ctx: CommandContext, access: WorkspaceAccess, state: NoteCanvasState, input: unknown): CommandResult<{ note: Note }> {
  const parsed = begin(access, "note.edit", unpinInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const opened = openNote(access, state, parsed.data.noteId, parsed.data.expectedVersion);
  if (!opened.ok) return fail(opened.error);
  const before = opened.note;
  if (!isPinned(before)) return fail(domainError("invalid", "The note is not pinned."));
  const at = notePosition(before, opened.places);
  const row = nextVersion(ctx, before, {
    x: at.x,
    y: at.y,
    pin_canvas_item_id: null,
    pin_frame_id: null,
    frame_id: noteFrameAt(opened.frames, at, opened.places.members),
  });
  return done(ctx, access, { note: row }, [{ kind: "update", table: "note", before, row }]);
}

// ---- delete ----

const deleteInput = z.object({ noteId: uuidSchema, expectedVersion: versionSchema }).strict();
export type DeleteNoteInput = z.input<typeof deleteInput>;

export function deleteNote(ctx: CommandContext, access: WorkspaceAccess, state: { note: Note | null }, input: unknown): CommandResult {
  const parsed = begin(access, "note.edit", deleteInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.note, access, parsed.data.noteId, parsed.data.expectedVersion, "note");
  if (!got.ok) return fail(got.error);
  return done(ctx, access, undefined, [softDelete(ctx, "note", got.row)]);
}

// ---- when cards leave a canvas or frames are deleted ----

/**
 * The note writes for cards that leave their canvas and frames that are deleted, in the same change group (slice 3a,
 * item 9): a note pinned to one of them stays as a free note at its place, in no frame; a free note in a deleted frame
 * stays where it is and belongs to no frame. `items` and `frames` are the canvases' rows before the change, so the
 * places are read from where the cards and frames were.
 */
export function releaseNotes(
  ctx: CommandContext,
  notes: readonly Note[] | undefined,
  before: { items: readonly CanvasItem[]; frames: readonly Frame[] },
  gone: { cardIds?: Iterable<Uuid>; frameIds?: Iterable<Uuid> },
): Write[] {
  if (!notes?.length) return [];
  const cards = new Set(gone.cardIds ?? []);
  const frames = new Set(gone.frameIds ?? []);
  if (!cards.size && !frames.size) return [];
  const live = <R extends { deleted_at: string | null }>(rows: readonly R[]) => rows.filter((r) => r.deleted_at === null);
  const places = notePlaces(live(before.items), live(before.frames));
  const writes: Write[] = [];
  for (const note of notes) {
    if (note.deleted_at !== null) continue;
    let patch: Partial<Note> | null = null;
    if ((note.pin_canvas_item_id && cards.has(note.pin_canvas_item_id)) || (note.pin_frame_id && frames.has(note.pin_frame_id))) {
      patch = freedAtPlace(note, places);
    } else if (note.frame_id && frames.has(note.frame_id)) {
      patch = { frame_id: null };
    }
    if (patch) writes.push({ kind: "update", table: "note", before: note, row: nextVersion(ctx, note, patch) });
  }
  return writes;
}
