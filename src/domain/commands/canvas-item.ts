// Cards on a canvas (AD-16): place from the left panel, collapse, row filter, remove from this canvas; several cards
// placed or removed at once, each as one change group (slices 1b, 2a). Layout belongs to the canvas, not the model
// (D-04): removing a card leaves the entity and its mappings alone (D-02). Where cards are and how wide they are is
// changed by `moveOnCanvas` in `frame.ts`, which also decides their frames (slice 2b); a placed card joins the frame
// it lands in by the same rule (D-05). Slice 3a: notes pinned to a card that leaves the canvas become free notes at
// their place, in the same change group.

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound, staleVersion, type DomainError } from "../errors";
import type { Uuid } from "../ids";
import { cardWidthOf, dropCards } from "../model/frames";
import { LIVE_ONE_AT_A_TIME, LIVE_REMOVE_UNLABELS } from "../model/live";
import { checkPermission, type WorkspaceAccess } from "../permissions";
import { isElementCard, isRequirementCard } from "../model/card-kinds";
import { cardMode, exceptionFor, type NameDimension } from "../model/aliases";
import { NAME_MODES, type Canvas, type CanvasItem, type Entity, type Frame, type Note, type Requirement, type SourceTable } from "../types";
import { uuidSchema, versionSchema } from "../validation";
import { releaseNotes } from "./note";
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

/** Row filters offered on every canvas; `labeled` only on live canvases (slice 3b). */
export const CARD_ROW_FILTERS = ["all", "mapped", "unmapped", "keys"] as const;
const SAVED_ROW_FILTERS = [...CARD_ROW_FILTERS, "labeled"] as const;

export function newCanvasItem(
  ctx: CommandContext,
  workspaceId: Uuid,
  canvasId: Uuid,
  target: { entity_id: Uuid } | { source_table_id: Uuid } | { requirement_id: Uuid },
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
    entity_names: null,
    attribute_names: null,
  };
}

// ---- a placed card joins the frame it lands in (D-05) ----

export const cardHeightSchema = z.number().finite().positive().max(1_000_000);
const height = cardHeightSchema;
export const frameRefsSchema = z
  .array(z.object({ frameId: uuidSchema, expectedVersion: versionSchema }).strict())
  .max(200)
  .optional();

/**
 * Puts new cards that came with their height in the frame under the middle of their header, growing that frame to
 * hold them, as a drop does. A frame that grows must be named at the version the user read. Returns the frame writes.
 * A placed card never joins a collapsed frame, except when it was dragged from the left panel onto the frame's block
 * (`drag`, slice 2c): then it is filed at the frame's bottom like a card dropped there. `items` are the canvas's
 * cards, for the blocks' sizes.
 */
export function joinFrames(
  ctx: CommandContext,
  access: WorkspaceAccess,
  canvasId: Uuid,
  frames: readonly Frame[],
  seenFrames: readonly { frameId: Uuid; expectedVersion: number }[] | undefined,
  placed: readonly { item: CanvasItem; height: number | undefined }[],
  options: { drag?: boolean; items?: readonly CanvasItem[] } = {},
): { ok: true; writes: Write[] } | { ok: false; error: DomainError } {
  const live = frames.filter((f) => isLive(f, access.workspace.id) && f.canvas_id === canvasId);
  const sized = placed.filter((p) => p.height !== undefined);
  if (!live.length || !sized.length) return { ok: true, writes: [] };
  const members = new Map<Uuid, number>();
  for (const i of options.items ?? []) {
    if (isLive(i, access.workspace.id) && i.canvas_id === canvasId && i.frame_id) members.set(i.frame_id, (members.get(i.frame_id) ?? 0) + 1);
  }
  const result = dropCards(
    live.map((f) => ({ id: f.id, x: f.x, y: f.y, width: f.width, height: f.height, collapsed: f.collapsed, members: members.get(f.id) ?? 0 })),
    sized.map(({ item, height: h }) => ({ id: item.id, x: item.x, y: item.y, width: cardWidthOf(item), height: h!, frameId: null })),
    { drag: options.drag },
  );
  for (const m of result.membership) Object.assign(sized.find((p) => p.item.id === m.cardId)!.item, { frame_id: m.frameId }, m.filed ?? {});
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
    frames: frameRefsSchema,
    /** Dragged from the left panel and dropped (slice 2c): it may join a collapsed frame by landing on its block. */
    dragDrop: z.boolean().optional(),
    /** The answer to the drop's concept question (D-05): move the entity to the frame's concept in the model. */
    moveToConcepts: z.boolean().optional(),
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

/**
 * Places an entity or a source table on a canvas. Each element has at most one card per canvas. Dropped from the left
 * panel on a collapsed frame's block, it is filed into that frame; with `moveToConcepts` an entity that joined a concept
 * frame of another concept moves to it in the model, in the same change group (slice 2c, Łukasz's step 1 answer 2).
 */
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
  const joined = joinFrames(ctx, access, canvasId, state.frames ?? [], parsed.data.frames, [{ item, height: parsed.data.height }], {
    drag: parsed.data.dragDrop,
    items: state.items,
  });
  if (!joined.ok) return fail(joined.error);
  const writes: Write[] = [{ kind: "insert", table: "canvas_item", row: item }, ...joined.writes];
  const frame = item.frame_id ? (state.frames ?? []).find((f) => f.id === item.frame_id) : undefined;
  const entity = state.entity;
  if (parsed.data.moveToConcepts && entity && entityId && frame?.kind === "concept" && frame.concept_id && frame.concept_id !== entity.concept_id) {
    const denied = checkPermission(access, "model.edit");
    if (denied) return fail(denied);
    writes.push({ kind: "update", table: "entity", before: entity, row: nextVersion(ctx, entity, { concept_id: frame.concept_id }) });
  }
  return done(ctx, access, { canvasItemId: item.id }, writes);
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
    frames: frameRefsSchema,
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
  if (state.canvas.live_label_id) return fail(domainError("invalid", LIVE_ONE_AT_A_TIME));

  const here = new Set(
    state.items.filter((i) => isLive(i, workspaceId) && i.canvas_id === canvasId && isElementCard(i)).map((i) => i.entity_id ?? i.source_table_id),
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

// ---- collapse, row filter, names or aliases (slice 11) ----

const updateItemInput = z
  .object({
    canvasItemId: uuidSchema,
    expectedVersion: versionSchema,
    collapsed: z.boolean().optional(),
    rowFilter: z.enum(SAVED_ROW_FILTERS).optional(),
    /** The card's own choice of entity name or alias (slice 11, item 9); null follows the canvas. */
    entityNames: z.enum(NAME_MODES).nullable().optional(),
    /** The same for its attribute names. */
    attributeNames: z.enum(NAME_MODES).nullable().optional(),
  })
  .strict();
export type UpdateCanvasItemInput = z.input<typeof updateItemInput>;

/**
 * Saves whether a card is collapsed and its row filter (per canvas). Position and width: `moveOnCanvas`. The `labeled`
 * filter (the rows that carry the label) exists only on live canvases (`canvas`: the card's canvas; slice 3b). Slice 11:
 * an entity card's exceptions to the canvas's names or aliases; a choice equal to the canvas's mode is stored as none.
 */
export function updateCanvasItem(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { item: CanvasItem | null; canvas?: Canvas | null },
  input: unknown,
): CommandResult<{ item: CanvasItem }> {
  const parsed = begin(access, "canvas.edit_items", updateItemInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { canvasItemId, expectedVersion, collapsed, rowFilter, entityNames, attributeNames } = parsed.data;
  const got = current(state.item, access, canvasItemId, expectedVersion, "card");
  if (!got.ok) return fail(got.error);
  const before = got.row;

  const patch: Partial<CanvasItem> = {};
  if (collapsed !== undefined && collapsed !== before.collapsed) patch.collapsed = collapsed;
  if (rowFilter !== undefined && rowFilter !== before.row_filter) patch.row_filter = rowFilter;
  if (patch.row_filter === "labeled" && !(state.canvas?.id === before.canvas_id && state.canvas.live_label_id)) {
    return fail(domainError("invalid", "The Labeled filter is only on live canvases."));
  }
  if (entityNames !== undefined || attributeNames !== undefined) {
    if (!before.entity_id) return fail(domainError("invalid", ALIASES_ON_ENTITY_CARDS));
    const canvas = state.canvas;
    if (!isLive(canvas, access.workspace.id) || canvas.id !== before.canvas_id) return fail(notFound("canvas"));
    const entity = entityNames === undefined ? undefined : exceptionFor(entityNames, canvas, "entity");
    const attribute = attributeNames === undefined ? undefined : exceptionFor(attributeNames, canvas, "attribute");
    if (entity !== undefined && entity !== before.entity_names) patch.entity_names = entity;
    if (attribute !== undefined && attribute !== before.attribute_names) patch.attribute_names = attribute;
  }
  if (Object.keys(patch).length === 0) return fail(nothingToChange());

  const row = nextVersion(ctx, before, patch);
  const result = done(ctx, access, { item: row }, [{ kind: "update", table: "canvas_item", before, row }]);
  // the undo history names what the card shows now, which the change event alone cannot tell (null: as the canvas)
  const keys = Object.keys(patch);
  const names: NameDimension | null = keys.length !== 1 ? null : keys[0] === "entity_names" ? "entity" : keys[0] === "attribute_names" ? "attribute" : null;
  if (result.ok && names && state.canvas) result.writeSet.label = CARD_NAMES_LABEL[names][cardMode(row, state.canvas, names)];
  return result;
}

/** The undo history's names of a card's choice (slice 11). */
export const CARD_NAMES_LABEL = {
  entity: { name: "Show entity name on card", alias: "Show entity alias on card" },
  attribute: { name: "Show attribute names on card", alias: "Show attribute aliases on card" },
} as const;

/** The refusal of a name or alias choice on a table or requirement card (slice 11, item 3). */
export const ALIASES_ON_ENTITY_CARDS = "Only entity cards show aliases.";

// ---- remove from this canvas ----

const removeInput = z.object({ canvasItemId: uuidSchema, expectedVersion: versionSchema }).strict();
export type RemoveFromCanvasInput = z.input<typeof removeInput>;

/**
 * Takes a card off this canvas. The element stays in the model, with its mappings and on other canvases (D-02). Notes
 * pinned to the card become free notes at their place (`notes`: the canvas's notes).
 */
export function removeFromCanvas(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { item: CanvasItem | null; notes?: readonly Note[]; canvas?: Canvas | null },
  input: unknown,
): CommandResult {
  const parsed = begin(access, "canvas.edit_items", removeInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.item, access, parsed.data.canvasItemId, parsed.data.expectedVersion, "card");
  if (!got.ok) return fail(got.error);
  // on a live canvas, removing a card takes its label off (`removeFromLiveCanvas`, slice 3b); a requirement card is
  // layout only there (slice 4b-2, G)
  if (isElementCard(got.row) && state.canvas?.id === got.row.canvas_id && state.canvas.live_label_id) return fail(domainError("invalid", LIVE_REMOVE_UNLABELS));
  return done(ctx, access, undefined, [
    softDelete(ctx, "canvas_item", got.row),
    ...releaseNotes(ctx, state.notes, { items: [got.row], frames: [] }, { cardIds: [got.row.id] }),
  ]);
}

// ---- several cards at once (slice 2a): remove ----

/** At most this many cards in one group action (the “Performance test” canvas has 101). */
const MAX_GROUP = 500;

const itemRef = { canvasItemId: uuidSchema, expectedVersion: versionSchema };

export interface CanvasItemsState {
  canvas: Canvas | null;
  /** The canvas's cards (deleted ones may be included; they are refused). */
  items: readonly CanvasItem[];
  /** The canvas's notes: notes pinned to a removed card become free (slice 3a). */
  notes?: readonly Note[];
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
  // several requirement cards may leave a live canvas together (layout only, slice 4b-2, G); element cards may not
  if (state.canvas.live_label_id && rows.some(isElementCard)) return fail(domainError("invalid", LIVE_REMOVE_UNLABELS));
  return done(ctx, access, { removed: rows.length }, [
    ...rows.map((row) => softDelete(ctx, "canvas_item", row)),
    ...releaseNotes(ctx, state.notes, { items: rows, frames: [] }, { cardIds: rows.map((r) => r.id) }),
  ]);
}

// ---- requirement cards (slice 4b-2) ----

const placeRequirementsInput = z
  .object({
    canvasId: uuidSchema,
    cards: z
      .array(z.object({ requirementId: uuidSchema, ...positionSchema.shape }).strict())
      .min(1, "Nothing to place.")
      .max(200, "Place at most 200 cards at once.")
      .refine((cards) => new Set(cards.map((c) => c.requirementId)).size === cards.length, "A requirement is listed twice."),
  })
  .strict();
export type PlaceRequirementCardsInput = z.input<typeof placeRequirementsInput>;

export interface PlaceRequirementCardsState {
  canvas: Canvas | null;
  requirements: readonly Requirement[];
  /** Live cards of the canvas, to refuse a second card for the same requirement. */
  items: readonly CanvasItem[];
}

/** The refusal when a requirement's card is on the canvas already (one card per requirement per canvas). */
export const REQUIREMENT_CARD_THERE = "Its card is already on this canvas.";

/**
 * Places the cards of one or more requirements on a canvas, in one change group (“Place its card”, “Add all to this
 * canvas”; PRD items 13–15). A requirement card is layout only: it joins no frame, and on a live canvas it changes no
 * label (G). Each requirement has at most one card per canvas.
 */
export function placeRequirementCards(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: PlaceRequirementCardsState,
  input: unknown,
): CommandResult<{ canvasItemIds: Uuid[] }> {
  const parsed = begin(access, "canvas.edit_items", placeRequirementsInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { canvasId, cards } = parsed.data;
  const workspaceId = access.workspace.id;
  if (!isLive(state.canvas, workspaceId) || state.canvas.id !== canvasId) return fail(notFound("canvas"));
  const here = new Set(state.items.filter((i) => isLive(i, workspaceId) && i.canvas_id === canvasId && isRequirementCard(i)).map((i) => i.requirement_id));
  const rows: CanvasItem[] = [];
  for (const { requirementId, x, y } of cards) {
    if (!state.requirements.some((r) => r.id === requirementId && isLive(r, workspaceId))) return fail(notFound("requirement"));
    if (here.has(requirementId)) return fail(domainError("conflict", REQUIREMENT_CARD_THERE));
    rows.push(newCanvasItem(ctx, workspaceId, canvasId, { requirement_id: requirementId }, { x, y }));
  }
  return done(ctx, access, { canvasItemIds: rows.map((r) => r.id) }, rows.map((row): Write => ({ kind: "insert", table: "canvas_item", row })));
}

/**
 * The cards of requirements on every canvas, soft-deleted with them (deleting a requirement, PRD item 7) in the
 * deleting command's change group, so one undo brings them back.
 */
export function requirementCardsGone(ctx: CommandContext, workspaceId: Uuid, items: readonly CanvasItem[], requirementIds: ReadonlySet<Uuid>): Write[] {
  return items
    .filter((i) => isLive(i, workspaceId) && i.requirement_id !== null && requirementIds.has(i.requirement_id))
    .map((i) => softDelete(ctx, "canvas_item", i));
}
