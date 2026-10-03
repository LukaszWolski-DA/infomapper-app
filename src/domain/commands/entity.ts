// Entity commands: create from “+” per concept (D-46), edit in the right panel, delete with its impact (D-47).

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { notFound } from "../errors";
import type { Uuid } from "../ids";
import { entityCascade, type EntityRows } from "../model/impact";
import { plainTextPair } from "../model/plain-text";
import type { WorkspaceAccess } from "../permissions";
import { STEREOTYPES, type Canvas, type CanvasItem, type Concept, type Entity } from "../types";
import { nameSchema, uuidSchema, versionSchema } from "../validation";
import { begin, current, done, isLive, nothingToChange, plainTextSchema, softDelete } from "./shared";
import { newCanvasItem, positionSchema } from "./canvas-item";

const DEFAULT_ENTITY_NAME = "New entity";

/** The warning for a duplicate entity name (B-25): shown, never blocking. */
export const duplicateNameWarning = (name: string): string =>
  `Another entity is already called “${name}”. Rename one of them if they mean different things.`;

const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

function hasDuplicate(entities: readonly Entity[], name: string, exceptId: Uuid | null): boolean {
  return entities.some((e) => e.id !== exceptId && e.deleted_at === null && sameName(e.name, name));
}

/** “New entity”, or “New entity 2”, “New entity 3”… when the name is taken. */
function freeDefaultName(entities: readonly Entity[]): string {
  let name = DEFAULT_ENTITY_NAME;
  for (let n = 2; hasDuplicate(entities, name, null); n++) name = `${DEFAULT_ENTITY_NAME} ${n}`;
  return name;
}

// ---- create ----

const createEntityInput = z
  .object({
    conceptId: uuidSchema,
    name: nameSchema.optional(),
    /** Where to place the card: the panel finds a free spot near the middle of the view (D-46). */
    placement: z.object({ canvasId: uuidSchema, ...positionSchema.shape }).strict().optional(),
  })
  .strict();
export type CreateEntityInput = z.input<typeof createEntityInput>;

export interface CreateEntityState {
  concept: Concept | null;
  /** Live entities of the workspace, for the default name and the duplicate warning. */
  entities: readonly Entity[];
  /** The canvas to place the card on, when the input has a placement. */
  canvas: Canvas | null;
}

/** Creates an entity in a concept and, when asked, its card on a canvas, as one change. */
export function createEntity(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: CreateEntityState,
  input: unknown,
): CommandResult<{ entityId: Uuid; canvasItemId: Uuid | null; warning: string | null }> {
  const parsed = begin(access, "model.edit", createEntityInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { conceptId, name, placement } = parsed.data;
  const workspaceId = access.workspace.id;
  if (!isLive(state.concept, workspaceId) || state.concept.id !== conceptId) return fail(notFound("concept"));
  if (placement && (!isLive(state.canvas, workspaceId) || state.canvas.id !== placement.canvasId)) return fail(notFound("canvas"));

  const entity: Entity = {
    ...newRowColumns(ctx),
    workspace_id: workspaceId,
    concept_id: conceptId,
    name: name ?? freeDefaultName(state.entities),
    stereotype: "object",
    definition_html: null,
    definition_text: null,
  };
  const writes: Write[] = [{ kind: "insert", table: "entity", row: entity }];
  let item: CanvasItem | null = null;
  if (placement) {
    item = newCanvasItem(ctx, workspaceId, placement.canvasId, { entity_id: entity.id }, placement);
    writes.push({ kind: "insert", table: "canvas_item", row: item });
  }
  const warning = name && hasDuplicate(state.entities, name, null) ? duplicateNameWarning(name) : null;
  return done(ctx, access, { entityId: entity.id, canvasItemId: item?.id ?? null, warning }, writes);
}

// ---- edit ----

const updateEntityInput = z
  .object({
    entityId: uuidSchema,
    expectedVersion: versionSchema,
    name: nameSchema.optional(),
    stereotype: z.enum(STEREOTYPES).optional(),
    conceptId: uuidSchema.optional(),
    definition: plainTextSchema.optional(),
  })
  .strict();
export type UpdateEntityInput = z.input<typeof updateEntityInput>;

export interface UpdateEntityState {
  entity: Entity | null;
  /** Live entities of the workspace, for the duplicate warning. */
  entities: readonly Entity[];
  /** The concept named by `conceptId`, when the input moves the entity. */
  concept: Concept | null;
}

/** Name, stereotype, concept and definition (plain text, AD-30). A duplicate name gives a warning. */
export function updateEntity(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: UpdateEntityState,
  input: unknown,
): CommandResult<{ entity: Entity; warning: string | null }> {
  const parsed = begin(access, "model.edit", updateEntityInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { entityId, expectedVersion, name, stereotype, conceptId, definition } = parsed.data;
  const got = current(state.entity, access, entityId, expectedVersion, "entity");
  if (!got.ok) return fail(got.error);
  const before = got.row;

  const patch: Partial<Entity> = {};
  if (name !== undefined && name !== before.name) patch.name = name;
  if (stereotype !== undefined && stereotype !== before.stereotype) patch.stereotype = stereotype;
  if (conceptId !== undefined && conceptId !== before.concept_id) {
    if (!isLive(state.concept, access.workspace.id) || state.concept.id !== conceptId) return fail(notFound("concept"));
    patch.concept_id = conceptId;
  }
  if (definition !== undefined) {
    const { html, text } = plainTextPair(definition);
    if (text !== before.definition_text) Object.assign(patch, { definition_html: html, definition_text: text });
  }
  if (Object.keys(patch).length === 0) return fail(nothingToChange());

  const row = nextVersion(ctx, before, patch);
  const warning = patch.name && hasDuplicate(state.entities, patch.name, before.id) ? duplicateNameWarning(patch.name) : null;
  return done(ctx, access, { entity: row, warning }, [{ kind: "update", table: "entity", before, row }]);
}

// ---- delete (D-47) ----

const deleteEntityInput = z.object({ entityId: uuidSchema, expectedVersion: versionSchema }).strict();
export type DeleteEntityInput = z.input<typeof deleteEntityInput>;

export type DeleteEntityState = Omit<EntityRows, "entity"> & { entity: Entity | null };

/**
 * Deletes an entity from the model: its attributes, their mappings and inputs, its relationships and its cards on
 * every canvas are soft-deleted with it, in one change group. The panel shows `entityImpact` first.
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
    ...cascade.attributes.map((r) => softDelete(ctx, "attribute", r)),
    ...cascade.relationships.map((r) => softDelete(ctx, "relationship", r)),
    ...cascade.canvasItems.map((r) => softDelete(ctx, "canvas_item", r)),
    softDelete(ctx, "entity", entity),
  ];
  return done(
    ctx,
    access,
    { attributes: cascade.attributes.length, mappings: cascade.mappings.length, relationships: cascade.relationships.length },
    writes,
  );
}
