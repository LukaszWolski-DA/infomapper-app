// Cards on a canvas (AD-16): place from the left panel, collapse, row filter, remove from this canvas; several cards
// placed or removed at once, each as one change group (slices 1b, 2a). Layout belongs to the canvas, not the model
// (D-04): removing a card leaves the entity and its mappings alone (D-02). Where cards are and how wide they are is
// changed by `moveOnCanvas` in `frame.ts`, which also decides their frames (slice 2b); a placed card joins the frame
// it lands in by the same rule (D-05).

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound, staleVersion, type DomainError } from "../errors";
import type { Uuid } from "../ids";
import { cardWidthOf, dropCards } from "../model/frames";
import type { WorkspaceAccess } from "../permissions";
import type { Canvas, CanvasItem, Entity, Frame, SourceTable } from "../types";
import { uuidSchema, versionSchema } from "../validation";
import { begin, current, done, isLive, nothingToChange, softDelete } from "./shared";

/** Canvas coordinates: finite and within a generous board. */
const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
export const positionSchema = z.object({ x: coordinate, y: coordinate });

/** Card width (D-37, C-09): 200–600 px in steps of 8; null is the default width. */
export const CARD_WIDTH = { min: 200, max: 600, step: 8 } as const;
export const widthSchema = z
  .number()
  .int()
  .min(CARD_WIDTH.min, `A card is at least ${CARD_WIDTH.min} px wide.`)
  .max(CARD_WIDTH.max, `A card is at most ${CARD_WIDTH.max} px wide.`)
  .refine((w) => w % CARD_WIDTH.step === 0, `A card's width is a multiple of ${CARD_WIDTH.step} px.`)
  .nullable();

/** The step of the canvas grid: arranged positions lie on it (D-37). */
export const GRID = 8;

/** Row filters offered in slice 1a (`labeled` comes with labels). */
export const CARD_ROW_FILTERS = ["all", "mapped", "unmapped", "keys"] as const;

export function newCanvasItem(
  ctx: CommandContext,
  workspaceId: Uuid,
  canvasId: Uuid,
  target: { entity_id: Uuid } | { source_table_id: Uuid },
  position: { x: number; y: number },
): CanvasItem {
  return {
    ...newRowColumns(ctx),
    workspace_id: workspaceId,
    canvas_id: canvasId,
    entity_id: null,
    source_table_id: null,
    requirement_id: null,
    ...target,
    x: position.x,
    y: position.y,
    width: null,
    collapsed: false,
    row_filter: "all",
    frame_id: null,
    live_level: null,
  };
}

// ---- a placed card joins the frame it lands in (D-05) ----

const height = z.number().finite().positive().max(1_000_000);
const frameRefs = z
  .array(z.object({ frameId: uuidSchema, expectedVersion: versionSchema }).strict())
  .max(200)
  .optional();

/**
 * Puts new cards that came with their height in the frame under the middle of their header, growing that frame to
 * hold them, as a drop does. A frame that grows must be named at the version the user read. Returns the frame writes.
 */
function joinFrames(
  ctx: CommandContext,
  access: WorkspaceAccess,
  canvasId: Uuid,
  frames: readonly Frame[],
  seenFrames: readonly { frameId: Uuid; expectedVersion: number }[] | undefined,
  placed: readonly { item: CanvasItem; height: number | undefined }[],
): { ok: true; writes: Write[] } | { ok: false; error: DomainError } {
  const live = frames.filter((f) => isLive(f, access.workspace.id) && f.canvas_id === canvasId);
  const sized = placed.filter((p) => p.height !== undefined);
  if (!live.length || !sized.length) return { ok: true, writes: [] };
  const result = dropCards(
    live.map((f) => ({ id: f.id, x: f.x, y: f.y, width: f.width, height: f.height })),
    sized.map(({ item, height: h }) => ({ id: item.id, x: item.x, y: item.y, width: cardWidthOf(item), height: h!, frameId: null })),
  );
  for (const m of result.membership) sized.find((p) => p.item.id === m.cardId)!.item.frame_id = m.frameId;
  const versions = new Map((seenFrames ?? []).map((f) => [f.frameId, f.expectedVersion]));
  const writes: Write[] = [];
  for (const after of result.frames) {
    const before = live.find((f) => f.id === after.id)!;
    if (before.x === after.x && before.y === after.y && before.width === after.width && before.height === after.height) continue;
    if (versions.get(before.id) !== before.version) return { ok: false, error: staleVersion() };
    writes.push({ kind: "update", table: "frame", before, row: nextVersion(ctx, before, { x: after.x, y: after.y, width: after.width, height: after.height }) });
  }
  return { ok: true, writes };
}

// ---- place ----

const placeInput = z
  .object({
    canvasId: uuidSchema,
    entityId: uuidSchema.optional(),
    sourceTableId: uuidSchema.optional(),
    ...positionSchema.shape,
    /** The new card's height as the canvas draws it: with it, the card joins the frame it lands in. */
    height: height.optional(),
    frames: frameRefs,
  })
  .strict()
  .refine((v) => (v.entityId === undefined) !== (v.sourceTableId === undefined), "Place either an entity or a source table.");
export type PlaceOnCanvasInput = z.input<typeof placeInput>;

export interface PlaceOnCanvasState {
  canvas: Canvas | null;
  entity: Entity | null;
  sourceTable: SourceTable | null;
  /** Live cards of the canvas, to refuse a second card for the same element. */
  items: readonly CanvasItem[];
  /** The canvas's frames, for the frame the card lands in (none: it joins none). */
  frames?: readonly Frame[];
}

/** Places an entity or a source table on a canvas. Each element has at most one card per canvas. */
export function placeOnCanvas(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: PlaceOnCanvasState,
  input: unknown,
): CommandResult<{ canvasItemId: Uuid }> {
  const parsed = begin(access, "canvas.edit_items", placeInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { canvasId, entityId, sourceTableId, x, y } = parsed.data;
  const workspaceId = access.workspace.id;
  if (!isLive(state.canvas, workspaceId) || state.canvas.id !== canvasId) return fail(notFound("canvas"));

  let target: { entity_id: Uuid } | { source_table_id: Uuid };
  if (entityId) {
    if (!isLive(state.entity, workspaceId) || state.entity.id !== entityId) return fail(notFound("entity"));
    target = { entity_id: entityId };
  } else {
    if (!isLive(state.sourceTable, workspaceId) || state.sourceTable.id !== sourceTableId) return fail(notFound("source table"));
    target = { source_table_id: sourceTableId! };
  }
  const already = state.items.some(
    (i) => isLive(i, workspaceId) && i.canvas_id === canvasId && (entityId ? i.entity_id === entityId : i.source_table_id === sourceTableId),
  );
  if (already) return fail(domainError("conflict", "It is already on this canvas."));

  const item = newCanvasItem(ctx, workspaceId, canvasId, target, { x, y });
  const joined = joinFrames(ctx, access, canvasId, state.frames ?? [], parsed.data.frames, [{ item, height: parsed.data.height }]);
  if (!joined.ok) return fail(joined.error);
  return done(ctx, access, { canvasItemId: item.id }, [{ kind: "insert", table: "canvas_item", row: item }, ...joined.writes]);
}

// ---- place several (feeding sources, B-08) ----

const placeManyInput = z
  .object({
    canvasId: uuidSchema,
    cards: z
      .array(
        z
          .object({ entityId: uuidSchema.optional(), sourceTableId: uuidSchema.optional(), ...positionSchema.shape, height: height.optional() })
          .strict()
          .refine((v) => (v.entityId === undefined) !== (v.sourceTableId === undefined), "Place either an entity or a source table."),
      )
      .min(1, "Nothing to place.")
      .max(200, "Place at most 200 cards at once."),
    frames: frameRefs,
  })
  .strict();
export type PlaceManyOnCanvasInput = z.input<typeof placeManyInput>;

export interface PlaceManyOnCanvasState {
  canvas: Canvas | null;
  entities: readonly Entity[];
  sourceTables: readonly SourceTable[];
  items: readonly CanvasItem[];
  frames?: readonly Frame[];
}

/**
 * Places several entities or source tables on a canvas in one change group, so one undo takes them all off again
 * (“Add the N missing to this canvas”). Elements already on the canvas are refused, as for one card.
 */
export function placeManyOnCanvas(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: PlaceManyOnCanvasState,
  input: unknown,
): CommandResult<{ canvasItemIds: Uuid[] }> {
  const parsed = begin(access, "canvas.edit_items", placeManyInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { canvasId, cards } = parsed.data;
  const workspaceId = access.workspace.id;
  if (!isLive(state.canvas, workspaceId) || state.canvas.id !== canvasId) return fail(notFound("canvas"));

  const here = new Set(
    state.items.filter((i) => isLive(i, workspaceId) && i.canvas_id === canvasId).map((i) => i.entity_id ?? i.source_table_id),
  );
  const placed: { item: CanvasItem; height: number | undefined }[] = [];
  for (const { entityId, sourceTableId, x, y, height: h } of cards) {
    const id = (entityId ?? sourceTableId)!;
    const live = entityId
      ? state.entities.some((e) => e.id === entityId && isLive(e, workspaceId))
      : state.sourceTables.some((t) => t.id === sourceTableId && isLive(t, workspaceId));
    if (!live) return fail(notFound(entityId ? "entity" : "source table"));
    if (here.has(id)) return fail(domainError("conflict", "It is already on this canvas."));
    here.add(id);
    placed.push({ item: newCanvasItem(ctx, workspaceId, canvasId, entityId ? { entity_id: entityId } : { source_table_id: id }, { x, y }), height: h });
  }
  const joined = joinFrames(ctx, access, canvasId, state.frames ?? [], parsed.data.frames, placed);
  if (!joined.ok) return fail(joined.error);
  return done(
    ctx,
    access,
    { canvasItemIds: placed.map((p) => p.item.id) },
    [...placed.map(({ item }): Write => ({ kind: "insert", table: "canvas_item", row: item })), ...joined.writes],
  );
}

// ---- collapse, row filter ----

const updateItemInput = z
  .object({
    canvasItemId: uuidSchema,
    expectedVersion: versionSchema,
    collapsed: z.boolean().optional(),
    rowFilter: z.enum(CARD_ROW_FILTERS).optional(),
  })
  .strict();
export type UpdateCanvasItemInput = z.input<typeof updateItemInput>;

/** Saves whether a card is collapsed and its row filter (per canvas). Position and width: `moveOnCanvas`. */
export function updateCanvasItem(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { item: CanvasItem | null },
  input: unknown,
): CommandResult<{ item: CanvasItem }> {
  const parsed = begin(access, "canvas.edit_items", updateItemInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { canvasItemId, expectedVersion, collapsed, rowFilter } = parsed.data;
  const got = current(state.item, access, canvasItemId, expectedVersion, "card");
  if (!got.ok) return fail(got.error);
  const before = got.row;

  const patch: Partial<CanvasItem> = {};
  if (collapsed !== undefined && collapsed !== before.collapsed) patch.collapsed = collapsed;
  if (rowFilter !== undefined && rowFilter !== before.row_filter) patch.row_filter = rowFilter;
  if (Object.keys(patch).length === 0) return fail(nothingToChange());

  const row = nextVersion(ctx, before, patch);
  return done(ctx, access, { item: row }, [{ kind: "update", table: "canvas_item", before, row }]);
}

// ---- remove from this canvas ----

const removeInput = z.object({ canvasItemId: uuidSchema, expectedVersion: versionSchema }).strict();
export type RemoveFromCanvasInput = z.input<typeof removeInput>;

/** Takes a card off this canvas. The element stays in the model, with its mappings and on other canvases (D-02). */
export function removeFromCanvas(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { item: CanvasItem | null },
  input: unknown,
): CommandResult {
  const parsed = begin(access, "canvas.edit_items", removeInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.item, access, parsed.data.canvasItemId, parsed.data.expectedVersion, "card");
  if (!got.ok) return fail(got.error);
  return done(ctx, access, undefined, [softDelete(ctx, "canvas_item", got.row)]);
}

// ---- several cards at once (slice 2a): remove ----

/** At most this many cards in one group action (the “Performance test” canvas has 101). */
const MAX_GROUP = 500;

const itemRef = { canvasItemId: uuidSchema, expectedVersion: versionSchema };

export interface CanvasItemsState {
  canvas: Canvas | null;
  /** The canvas's cards (deleted ones may be included; they are refused). */
  items: readonly CanvasItem[];
}

const removeItemsInput = z
  .object({
    canvasId: uuidSchema,
    items: z
      .array(z.object(itemRef).strict())
      .min(1, "Select at least one card.")
      .max(MAX_GROUP, `Change at most ${MAX_GROUP} cards at once.`)
      .refine((items) => new Set(items.map((i) => i.canvasItemId)).size === items.length, "A card is listed twice."),
  })
  .strict();
export type RemoveCanvasItemsInput = z.input<typeof removeItemsInput>;

/** Takes several cards off this canvas in one change group; the elements stay in the model (D-02). */
export function removeCanvasItems(ctx: CommandContext, access: WorkspaceAccess, state: CanvasItemsState, input: unknown): CommandResult<{ removed: number }> {
  const parsed = begin(access, "canvas.edit_items", removeItemsInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { canvasId, items } = parsed.data;
  const workspaceId = access.workspace.id;
  if (!isLive(state.canvas, workspaceId) || state.canvas.id !== canvasId) return fail(notFound("canvas"));
  const byId = new Map(state.items.map((i) => [i.id, i]));
  const rows: CanvasItem[] = [];
  for (const { canvasItemId, expectedVersion } of items) {
    const row = byId.get(canvasItemId);
    if (!isLive(row, workspaceId) || row.canvas_id !== canvasId) return fail(notFound("card"));
    if (row.version !== expectedVersion) return fail(staleVersion());
    rows.push(row);
  }
  return done(
    ctx,
    access,
    { removed: rows.length },
    rows.map((row) => softDelete(ctx, "canvas_item", row)),
  );
}
