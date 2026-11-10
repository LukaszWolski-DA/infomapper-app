// Entity commands: create from “+” per concept (D-46), edit in the right panel, delete with its impact (D-47).

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound } from "../errors";
import type { Uuid } from "../ids";
import { entityCascade, type EntityRows } from "../model/impact";
import { DIMENSIONAL_STEREOTYPE_MESSAGE, isDimensional } from "../model/levels";
import { DEFAULT_STEREOTYPE, isBuiltinStereotypeCode, stereotypeIndex, UNKNOWN_STEREOTYPE } from "../model/stereotypes";
import { sanitizeRich } from "../model/rich-text";
import type { WorkspaceAccess } from "../permissions";
import { type ModelLevel, type Canvas, type CanvasItem, type Concept, type Entity, type Frame, type LabelLink, type Note, type RequirementLink, type Stereotype } from "../types";
import { nameSchema, optionalTextSchema, uuidSchema, versionSchema } from "../validation";
import { begin, current, done, isLive, nothingToChange, richTextSchema, softDelete } from "./shared";
import { cardHeightSchema, frameRefsSchema, joinFrames, newCanvasItem, positionSchema } from "./canvas-item";
import { linksOnItems, softDeleteLinks } from "./label";
import { newConcept, tidyName } from "./concept";
import { softDeleteRequirementLinks } from "./requirement";
import { releaseNotes } from "./note";

const DEFAULT_ENTITY_NAME = "New entity";

/** The warning for a duplicate entity name (B-25): shown, never blocking. */
export const duplicateNameWarning = (name: string): string =>
  `Another entity is already called “${name}”. Rename one of them if they mean different things.`;

const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/** Names are compared within one model level (slice 15a, X-6, F10): a fact may share a logical entity's name. */
function hasDuplicate(entities: readonly Entity[], name: string, exceptId: Uuid | null, level: ModelLevel): boolean {
  return entities.some((e) => e.id !== exceptId && e.deleted_at === null && e.model_level === level && sameName(e.name, name));
}

/** “New entity”, or “New entity 2”, “New entity 3”… when the name is taken in the level (a module's base name too). */
function freeDefaultName(entities: readonly Entity[], level: ModelLevel, base = DEFAULT_ENTITY_NAME): string {
  let name = base;
  for (let n = 2; hasDuplicate(entities, name, null, level); n++) name = `${base} ${n}`;
  return name;
}

/**
 * How a module creates an entity through this command (slice 15a, E5): its level, set here and never changed, and the
 * default name's base ("New fact"). Not part of the input: no browser chooses a level.
 */
export interface CreateEntityOptions {
  level: ModelLevel;
  defaultName?: string;
}

// ---- create ----

const createEntityInput = z
  .object({
    /** The concept it belongs to, or (slice 21, D-76) a new concept made with it, in the same change group. */
    conceptId: uuidSchema.optional(),
    newConcept: z.object({ name: nameSchema }).strict().optional(),
    name: nameSchema.optional(),
    /**
     * Where to place the card: the panel finds a free spot near the middle of the view (D-46). With the card's height
     * it joins the frame it lands in, which grows to hold it (slice 2b, D-05); `frames` are the canvas's frames at the
     * versions the user read.
     */
    placement: z
      .object({ canvasId: uuidSchema, ...positionSchema.shape, height: cardHeightSchema.optional(), frames: frameRefsSchema })
      .strict()
      .optional(),
  })
  .strict()
  .refine((v) => (v.conceptId === undefined) !== (v.newConcept === undefined), { message: "Choose a concept." });
export type CreateEntityInput = z.input<typeof createEntityInput>;

/** The undo step of an entity made with a new concept (slice 21, D-76). */
export const newConceptLabel = (entity: string, concept: string) => `Create ${entity} in new concept ${concept}`;

export interface CreateEntityState {
  concept: Concept | null;
  /** The workspace's concepts, for a new concept's colour and place (slice 21); needed only with `newConcept`. */
  concepts?: readonly Concept[];
  /** Live entities of the workspace, for the default name and the duplicate warning. */
  entities: readonly Entity[];
  /** The canvas to place the card on, when the input has a placement. */
  canvas: Canvas | null;
  /** The canvas's frames, for the frame the card lands in (slice 2b). */
  frames?: readonly Frame[];
}

/** Creates an entity in a concept and, when asked, its card on a canvas, as one change. */
export function createEntity(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: CreateEntityState,
  input: unknown,
  options: CreateEntityOptions = { level: "logical" },
): CommandResult<{ entityId: Uuid; canvasItemId: Uuid | null; warning: string | null; concept: { id: Uuid; name: string } }> {
  const parsed = begin(access, "model.edit", createEntityInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { name, placement } = parsed.data;
  const workspaceId = access.workspace.id;
  // slice 21 (D-76): a concept made with the entity, as “New concept” makes it
  const made = parsed.data.newConcept ? newConcept(ctx, workspaceId, tidyName(parsed.data.newConcept.name), state.concepts ?? []) : null;
  const conceptId = made ? made.id : parsed.data.conceptId!;
  if (!made && (!isLive(state.concept, workspaceId) || state.concept.id !== conceptId)) return fail(notFound("concept"));
  if (placement && (!isLive(state.canvas, workspaceId) || state.canvas.id !== placement.canvasId)) return fail(notFound("canvas"));

  const entity: Entity = {
    ...newRowColumns(ctx),
    workspace_id: workspaceId,
    concept_id: conceptId,
    name: name ?? freeDefaultName(state.entities, options.level, options.defaultName),
    alias: null,
    model_level: options.level,
    stereotype: DEFAULT_STEREOTYPE,
    definition_html: null,
    definition_text: null,
  };
  const writes: Write[] = [...(made ? [{ kind: "insert" as const, table: "concept" as const, row: made }] : []), { kind: "insert", table: "entity", row: entity }];
  let item: CanvasItem | null = null;
  if (placement) {
    item = newCanvasItem(ctx, workspaceId, placement.canvasId, { entity_id: entity.id }, { x: placement.x, y: placement.y });
    const joined = joinFrames(ctx, access, placement.canvasId, state.frames ?? [], placement.frames, [{ item, height: placement.height }]);
    if (!joined.ok) return fail(joined.error);
    writes.push({ kind: "insert", table: "canvas_item", row: item }, ...joined.writes);
  }
  const warning = name && hasDuplicate(state.entities, name, null, options.level) ? duplicateNameWarning(name) : null;
  const concept = made ? { id: made.id, name: made.name } : { id: conceptId, name: state.concept!.name };
  const result = done(ctx, access, { entityId: entity.id, canvasItemId: item?.id ?? null, warning, concept }, writes);
  if (result.ok && made) result.writeSet.label = newConceptLabel(entity.name, made.name);
  return result;
}

// ---- edit ----

const updateEntityInput = z
  .object({
    entityId: uuidSchema,
    expectedVersion: versionSchema,
    name: nameSchema.optional(),
    /** Another name, shown on canvases that ask for it (slice 11, D-64): trimmed, empty clears it. */
    alias: optionalTextSchema.optional(),
    /** A code of the workspace's live stereotypes (slice 24): checked against `stereotypes`. */
    stereotype: z.string().min(1).max(30).optional(),
    conceptId: uuidSchema.optional(),
    definition: richTextSchema.optional(),
  })
  .strict();
export type UpdateEntityInput = z.input<typeof updateEntityInput>;

export interface UpdateEntityState {
  entity: Entity | null;
  /** Live entities of the workspace, for the duplicate warning. */
  entities: readonly Entity[];
  /** The concept named by `conceptId`, when the input moves the entity. */
  concept: Concept | null;
  /**
   * The workspace's stereotypes (slice 24): a chosen code must be a live one. Without them (a caller that changes no
   * stereotype) only a built-in code is accepted, which is always live; runCommand's rule checks every write as well.
   */
  stereotypes?: readonly Stereotype[];
}

/**
 * Name, alias (slice 11), stereotype, concept and definition (rich text, sanitized on the server; slice 4a). A duplicate
 * name gives a warning; an alias may repeat.
 */
export function updateEntity(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: UpdateEntityState,
  input: unknown,
): CommandResult<{ entity: Entity; warning: string | null }> {
  const parsed = begin(access, "model.edit", updateEntityInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { entityId, expectedVersion, name, alias, stereotype, conceptId, definition } = parsed.data;
  const got = current(state.entity, access, entityId, expectedVersion, "entity");
  if (!got.ok) return fail(got.error);
  const before = got.row;

  const patch: Partial<Entity> = {};
  if (name !== undefined && name !== before.name) patch.name = name;
  if (alias !== undefined && alias !== before.alias) patch.alias = alias;
  if (stereotype !== undefined && stereotype !== before.stereotype) {
    if (isDimensional(before)) return fail(domainError("invalid", DIMENSIONAL_STEREOTYPE_MESSAGE));
    const known = state.stereotypes
      ? !!stereotypeIndex(state.stereotypes.filter((x) => x.workspace_id === access.workspace.id)).of(stereotype)
      : isBuiltinStereotypeCode(stereotype);
    if (!known) return fail(domainError("invalid", UNKNOWN_STEREOTYPE));
    patch.stereotype = stereotype;
  }
  if (conceptId !== undefined && conceptId !== before.concept_id) {
    if (!isLive(state.concept, access.workspace.id) || state.concept.id !== conceptId) return fail(notFound("concept"));
    patch.concept_id = conceptId;
  }
  if (definition !== undefined) {
    const { html, text } = sanitizeRich(definition);
    if (html !== before.definition_html) Object.assign(patch, { definition_html: html, definition_text: text });
  }
  if (Object.keys(patch).length === 0) return fail(nothingToChange());

  const row = nextVersion(ctx, before, patch);
  const warning = patch.name && hasDuplicate(state.entities, patch.name, before.id, before.model_level) ? duplicateNameWarning(patch.name) : null;
  return done(ctx, access, { entity: row, warning }, [{ kind: "update", table: "entity", before, row }]);
}

// ---- delete (D-47) ----

const deleteEntityInput = z.object({ entityId: uuidSchema, expectedVersion: versionSchema }).strict();
export type DeleteEntityInput = z.input<typeof deleteEntityInput>;

export type DeleteEntityState = Omit<EntityRows, "entity"> & {
  entity: Entity | null;
  /** The workspace's label links and notes (slice 3a): links on what is deleted go with it, pinned notes become free. */
  labelLinks?: readonly LabelLink[];
  notes?: readonly Note[];
  /** The workspace's requirement links (slice 4a): those on what is deleted go with it. */
  requirementLinks?: readonly RequirementLink[];
};

/**
 * Deletes an entity from the model: its attributes, their mappings and inputs, its relationships and its cards on
 * every canvas are soft-deleted with it, in one change group. The panel shows `entityImpact` first. Slice 3a: the label
 * links on the entity, its attributes and their mappings are soft-deleted too (D-47), and notes pinned to its cards
 * become free notes at their place.
 */
export function deleteEntity(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: DeleteEntityState,
  input: unknown,
): CommandResult<{ attributes: number; mappings: number; relationships: number }> {
  const parsed = begin(access, "model.edit", deleteEntityInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.entity, access, parsed.data.entityId, parsed.data.expectedVersion, "entity");
  if (!got.ok) return fail(got.error);
  const entity = got.row;
  const cascade = entityCascade({ ...state, entity });

  const writes: Write[] = [
    ...cascade.mappingInputs.map((r) => softDelete(ctx, "mapping_input", r)),
    ...cascade.mappings.map((r) => softDelete(ctx, "mapping", r)),
    ...cascade.attributeInputs.map((r) => softDelete(ctx, "attribute_input", r)),
    ...cascade.attributes.map((r) => softDelete(ctx, "attribute", r)),
    ...cascade.relationships.map((r) => softDelete(ctx, "relationship", r)),
    ...cascade.canvasItems.map((r) => softDelete(ctx, "canvas_item", r)),
    softDelete(ctx, "entity", entity),
    ...softDeleteLinks(
      ctx,
      linksOnItems(state.labelLinks, [
        { kind: "entity", id: entity.id },
        ...cascade.attributes.map((a) => ({ kind: "attribute" as const, id: a.id })),
        ...cascade.mappings.map((m) => ({ kind: "mapping" as const, id: m.id })),
      ]),
    ),
    ...softDeleteRequirementLinks(ctx, state.requirementLinks, [
      { kind: "entity", id: entity.id },
      ...cascade.attributes.map((a) => ({ kind: "attribute" as const, id: a.id })),
      ...cascade.mappings.map((m) => ({ kind: "mapping" as const, id: m.id })),
    ]),
    ...releaseNotes(ctx, state.notes, { items: cascade.canvasItems, frames: [] }, { cardIds: cascade.canvasItems.map((c) => c.id) }),
  ];
  return done(
    ctx,
    access,
    { attributes: cascade.attributes.length, mappings: cascade.mappings.length, relationships: cascade.relationships.length },
    writes,
  );
}
