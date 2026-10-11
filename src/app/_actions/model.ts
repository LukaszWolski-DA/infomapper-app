"use server";

// Model writes from the panels (slice 1a): concepts (D-46, D-47), entities with their impact before deleting,
// attributes, relationships, and source tables and columns; from the canvas (slice 1b): a new attribute from a
// dropped column, attribute order, a new relationship. Mappings are in mapping.ts.

import { revalidatePath } from "next/cache";
import { getDataStore, type DataStore } from "@/data";
import type { CommandContext, CommandResult } from "@/domain/changes";
import { addAttribute, createAttributeFromColumn, deleteAttribute, reorderAttribute, updateAttribute, type UpdateAttributeInput } from "@/domain/commands/attribute";
import { createConcept, deleteConcept, renameConcept } from "@/domain/commands/concept";
import { createEntity, deleteEntity, updateEntity, type UpdateEntityInput } from "@/domain/commands/entity";
import { createRelationship, deleteRelationship, swapRelationship, updateRelationship, type UpdateRelationshipInput } from "@/domain/commands/relationship";
import { createSourceTable, deleteSourceTable, updateSourceColumn, type CreateSourceTableInput, type UpdateSourceColumnInput } from "@/domain/commands/source";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceModel } from "@/domain/types";
import { entityImpact, type EntityImpact } from "@/domain/model/impact";
import type { WorkspaceAccess } from "@/domain/permissions";
import { getSessionUser } from "../_lib/session";
import { runCommand, type ActionResult } from "../_lib/run-command";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };
const str = (v: unknown) => (typeof v === "string" ? v : "");

async function loadAccess(store: DataStore, workspaceId: unknown, userId: Uuid): Promise<WorkspaceAccess | null> {
  if (typeof workspaceId !== "string") return null;
  const workspace = await store.workspaces.get(workspaceId);
  if (!workspace) return null;
  return { workspace, member: await store.workspaces.getMember(workspace.id, userId) };
}

/** Runs a model command with the workspace's live model loaded; on success the pages are fresh again. */
async function modelCommand<T>(
  workspaceId: unknown,
  build: (ctx: CommandContext, access: WorkspaceAccess, model: WorkspaceModel, store: DataStore) => Promise<CommandResult<T>> | CommandResult<T>,
): Promise<ActionResult<T>> {
  const result = await runCommand<T>(async (ctx, store, user) => {
    const access = await loadAccess(store, workspaceId, user.id);
    if (!access) return NOT_FOUND;
    return build(ctx, access, await store.model.load(access.workspace.id), store);
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

const byId = <R extends { id: string }>(rows: readonly R[], id: unknown): R | null => rows.find((r) => r.id === id) ?? null;

// ---- concepts ----

export async function createConceptAction(workspaceId: string, input: { name: string }): Promise<ActionResult<{ conceptId: string }>> {
  return modelCommand(workspaceId, (ctx, access, { concepts }) => createConcept(ctx, access, { concepts }, input));
}

export async function renameConceptAction(
  workspaceId: string,
  input: { conceptId: string; expectedVersion: number; name: string },
): Promise<ActionResult<null>> {
  return modelCommand(workspaceId, (ctx, access, { concepts }) => {
    const result = renameConcept(ctx, access, { concept: byId(concepts, input?.conceptId) }, input);
    return result.ok ? { ...result, value: null } : result;
  });
}

export async function deleteConceptAction(
  workspaceId: string,
  input: { conceptId: string; expectedVersion: number; moveToConceptId?: string | null },
): Promise<ActionResult<{ movedEntities: number }>> {
  return modelCommand(workspaceId, async (ctx, access, { concepts, entities }, store) => {
    const concept = byId(concepts, input?.conceptId);
    const frames = await store.frames.list(access.workspace.id);
    return deleteConcept(ctx, access, { concept, concepts, entities: entities.filter((e) => e.concept_id === concept?.id), frames }, input);
  });
}

// ---- entities ----

/** A new entity in a concept, with its card on the canvas at the given spot (D-46). */
export async function createEntityAction(
  workspaceId: string,
  input: {
    conceptId: string;
    name?: string;
    placement: { canvasId: string; x: number; y: number; height?: number; frames?: { frameId: string; expectedVersion: number }[] };
  },
): Promise<ActionResult<{ entityId: string; canvasItemId: string | null; name: string }>> {
  return modelCommand(workspaceId, async (ctx, access, { concepts, entities }, store) => {
    const canvasId = str(input?.placement?.canvasId);
    const [canvas, frames] = await Promise.all([store.canvases.get(access.workspace.id, canvasId), store.frames.listOfCanvas(access.workspace.id, canvasId)]);
    const result = createEntity(ctx, access, { concept: byId(concepts, input?.conceptId), entities, canvas, frames }, input);
    if (!result.ok) return result;
    const write = result.writeSet.writes.find((w) => w.kind === "insert" && w.table === "entity");
    const name = write?.kind === "insert" && write.table === "entity" ? write.row.name : "";
    return { ...result, value: { ...result.value, name } };
  });
}

/** Name, stereotype, concept, definition (right panel). A duplicate name comes back as a warning (B-25). */
export async function updateEntityAction(workspaceId: string, input: UpdateEntityInput): Promise<ActionResult<{ warning: string | null }>> {
  return modelCommand(workspaceId, (ctx, access, { entities, concepts }) => {
    const state = { entity: byId(entities, input?.entityId), entities, concept: byId(concepts, input?.conceptId) };
    const result = updateEntity(ctx, access, state, input);
    return result.ok ? { ...result, value: { warning: result.value.warning } } : result;
  });
}

/** What deleting an entity takes with it (D-47), for the dialog. Reading only. */
export async function entityImpactAction(workspaceId: string, entityId: string): Promise<ActionResult<EntityImpact>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, code: "unauthenticated", message: "Your session has ended. Sign in again." };
  const store = getDataStore();
  const access = await loadAccess(store, workspaceId, user.id);
  if (!access?.member) return { ok: false, code: "not_found", message: "This workspace does not exist." };
  const ws = access.workspace.id;
  const [model, canvasItems, canvases, projects] = await Promise.all([
    store.model.load(ws),
    store.canvasItems.list(ws),
    store.canvases.list(ws),
    store.projects.list(ws),
  ]);
  const entity = byId(model.entities, entityId);
  if (!entity) return { ok: false, code: "not_found", message: "This entity does not exist any more." };
  const projectCanvases = (await Promise.all(projects.map((p) => store.canvases.listLinksOfProject(ws, p.id)))).flat();
  const rows = { entity, ...model, canvasItems };
  return { ok: true, value: entityImpact(rows, { canvases, projects, projectCanvases }) };
}

/**
 * Deletes an entity with its attributes, mappings, relationships, cards and the label links on them, in one change
 * group (D-47); notes pinned to its cards become free notes (slice 3a).
 */
export async function deleteEntityAction(
  workspaceId: string,
  input: { entityId: string; expectedVersion: number },
): Promise<ActionResult<{ attributes: number; mappings: number; relationships: number }>> {
  return modelCommand(workspaceId, async (ctx, access, model, store) => {
    const ws = access.workspace.id;
    const [canvasItems, labelLinks, notes] = await Promise.all([store.canvasItems.list(ws), store.labels.listLinks(ws), store.notes.list(ws)]);
    return deleteEntity(ctx, access, { ...model, entity: byId(model.entities, input?.entityId), canvasItems, labelLinks, notes }, input);
  });
}

// ---- attributes ----

export async function addAttributeAction(workspaceId: string, input: { entityId: string }): Promise<ActionResult<{ attributeId: string }>> {
  return modelCommand(workspaceId, (ctx, access, { entities, attributes }) =>
    addAttribute(ctx, access, { entity: byId(entities, input?.entityId), attributes }, input),
  );
}

/** A column dropped on an entity card's header (slice 1b): a new attribute mapped from it, or a mapping to the attribute of that name. */
export async function createAttributeFromColumnAction(
  workspaceId: string,
  input: { entityId: string; sourceColumnId: string },
): Promise<ActionResult<{ attributeId: string; mappingId: string; createdAttribute: boolean }>> {
  return modelCommand(workspaceId, (ctx, access, { entities, attributes, sourceColumns, mappings, mappingInputs }) =>
    createAttributeFromColumn(
      ctx,
      access,
      { entity: byId(entities, input?.entityId), attributes, column: byId(sourceColumns, input?.sourceColumnId), mappings, mappingInputs },
      input,
    ),
  );
}

/** Name, type with parameters, flags and definition. */
export async function updateAttributeAction(workspaceId: string, input: UpdateAttributeInput): Promise<ActionResult<null>> {
  return modelCommand(workspaceId, (ctx, access, { attributes }) => {
    const result = updateAttribute(ctx, access, { attribute: byId(attributes, input?.attributeId) }, input);
    return result.ok ? { ...result, value: null } : result;
  });
}

/** Moves an attribute to a position among its entity's attributes (slice 1b, D-36). */
export async function reorderAttributeAction(
  workspaceId: string,
  input: { attributeId: string; expectedVersion: number; position: number },
): Promise<ActionResult<{ position: number }>> {
  return modelCommand(workspaceId, (ctx, access, { attributes }) =>
    reorderAttribute(ctx, access, { attribute: byId(attributes, input?.attributeId), attributes }, input),
  );
}

/** Deletes an attribute with its mappings, their inputs and the label links on them. */
export async function deleteAttributeAction(
  workspaceId: string,
  input: { attributeId: string; expectedVersion: number },
): Promise<ActionResult<{ mappings: number }>> {
  return modelCommand(workspaceId, async (ctx, access, { attributes, mappings, mappingInputs }, store) => {
    const labelLinks = await store.labels.listLinks(access.workspace.id);
    return deleteAttribute(ctx, access, { attribute: byId(attributes, input?.attributeId), mappings, mappingInputs, labelLinks }, input);
  });
}

// ---- relationships ----

/** The relate button on an entity card (slice 1b): a relationship with the default ends, 1 to 0..n. */
export async function createRelationshipAction(
  workspaceId: string,
  input: { fromEntityId: string; toEntityId: string },
): Promise<ActionResult<{ relationshipId: string }>> {
  return modelCommand(workspaceId, (ctx, access, { entities }) => {
    const result = createRelationship(ctx, access, { from: byId(entities, input?.fromEntityId), to: byId(entities, input?.toEntityId) }, input);
    return result.ok ? { ...result, value: { relationshipId: result.value.relationship.id } } : result;
  });
}

/** Verb phrase and the cardinality at both ends. */
export async function updateRelationshipAction(workspaceId: string, input: UpdateRelationshipInput): Promise<ActionResult<null>> {
  return modelCommand(workspaceId, (ctx, access, { relationships }) => {
    const result = updateRelationship(ctx, access, { relationship: byId(relationships, input?.relationshipId) }, input);
    return result.ok ? { ...result, value: null } : result;
  });
}

export async function swapRelationshipAction(workspaceId: string, input: { relationshipId: string; expectedVersion: number }): Promise<ActionResult<null>> {
  return modelCommand(workspaceId, (ctx, access, { relationships }) => {
    const result = swapRelationship(ctx, access, { relationship: byId(relationships, input?.relationshipId) }, input);
    return result.ok ? { ...result, value: null } : result;
  });
}

export async function deleteRelationshipAction(workspaceId: string, input: { relationshipId: string; expectedVersion: number }): Promise<ActionResult<null>> {
  return modelCommand(workspaceId, (ctx, access, { relationships }) => {
    const result = deleteRelationship(ctx, access, { relationship: byId(relationships, input?.relationshipId) }, input);
    return result.ok ? { ...result, value: null } : result;
  });
}

// ---- source tables and columns ----

/** “New source table”: system (reused by name, or created), database, schema, name and the columns as lines. */
export async function createSourceTableAction(
  workspaceId: string,
  input: CreateSourceTableInput,
): Promise<ActionResult<{ sourceTableId: string; columns: number; createdSystem: boolean }>> {
  return modelCommand(workspaceId, (ctx, access, { sourceSystems, sourceTables }) => {
    const result = createSourceTable(ctx, access, { systems: sourceSystems, tables: sourceTables }, input);
    if (!result.ok) return result;
    const columns = result.writeSet.writes.filter((w) => w.kind === "insert" && w.table === "source_column").length;
    return { ...result, value: { sourceTableId: result.value.sourceTableId, columns, createdSystem: result.value.createdSystem } };
  });
}

/** BK and PII flags and the comment of a column. */
export async function updateSourceColumnAction(workspaceId: string, input: UpdateSourceColumnInput): Promise<ActionResult<null>> {
  return modelCommand(workspaceId, (ctx, access, { sourceColumns }) => {
    const result = updateSourceColumn(ctx, access, { column: byId(sourceColumns, input?.sourceColumnId) }, input);
    return result.ok ? { ...result, value: null } : result;
  });
}

/** Deletes a table with its columns, cards and label links; refused while a mapping reads one of its columns. */
export async function deleteSourceTableAction(
  workspaceId: string,
  input: { sourceTableId: string; expectedVersion: number },
): Promise<ActionResult<{ columns: number }>> {
  return modelCommand(workspaceId, async (ctx, access, model, store) => {
    const ws = access.workspace.id;
    const [canvasItems, labelLinks, notes] = await Promise.all([store.canvasItems.list(ws), store.labels.listLinks(ws), store.notes.list(ws)]);
    const table = byId(model.sourceTables, input?.sourceTableId);
    return deleteSourceTable(
      ctx,
      access,
      {
        table,
        columns: model.sourceColumns.filter((c) => c.source_table_id === table?.id),
        canvasItems,
        mappings: model.mappings,
        mappingInputs: model.mappingInputs,
        attributes: model.attributes,
        entities: model.entities,
        labelLinks,
        notes,
      },
      input,
    );
  });
}
