// Frames on a canvas (slice 2b, D-04 to D-06, D-14, D-17, D-23): draw one, change what it stands for, move it with its
// cards, resize it, drop cards into frames, delete it, put cards in a new frame, and arrange the canvas into frames.
// Each command is one change group (AD-13). Membership is computed here from the rules in `model/frames.ts`; card
// heights come from the canvas. Every row a command changes must be named in the input at the version the user read
// (AD-12), so a frame or card that changed meanwhile refuses the write instead of being overwritten.

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound, staleVersion, type DomainError } from "../errors";
import type { Uuid } from "../ids";
import {
  arrangeIntoFrames,
  cardsFullyInside,
  cardWidthOf,
  conceptQuestions,
  dropCards,
  frameAround,
  FRAME_MIN_SIZE,
  FREE_FRAME_COLORS,
  kindFor,
  membershipAfterResize,
  NEW_FRAME_NAME,
  type CardBox,
  type CardSubject,
  type ConceptQuestion,
  type FrameBox,
  type Rect,
} from "../model/frames";
import { checkPermission, type WorkspaceAccess } from "../permissions";
import { FRAME_KINDS, type Canvas, type CanvasItem, type Concept, type Entity, type Frame, type SourceSystem, type SourceTable } from "../types";
import { nameSchema, uuidSchema, versionSchema } from "../validation";
import { begin, current, done, isLive, nothingToChange } from "./shared";

// ---- input pieces ----

const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const extent = z.number().finite().positive().max(1_000_000);
const frameWidth = extent.min(FRAME_MIN_SIZE.width, `A frame is at least ${FRAME_MIN_SIZE.width} px wide.`);
const frameHeight = extent.min(FRAME_MIN_SIZE.height, `A frame is at least ${FRAME_MIN_SIZE.height} px high.`);
const cardHeight = extent;
const colorSchema = z.enum(FREE_FRAME_COLORS, { message: "Choose one of the frame colours." });

const MAX_CARDS = 500;
const MAX_FRAMES = 200;

const listOf = <S extends z.ZodTypeAny>(item: S, max: number, key: (v: z.output<S>) => string, twice: string) =>
  z
    .array(item)
    .max(max)
    .refine((l) => new Set(l.map(key)).size === l.length, twice);

/** A card the user saw, at the version they read. */
const cardRef = z.object({ canvasItemId: uuidSchema, expectedVersion: versionSchema }).strict();
/** A card with its height as the canvas draws it. */
const sizedCard = z.object({ canvasItemId: uuidSchema, expectedVersion: versionSchema, height: cardHeight }).strict();
const frameRef = z.object({ frameId: uuidSchema, expectedVersion: versionSchema }).strict();

const cardRefs = listOf(cardRef, MAX_CARDS, (c) => c.canvasItemId, "A card is listed twice.");
const sizedCards = listOf(sizedCard, MAX_CARDS, (c) => c.canvasItemId, "A card is listed twice.");
const frameRefs = listOf(frameRef, MAX_FRAMES, (f) => f.frameId, "A frame is listed twice.");

// ---- state and the draft every command edits ----

/** A canvas with its frames and cards (deleted rows may be included; they are skipped). */
export interface FrameCanvasState {
  canvas: Canvas | null;
  frames: readonly Frame[];
  items: readonly CanvasItem[];
}

/** The model rows a command needs to tell what cards show and to name frames. */
export interface FrameModelState {
  entities: readonly Entity[];
  sourceTables: readonly SourceTable[];
  concepts: readonly Concept[];
  sourceSystems: readonly SourceSystem[];
}

/** Copies of the canvas's live frames and cards; a command changes them, then `commit` turns the changes into writes. */
interface Draft {
  canvasId: Uuid;
  frames: Map<Uuid, Frame>;
  items: Map<Uuid, CanvasItem>;
  added: Frame[];
  originalFrames: ReadonlyMap<Uuid, Frame>;
  originalItems: ReadonlyMap<Uuid, CanvasItem>;
}

type Got<T> = { ok: true } & T;
type Failed = { ok: false; error: DomainError };

function openDraft(access: WorkspaceAccess, state: FrameCanvasState, canvasId: Uuid): Got<{ draft: Draft }> | Failed {
  const ws = access.workspace.id;
  if (!isLive(state.canvas, ws) || state.canvas.id !== canvasId) return { ok: false, error: notFound("canvas") };
  const frames = state.frames.filter((f) => isLive(f, ws) && f.canvas_id === canvasId);
  const items = state.items.filter((i) => isLive(i, ws) && i.canvas_id === canvasId);
  return {
    ok: true,
    draft: {
      canvasId,
      frames: new Map(frames.map((f) => [f.id, { ...f }])),
      items: new Map(items.map((i) => [i.id, { ...i }])),
      added: [],
      originalFrames: new Map(frames.map((f) => [f.id, f])),
      originalItems: new Map(items.map((i) => [i.id, i])),
    },
  };
}

/** The versions the user read, by id. */
interface Seen {
  frames: ReadonlyMap<Uuid, number>;
  items: ReadonlyMap<Uuid, number>;
}

const seen = (frames: readonly { frameId: Uuid; expectedVersion: number }[], items: readonly { canvasItemId: Uuid; expectedVersion: number }[]): Seen => ({
  frames: new Map(frames.map((f) => [f.frameId, f.expectedVersion])),
  items: new Map(items.map((i) => [i.canvasItemId, i.expectedVersion])),
});

function patchOf<R extends object>(before: R, after: R): Partial<R> {
  const patch: Partial<R> = {};
  for (const k of Object.keys(after) as (keyof R)[]) if (before[k] !== after[k]) patch[k] = after[k];
  return patch;
}

/** The new version of every written frame and card, for the canvas's next write. */
export interface FrameWriteResult {
  versions: Record<Uuid, number>;
}

/**
 * Turns the draft's changes into writes: new frames first, then changed frames, then changed cards. A changed row the
 * user did not name, or named at another version, refuses the whole write (stale).
 */
function commit(ctx: CommandContext, draft: Draft, saw: Seen): Got<{ writes: Write[]; versions: Record<Uuid, number> }> | Failed {
  const writes: Write[] = draft.added.map((row) => ({ kind: "insert", table: "frame", row }));
  const versions: Record<Uuid, number> = Object.fromEntries(draft.added.map((f) => [f.id, f.version]));
  for (const [id, after] of draft.frames) {
    const before = draft.originalFrames.get(id)!;
    const patch = patchOf(before, after);
    if (!Object.keys(patch).length) continue;
    if (saw.frames.get(id) !== before.version) return { ok: false, error: staleVersion() };
    const row = nextVersion(ctx, before, patch);
    writes.push({ kind: "update", table: "frame", before, row });
    versions[id] = row.version;
  }
  for (const [id, after] of draft.items) {
    const before = draft.originalItems.get(id)!;
    const patch = patchOf(before, after);
    if (!Object.keys(patch).length) continue;
    if (saw.items.get(id) !== before.version) return { ok: false, error: staleVersion() };
    const row = nextVersion(ctx, before, patch);
    writes.push({ kind: "update", table: "canvas_item", before, row });
    versions[id] = row.version;
  }
  return { ok: true, writes, versions };
}

const boxOf = (item: CanvasItem, height: number): CardBox => ({ id: item.id, x: item.x, y: item.y, width: cardWidthOf(item), height, frameId: item.frame_id });
const frameBox = (f: Frame): FrameBox => ({ id: f.id, x: f.x, y: f.y, width: f.width, height: f.height });
const liveFrames = (draft: Draft) => [...draft.frames.values()].filter((f) => f.deleted_at === null);

/** The draft's card for each named id, or not found. */
function cardsNamed(draft: Draft, ids: readonly Uuid[]): Got<{ cards: CanvasItem[] }> | Failed {
  const cards: CanvasItem[] = [];
  for (const id of ids) {
    const card = draft.items.get(id);
    if (!card) return { ok: false, error: notFound("card") };
    cards.push(card);
  }
  return { ok: true, cards };
}

function newFrame(ctx: CommandContext, access: WorkspaceAccess, canvasId: Uuid, rect: Rect, kind: Pick<Frame, "name" | "kind" | "concept_id" | "source_system_id" | "color">): Frame {
  return {
    ...newRowColumns(ctx),
    workspace_id: access.workspace.id,
    canvas_id: canvasId,
    ...kind,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    collapsed: false,
  };
}

/** What each card shows: an entity of a concept or a table of a system (live model rows only). */
function subjectsOf(access: WorkspaceAccess, model: FrameModelState) {
  const ws = access.workspace.id;
  const entities = new Map(model.entities.filter((e) => isLive(e, ws)).map((e) => [e.id, e]));
  const tables = new Map(model.sourceTables.filter((t) => isLive(t, ws)).map((t) => [t.id, t]));
  return (item: CanvasItem): CardSubject | null => {
    if (item.entity_id) {
      const e = entities.get(item.entity_id);
      return e ? { entityConceptId: e.concept_id } : null;
    }
    if (item.source_table_id) {
      const t = tables.get(item.source_table_id);
      return t ? { sourceSystemId: t.source_system_id } : null;
    }
    return null;
  };
}

// ---- create (Frame tool, “New frame here”) ----

const createInput = z
  .object({ canvasId: uuidSchema, x: coordinate, y: coordinate, width: frameWidth, height: frameHeight, cards: sizedCards })
  .strict();
export type CreateFrameInput = z.input<typeof createInput>;

/**
 * Draws a free frame “New frame” in the first free colour. It takes the named cards that are fully inside it and in
 * no other frame (D-06); `cards` are the canvas's cards with their heights.
 */
export function createFrame(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: FrameCanvasState,
  input: unknown,
): CommandResult<FrameWriteResult & { frameId: Uuid; claimed: number }> {
  const parsed = begin(access, "canvas.edit_items", createInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { canvasId, x, y, width, height, cards } = parsed.data;
  const opened = openDraft(access, state, canvasId);
  if (!opened.ok) return fail(opened.error);
  const { draft } = opened;

  const frame = newFrame(ctx, access, canvasId, { x, y, width, height }, {
    name: NEW_FRAME_NAME,
    kind: "free",
    concept_id: null,
    source_system_id: null,
    color: FREE_FRAME_COLORS[0],
  });
  draft.added.push(frame);
  const boxes = cards.flatMap((c) => {
    const item = draft.items.get(c.canvasItemId);
    return item ? [boxOf(item, c.height)] : [];
  });
  const claimed = cardsFullyInside(frame, boxes);
  for (const c of claimed) draft.items.get(c.id)!.frame_id = frame.id;

  const committed = commit(ctx, draft, seen([], cards));
  if (!committed.ok) return fail(committed.error);
  return done(ctx, access, { frameId: frame.id, claimed: claimed.length, versions: committed.versions }, committed.writes);
}

// ---- name, what it stands for, colour (frame panel) ----

const updateInput = z
  .object({
    frameId: uuidSchema,
    expectedVersion: versionSchema,
    name: nameSchema.optional(),
    kind: z.enum(FRAME_KINDS).optional(),
    conceptId: uuidSchema.optional(),
    sourceSystemId: uuidSchema.optional(),
    color: colorSchema.optional(),
  })
  .strict();
export type UpdateFrameInput = z.input<typeof updateInput>;

export interface UpdateFrameState {
  frame: Frame | null;
  concepts: readonly Concept[];
  sourceSystems: readonly SourceSystem[];
}

/**
 * Renames a frame, changes what it stands for (free area, concept, source system) or a free frame's colour. Changing
 * what it stands for never moves cards or changes the model; the misplaced marks follow from it. As in the prototype,
 * a frame still called “New frame” or after what it stood for takes the name of what it stands for now, unless a
 * name is given; a frame that becomes free keeps its colour, or takes the first free colour.
 */
export function updateFrame(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: UpdateFrameState,
  input: unknown,
): CommandResult<{ frame: Frame }> {
  const parsed = begin(access, "canvas.edit_items", updateInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { frameId, expectedVersion, name, conceptId, sourceSystemId, color } = parsed.data;
  const got = current(state.frame, access, frameId, expectedVersion, "frame");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  const ws = access.workspace.id;
  const concept = (id: Uuid | null) => state.concepts.find((c) => c.id === id && isLive(c, ws)) ?? null;
  const system = (id: Uuid | null) => state.sourceSystems.find((s) => s.id === id && isLive(s, ws)) ?? null;
  const refName = (f: Pick<Frame, "kind" | "concept_id" | "source_system_id" | "name">) =>
    f.kind === "concept" ? concept(f.concept_id)?.name : f.kind === "source_system" ? system(f.source_system_id)?.name : f.name;

  const kind = parsed.data.kind ?? before.kind;
  if ((kind !== "concept" && conceptId !== undefined) || (kind !== "source_system" && sourceSystemId !== undefined)) {
    return fail(domainError("invalid", "A frame stands for one thing: a concept, a source system or a free area."));
  }
  if (kind !== "free" && color !== undefined) return fail(domainError("invalid", "Only a free frame has its own colour."));
  const after: Frame = { ...before, kind };
  if (kind === "concept") {
    const id = conceptId ?? (before.kind === "concept" ? before.concept_id : null);
    if (!id) return fail(domainError("invalid", "Choose a concept.", { conceptId: "Choose a concept." }));
    if (!concept(id)) return fail(notFound("concept"));
    Object.assign(after, { concept_id: id, source_system_id: null });
  } else if (kind === "source_system") {
    const id = sourceSystemId ?? (before.kind === "source_system" ? before.source_system_id : null);
    if (!id) return fail(domainError("invalid", "Choose a source system.", { sourceSystemId: "Choose a source system." }));
    if (!system(id)) return fail(notFound("source system"));
    Object.assign(after, { source_system_id: id, concept_id: null });
  } else {
    Object.assign(after, { concept_id: null, source_system_id: null, color: color ?? before.color ?? FREE_FRAME_COLORS[0] });
  }
  const refChanged = after.kind !== before.kind || after.concept_id !== before.concept_id || after.source_system_id !== before.source_system_id;
  if (name !== undefined) after.name = name;
  else if (refChanged && after.kind !== "free" && (before.name === NEW_FRAME_NAME || before.name === refName(before))) after.name = refName(after)!;

  const patch = patchOf(before, after);
  if (!Object.keys(patch).length) return fail(nothingToChange());
  const row = nextVersion(ctx, before, patch);
  return done(ctx, access, { frame: row }, [{ kind: "update", table: "frame", before, row }]);
}

// ---- move (D-14), group moves, and drops (D-05) ----

const movedFrame = z.object({ frameId: uuidSchema, expectedVersion: versionSchema, x: coordinate.optional(), y: coordinate.optional() }).strict();
const movedCard = z
  .object({ canvasItemId: uuidSchema, expectedVersion: versionSchema, x: coordinate.optional(), y: coordinate.optional(), height: cardHeight.optional() })
  .strict();
const bothOrNeither = (v: { x?: number; y?: number }) => (v.x === undefined) === (v.y === undefined);

const moveInput = z
  .object({
    canvasId: uuidSchema,
    frames: listOf(movedFrame.refine(bothOrNeither, "A position needs x and y."), MAX_FRAMES, (f) => f.frameId, "A frame is listed twice."),
    items: listOf(movedCard.refine(bothOrNeither, "A position needs x and y."), MAX_CARDS, (c) => c.canvasItemId, "A card is listed twice."),
  })
  .strict();
const dropInput = moveInput.extend({ moveToConcepts: z.boolean().optional() }).strict();
export type MoveFramesInput = z.input<typeof moveInput>;
export type DropOnCanvasInput = z.input<typeof dropInput>;

/** Moves the frames that have a new position with every card in them, and the other cards that have one. */
function applyMoves(draft: Draft, input: z.output<typeof moveInput>): Got<{ loose: CanvasItem[] }> | Failed {
  const carried = new Set<Uuid>();
  for (const f of input.frames) {
    const frame = draft.frames.get(f.frameId);
    if (!frame) return { ok: false, error: notFound("frame") };
    if (f.x === undefined || f.y === undefined) continue;
    const dx = f.x - frame.x, dy = f.y - frame.y;
    frame.x = f.x;
    frame.y = f.y;
    for (const card of draft.items.values()) {
      if (card.frame_id !== frame.id) continue;
      card.x += dx;
      card.y += dy;
      carried.add(card.id);
    }
  }
  const loose: CanvasItem[] = [];
  for (const c of input.items) {
    const card = draft.items.get(c.canvasItemId);
    if (!card) return { ok: false, error: notFound("card") };
    if (carried.has(card.id) || c.x === undefined || c.y === undefined) continue;
    card.x = c.x;
    card.y = c.y;
    loose.push(card);
  }
  return { ok: true, loose };
}

/**
 * Moves frames with the cards in them (dragging a frame's name or an empty spot inside it, D-14; group nudges and
 * arranging) and other cards, in one change group. A card in a moved frame moves with it, whatever position it was
 * given. Membership does not change. Frames and cards that do not move are left out of the write.
 */
export function moveFrames(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: FrameCanvasState,
  input: unknown,
): CommandResult<FrameWriteResult & { moved: number }> {
  const parsed = begin(access, "canvas.edit_items", moveInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const opened = openDraft(access, state, parsed.data.canvasId);
  if (!opened.ok) return fail(opened.error);
  const moved = applyMoves(opened.draft, parsed.data);
  if (!moved.ok) return fail(moved.error);
  const committed = commit(ctx, opened.draft, seen(parsed.data.frames, parsed.data.items));
  if (!committed.ok) return fail(committed.error);
  if (!committed.writes.length) return fail(nothingToChange());
  return done(ctx, access, { moved: committed.writes.length, versions: committed.versions }, committed.writes);
}

export interface DropState extends FrameCanvasState {
  entities: readonly Entity[];
  concepts: readonly Concept[];
}

/**
 * A drop: a card or a group dragged to a new place. Moved frames carry their cards; every other card with a new
 * position (it needs its height) then joins the smallest frame under the middle of its header, or none, and that
 * frame grows to hold it (D-05, D-23). Entities that joined a concept frame of another concept are the drop's
 * questions; with `moveToConcepts` they move to the frame's concept in the model, in the same change group, so one
 * undo puts back the drop and the concepts together.
 */
export function dropOnCanvas(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: DropState,
  input: unknown,
): CommandResult<FrameWriteResult & { moved: number; questions: ConceptQuestion[]; movedToConcepts: number }> {
  const parsed = begin(access, "canvas.edit_items", dropInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const opened = openDraft(access, state, parsed.data.canvasId);
  if (!opened.ok) return fail(opened.error);
  const { draft } = opened;
  const moved = applyMoves(draft, parsed.data);
  if (!moved.ok) return fail(moved.error);

  const heights = new Map(parsed.data.items.map((c) => [c.canvasItemId, c.height]));
  const boxes: CardBox[] = [];
  for (const card of moved.loose) {
    const h = heights.get(card.id);
    if (h === undefined) return fail(domainError("invalid", "A dropped card needs its height."));
    boxes.push(boxOf(card, h));
  }
  const frameBefore = new Map(moved.loose.map((c) => [c.id, c.frame_id]));
  const result = dropCards(liveFrames(draft).map(frameBox), boxes);
  for (const f of result.frames) Object.assign(draft.frames.get(f.id)!, { x: f.x, y: f.y, width: f.width, height: f.height });
  for (const m of result.membership) draft.items.get(m.cardId)!.frame_id = m.frameId;

  const ws = access.workspace.id;
  const entities = new Map(state.entities.filter((e) => isLive(e, ws)).map((e) => [e.id, e]));
  const questions = conceptQuestions(
    liveFrames(draft),
    moved.loose.map((c) => ({
      cardId: c.id,
      entityId: c.entity_id,
      conceptId: c.entity_id ? (entities.get(c.entity_id)?.concept_id ?? null) : null,
      frameBefore: frameBefore.get(c.id) ?? null,
      frameAfter: c.frame_id,
    })),
  );

  const committed = commit(ctx, draft, seen(parsed.data.frames, parsed.data.items));
  if (!committed.ok) return fail(committed.error);
  const writes = [...committed.writes];
  let movedToConcepts = 0;
  if (parsed.data.moveToConcepts && questions.length) {
    const denied = checkPermission(access, "model.edit");
    if (denied) return fail(denied);
    for (const q of questions) {
      const entity = entities.get(q.entityId);
      if (!entity) return fail(notFound("entity"));
      if (!state.concepts.some((c) => c.id === q.conceptId && isLive(c, ws))) return fail(notFound("concept"));
      writes.push({ kind: "update", table: "entity", before: entity, row: nextVersion(ctx, entity, { concept_id: q.conceptId }) });
      movedToConcepts++;
    }
  }
  if (!writes.length) return fail(nothingToChange());
  return done(
    ctx,
    access,
    { moved: committed.writes.length, versions: committed.versions, questions: movedToConcepts ? [] : questions, movedToConcepts },
    writes,
  );
}

// ---- resize (D-06) ----

const resizeInput = z
  .object({ frameId: uuidSchema, expectedVersion: versionSchema, width: frameWidth, height: frameHeight, cards: cardRefs })
  .strict();
export type ResizeFrameInput = z.input<typeof resizeInput>;

/**
 * Resizes a frame from its bottom-right corner (its top-left stays). Its cards whose header middle is now outside go
 * to the frame under them or to none; free cards whose header middle is now inside join. Cards of other frames are
 * never taken (D-06). `cards` are the canvas's cards at the versions the user read.
 */
export function resizeFrame(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: FrameCanvasState,
  input: unknown,
): CommandResult<FrameWriteResult & { joined: number; left: number }> {
  const parsed = begin(access, "canvas.edit_items", resizeInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { frameId, expectedVersion, width, height, cards } = parsed.data;
  const frameRow = state.frames.find((f) => f.id === frameId) ?? null;
  const got = current(frameRow, access, frameId, expectedVersion, "frame");
  if (!got.ok) return fail(got.error);
  const opened = openDraft(access, state, got.row.canvas_id);
  if (!opened.ok) return fail(opened.error);
  const { draft } = opened;
  const frame = draft.frames.get(frameId)!;
  Object.assign(frame, { width, height });

  const changes = membershipAfterResize(frameBox(frame), liveFrames(draft).map(frameBox), [...draft.items.values()].map((i) => boxOf(i, 0)));
  for (const c of changes) draft.items.get(c.cardId)!.frame_id = c.frameId;

  const committed = commit(ctx, draft, seen([{ frameId, expectedVersion }], cards));
  if (!committed.ok) return fail(committed.error);
  if (!committed.writes.length) return fail(nothingToChange());
  const joined = changes.filter((c) => c.frameId === frameId).length;
  return done(ctx, access, { joined, left: changes.length - joined, versions: committed.versions }, committed.writes);
}

// ---- delete ----

const deleteInput = z.object({ frameId: uuidSchema, expectedVersion: versionSchema, cards: cardRefs }).strict();
export type DeleteFrameInput = z.input<typeof deleteInput>;

/** Deletes a frame; its cards stay where they are and belong to no frame. `cards` are its cards as the user read them. */
export function deleteFrame(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: FrameCanvasState,
  input: unknown,
): CommandResult<{ name: string; released: number }> {
  const parsed = begin(access, "canvas.edit_items", deleteInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { frameId, expectedVersion, cards } = parsed.data;
  const frameRow = state.frames.find((f) => f.id === frameId) ?? null;
  const got = current(frameRow, access, frameId, expectedVersion, "frame");
  if (!got.ok) return fail(got.error);
  const opened = openDraft(access, state, got.row.canvas_id);
  if (!opened.ok) return fail(opened.error);
  const { draft } = opened;
  draft.frames.get(frameId)!.deleted_at = ctx.now;
  let released = 0;
  for (const card of draft.items.values()) {
    if (card.frame_id !== frameId) continue;
    card.frame_id = null;
    released++;
  }
  const committed = commit(ctx, draft, seen([{ frameId, expectedVersion }], cards));
  if (!committed.ok) return fail(committed.error);
  return done(ctx, access, { name: got.row.name, released }, committed.writes);
}

// ---- put cards in a new frame (group toolbox, selection panel, card panel) ----

const putInput = z
  .object({ canvasId: uuidSchema, cards: sizedCards.refine((l) => l.length > 0, "Select at least one card.") })
  .strict();
export type PutInNewFrameInput = z.input<typeof putInput>;

/**
 * Draws a frame around the named cards (32 px at the sides, 40 above, 32 below) and puts them in it, also from other
 * frames: a concept frame named after the concept when all are entities of one concept, a source frame named after
 * the system when all are tables of one system, else a free frame “New frame”.
 */
export function putCardsInNewFrame(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: FrameCanvasState & FrameModelState,
  input: unknown,
): CommandResult<FrameWriteResult & { frameId: Uuid; kind: Frame["kind"]; cards: number }> {
  const parsed = begin(access, "canvas.edit_items", putInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { canvasId, cards } = parsed.data;
  const opened = openDraft(access, state, canvasId);
  if (!opened.ok) return fail(opened.error);
  const { draft } = opened;
  const named = cardsNamed(draft, cards.map((c) => c.canvasItemId));
  if (!named.ok) return fail(named.error);

  const subjectOf = subjectsOf(access, state);
  const subjects = named.cards.map(subjectOf);
  const { kind, refId } = subjects.every((s) => s !== null) ? kindFor(subjects as CardSubject[]) : { kind: "free" as const, refId: null };
  const ws = access.workspace.id;
  const name =
    (kind === "concept" && state.concepts.find((c) => c.id === refId && isLive(c, ws))?.name) ||
    (kind === "source_system" && state.sourceSystems.find((s) => s.id === refId && isLive(s, ws))?.name) ||
    NEW_FRAME_NAME;
  const heights = new Map(cards.map((c) => [c.canvasItemId, c.height]));
  const rect = frameAround(named.cards.map((c) => boxOf(c, heights.get(c.id)!)));
  const frame = newFrame(ctx, access, canvasId, rect, {
    name,
    kind,
    concept_id: kind === "concept" ? refId : null,
    source_system_id: kind === "source_system" ? refId : null,
    color: kind === "free" ? FREE_FRAME_COLORS[0] : null,
  });
  draft.added.push(frame);
  for (const card of named.cards) card.frame_id = frame.id;

  const committed = commit(ctx, draft, seen([], cards));
  if (!committed.ok) return fail(committed.error);
  return done(ctx, access, { frameId: frame.id, kind, cards: named.cards.length, versions: committed.versions }, committed.writes);
}

// ---- arrange into frames by concept and system (prototype arrangeLayout) ----

const arrangeInput = z.object({ canvasId: uuidSchema, frames: frameRefs, cards: sizedCards }).strict();
export type ArrangeIntoFramesInput = z.input<typeof arrangeInput>;

const byName = <R extends { name: string }>(a: R, b: R) => a.name.localeCompare(b.name);

/**
 * “Arrange into frames by concept and system”: free frames stay as they are; concept and source frames are deleted
 * and built again: the tables grouped by system on the left (systems and tables by name), the entities grouped by
 * concept on the right (concepts in panel order, entities by name). Every card ends up in its new frame, also cards
 * that were in a free frame. `cards` must be every card of the canvas with its height; `frames` every frame.
 */
export function arrangeCanvasIntoFrames(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: FrameCanvasState & FrameModelState,
  input: unknown,
): CommandResult<FrameWriteResult & { frames: number }> {
  const parsed = begin(access, "canvas.edit_items", arrangeInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { canvasId, frames, cards } = parsed.data;
  const opened = openDraft(access, state, canvasId);
  if (!opened.ok) return fail(opened.error);
  const { draft } = opened;
  const heights = new Map(cards.map((c) => [c.canvasItemId, c.height]));
  if ([...draft.items.keys()].some((id) => !heights.has(id))) return fail(staleVersion());

  const ws = access.workspace.id;
  const entities = new Map(state.entities.filter((e) => isLive(e, ws)).map((e) => [e.id, e]));
  const tables = new Map(state.sourceTables.filter((t) => isLive(t, ws)).map((t) => [t.id, t]));
  const placed = [...draft.items.values()];
  const sized = (c: CanvasItem) => ({ id: c.id, width: cardWidthOf(c), height: heights.get(c.id)! });

  const systemGroups = state.sourceSystems
    .filter((s) => isLive(s, ws))
    .sort(byName)
    .map((s) => ({
      refId: s.id,
      name: s.name,
      cards: placed
        .filter((c) => c.source_table_id && tables.get(c.source_table_id)?.source_system_id === s.id)
        .sort((a, b) => byName(tables.get(a.source_table_id!)!, tables.get(b.source_table_id!)!))
        .map(sized),
    }));
  const conceptGroups = state.concepts
    .filter((c) => isLive(c, ws))
    .sort((a, b) => a.sort_order - b.sort_order || byName(a, b))
    .map((concept) => ({
      refId: concept.id,
      name: concept.name,
      cards: placed
        .filter((c) => c.entity_id && entities.get(c.entity_id)?.concept_id === concept.id)
        .sort((a, b) => byName(entities.get(a.entity_id!)!, entities.get(b.entity_id!)!))
        .map(sized),
    }));
  const layout = arrangeIntoFrames(systemGroups, conceptGroups);
  if (!layout.frames.length) return fail(domainError("invalid", "There is nothing on this canvas to arrange."));

  for (const f of liveFrames(draft)) if (f.kind !== "free") f.deleted_at = ctx.now;
  for (const card of placed) card.frame_id = null;
  const names = new Map([...systemGroups, ...conceptGroups].map((g) => [g.refId, g.name]));
  for (const f of layout.frames) {
    const frame = newFrame(ctx, access, canvasId, f, {
      name: names.get(f.refId)!,
      kind: f.kind,
      concept_id: f.kind === "concept" ? f.refId : null,
      source_system_id: f.kind === "source_system" ? f.refId : null,
      color: null,
    });
    draft.added.push(frame);
    for (const id of f.cardIds) Object.assign(draft.items.get(id)!, { ...layout.positions.get(id)!, frame_id: frame.id });
  }

  const committed = commit(ctx, draft, seen(frames, cards));
  if (!committed.ok) return fail(committed.error);
  return done(ctx, access, { frames: layout.frames.length, versions: committed.versions }, committed.writes);
}
