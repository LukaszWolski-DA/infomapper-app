// Cards on a canvas (AD-16): place from the left panel, move, collapse, row filter, width (slice 1b, D-37), remove
// from this canvas.
// Layout belongs to the canvas, not the model (D-04): removing a card leaves the entity and its mappings alone (D-02).

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult } from "../changes";
import { domainError, notFound } from "../errors";
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
const widthSchema = z
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
