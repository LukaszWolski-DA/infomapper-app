// Cards on a canvas (AD-16): place from the left panel, move, collapse, row filter, width (slice 1b, D-37), remove
// from this canvas; and the same for several selected cards at once, each as one change group (slice 2a).
// Layout belongs to the canvas, not the model (D-04): removing a card leaves the entity and its mappings alone (D-02).

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound, staleVersion, type DomainError } from "../errors";
import type { Uuid } from "../ids";
import type { WorkspaceAccess } from "../permissions";
import type { Canvas, CanvasItem, Entity, SourceTable } from "../types";
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

// ---- place ----

const placeInput = z
  .object({ canvasId: uuidSchema, entityId: uuidSchema.optional(), sourceTableId: uuidSchema.optional(), ...positionSchema.shape })
  .strict()
  .refine((v) => (v.entityId === undefined) !== (v.sourceTableId === undefined), "Place either an entity or a source table.");
export type PlaceOnCanvasInput = z.input<typeof placeInput>;

export interface PlaceOnCanvasState {
  canvas: Canvas | null;
  entity: Entity | null;
  sourceTable: SourceTable | null;
  /** Live cards of the canvas, to refuse a second card for the same element. */
  items: readonly CanvasItem[];
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
  return done(ctx, access, { canvasItemId: item.id }, [{ kind: "insert", table: "canvas_item", row: item }]);
}

// ---- place several (feeding sources, B-08) ----

const placeManyInput = z
  .object({
    canvasId: uuidSchema,
    cards: z
      .array(
        z
          .object({ entityId: uuidSchema.optional(), sourceTableId: uuidSchema.optional(), ...positionSchema.shape })
          .strict()
          .refine((v) => (v.entityId === undefined) !== (v.sourceTableId === undefined), "Place either an entity or a source table."),
      )
      .min(1, "Nothing to place.")
      .max(200, "Place at most 200 cards at once."),
  })
  .strict();
export type PlaceManyOnCanvasInput = z.input<typeof placeManyInput>;

export interface PlaceManyOnCanvasState {
  canvas: Canvas | null;
  entities: readonly Entity[];
  sourceTables: readonly SourceTable[];
  items: readonly CanvasItem[];
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
  const items: CanvasItem[] = [];
  for (const { entityId, sourceTableId, x, y } of cards) {
    const id = (entityId ?? sourceTableId)!;
    const live = entityId
      ? state.entities.some((e) => e.id === entityId && isLive(e, workspaceId))
      : state.sourceTables.some((t) => t.id === sourceTableId && isLive(t, workspaceId));
    if (!live) return fail(notFound(entityId ? "entity" : "source table"));
    if (here.has(id)) return fail(domainError("conflict", "It is already on this canvas."));
    here.add(id);
    items.push(newCanvasItem(ctx, workspaceId, canvasId, entityId ? { entity_id: entityId } : { source_table_id: id }, { x, y }));
  }
  return done(
    ctx,
    access,
    { canvasItemIds: items.map((i) => i.id) },
    items.map((row) => ({ kind: "insert", table: "canvas_item", row })),
  );
}

// ---- move, collapse, row filter, width ----

const updateItemInput = z
  .object({
    canvasItemId: uuidSchema,
    expectedVersion: versionSchema,
    x: coordinate.optional(),
    y: coordinate.optional(),
    collapsed: z.boolean().optional(),
    rowFilter: z.enum(CARD_ROW_FILTERS).optional(),
    width: widthSchema.optional(),
  })
  .strict()
  .refine((v) => (v.x === undefined) === (v.y === undefined), "A position needs x and y.");
export type UpdateCanvasItemInput = z.input<typeof updateItemInput>;

/** Saves a card's position (when a drag ends), whether it is collapsed, its row filter and its width (per canvas). */
export function updateCanvasItem(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { item: CanvasItem | null },
  input: unknown,
): CommandResult<{ item: CanvasItem }> {
  const parsed = begin(access, "canvas.edit_items", updateItemInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { canvasItemId, expectedVersion, x, y, collapsed, rowFilter, width } = parsed.data;
  const got = current(state.item, access, canvasItemId, expectedVersion, "card");
  if (!got.ok) return fail(got.error);
  const before = got.row;

  const patch: Partial<CanvasItem> = {};
  if (x !== undefined && y !== undefined && (x !== before.x || y !== before.y)) Object.assign(patch, { x, y });
  if (collapsed !== undefined && collapsed !== before.collapsed) patch.collapsed = collapsed;
  if (rowFilter !== undefined && rowFilter !== before.row_filter) patch.row_filter = rowFilter;
  if (width !== undefined && width !== before.width) patch.width = width;
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

// ---- several cards at once (slice 2a): move, arrange, widths, remove ----

/** The step of the canvas grid: arranged positions lie on it (D-37). */
export const GRID = 8;
/** At most this many cards in one group action (the “Performance test” canvas has 101). */
const MAX_GROUP = 500;

const itemRef = { canvasItemId: uuidSchema, expectedVersion: versionSchema };
const onGrid = coordinate.refine((v) => Number.isInteger(v) && v % GRID === 0, `Positions lie on the ${GRID} px grid.`);

const groupOf = <S extends z.ZodTypeAny>(item: S) =>
  z
    .array(item)
    .min(1, "Select at least one card.")
    .max(MAX_GROUP, `Change at most ${MAX_GROUP} cards at once.`)
    .refine((items) => new Set(items.map((i) => (i as { canvasItemId: string }).canvasItemId)).size === items.length, "A card is listed twice.");

export interface CanvasItemsState {
  canvas: Canvas | null;
  /** The canvas's cards (deleted ones may be included; they are refused). */
  items: readonly CanvasItem[];
}

/** Each named card: live, on this canvas, at the version the user read. */
function cardsOf(
  access: WorkspaceAccess,
  state: CanvasItemsState,
  canvasId: Uuid,
  refs: readonly { canvasItemId: Uuid; expectedVersion: number }[],
): { ok: true; rows: CanvasItem[] } | { ok: false; error: DomainError } {
  const workspaceId = access.workspace.id;
  if (!isLive(state.canvas, workspaceId) || state.canvas.id !== canvasId) return { ok: false, error: notFound("canvas") };
  const byId = new Map(state.items.map((i) => [i.id, i]));
  const rows: CanvasItem[] = [];
  for (const { canvasItemId, expectedVersion } of refs) {
    const row = byId.get(canvasItemId);
    if (!isLive(row, workspaceId) || row.canvas_id !== canvasId) return { ok: false, error: notFound("card") };
    if (row.version !== expectedVersion) return { ok: false, error: staleVersion() };
    rows.push(row);
  }
  return { ok: true, rows };
}

/** One update per card whose values change; refused when none does. */
function updates(ctx: CommandContext, rows: readonly CanvasItem[], patches: readonly Partial<CanvasItem>[]): Write[] | null {
  const writes: Write[] = [];
  rows.forEach((before, i) => {
    const patch = Object.fromEntries(Object.entries(patches[i]!).filter(([k, v]) => before[k as keyof CanvasItem] !== v));
    if (Object.keys(patch).length) writes.push({ kind: "update", table: "canvas_item", before, row: nextVersion(ctx, before, patch) });
  });
  return writes.length ? writes : null;
}

const moveInput = (position: typeof coordinate) =>
  z.object({ canvasId: uuidSchema, items: groupOf(z.object({ ...itemRef, x: position, y: position }).strict()) }).strict();
const moveItemsInput = moveInput(coordinate);
const arrangeItemsInput = moveInput(onGrid);
export type MoveCanvasItemsInput = z.input<typeof moveItemsInput>;

function moveItems(ctx: CommandContext, access: WorkspaceAccess, state: CanvasItemsState, input: unknown, schema: typeof moveItemsInput) {
  const parsed = begin(access, "canvas.edit_items", schema, input);
  if (!parsed.ok) return fail(parsed.error);
  const { canvasId, items } = parsed.data;
  const got = cardsOf(access, state, canvasId, items);
  if (!got.ok) return fail(got.error);
  const writes = updates(ctx, got.rows, items.map(({ x, y }) => ({ x, y })));
  if (!writes) return fail(nothingToChange());
  return done(ctx, access, { moved: writes.length }, writes);
}

/**
 * Moves several cards of one canvas in one change group, so one undo puts them all back: a group drag, or arrow-key
 * nudges once the keys are still. Cards whose position does not change are left out.
 */
export function moveCanvasItems(ctx: CommandContext, access: WorkspaceAccess, state: CanvasItemsState, input: unknown): CommandResult<{ moved: number }> {
  return moveItems(ctx, access, state, input, moveItemsInput);
}

/**
 * Align, stack or line up (the group toolbox): the canvas computes the positions from the cards' sizes; every
 * position must lie on the 8 px grid. One change group.
 */
export function arrangeCanvasItems(ctx: CommandContext, access: WorkspaceAccess, state: CanvasItemsState, input: unknown): CommandResult<{ moved: number }> {
  return moveItems(ctx, access, state, input, arrangeItemsInput);
}

const widthsInput = z.object({ canvasId: uuidSchema, items: groupOf(z.object({ ...itemRef, width: widthSchema }).strict()) }).strict();
export type SetCanvasItemWidthsInput = z.input<typeof widthsInput>;

/** “Fit widths to names” for several cards: the canvas measures, the domain checks the widths (D-37). One change group. */
export function setCanvasItemWidths(ctx: CommandContext, access: WorkspaceAccess, state: CanvasItemsState, input: unknown): CommandResult<{ changed: number }> {
  const parsed = begin(access, "canvas.edit_items", widthsInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { canvasId, items } = parsed.data;
  const got = cardsOf(access, state, canvasId, items);
  if (!got.ok) return fail(got.error);
  const writes = updates(ctx, got.rows, items.map(({ width }) => ({ width })));
  if (!writes) return fail(nothingToChange());
  return done(ctx, access, { changed: writes.length }, writes);
}

const removeItemsInput = z.object({ canvasId: uuidSchema, items: groupOf(z.object(itemRef).strict()) }).strict();
export type RemoveCanvasItemsInput = z.input<typeof removeItemsInput>;

/** Takes several cards off this canvas in one change group; the elements stay in the model (D-02). */
export function removeCanvasItems(ctx: CommandContext, access: WorkspaceAccess, state: CanvasItemsState, input: unknown): CommandResult<{ removed: number }> {
  const parsed = begin(access, "canvas.edit_items", removeItemsInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = cardsOf(access, state, parsed.data.canvasId, parsed.data.items);
  if (!got.ok) return fail(got.error);
  return done(
    ctx,
    access,
    { removed: got.rows.length },
    got.rows.map((row) => softDelete(ctx, "canvas_item", row)),
  );
}
