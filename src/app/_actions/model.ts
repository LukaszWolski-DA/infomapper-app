"use server";

// Model writes from the panels (slice 1a): concepts (D-46, D-47), entities with their impact before deleting,
// attributes, relationships, and source tables and columns; from the canvas (slice 1b): a new attribute from a
// dropped column, attribute order, a new relationship. Mappings are in mapping.ts. Slice 10c: paste a copy of an
// attribute; a change of a followed field writes the copies too and answers with every version written.

import { moduleEntityDependents, relationshipOneEnd, STORE_SCHEMA } from "@/compose";
import { getDataStore } from "@/data";
import { addAttribute, createAttributeFromColumn, deleteAttribute, pasteAttribute, reorderAttribute, updateAttribute, type PasteAttributeInput, type UpdateAttributeInput } from "@/domain/commands/attribute";
import { createConcept, deleteConcept, renameConcept } from "@/domain/commands/concept";
import { createEntity, deleteEntity, updateEntity, type UpdateEntityInput } from "@/domain/commands/entity";
import { createRelationship, deleteRelationship, swapRelationship, updateRelationship, type UpdateRelationshipInput } from "@/domain/commands/relationship";
import { createSourceTable, deleteSourceTable, type CreateSourceTableInput } from "@/domain/commands/source";
import { buildRequirementIndex } from "@/domain/model/requirement-index";
import { entityImpact, type EntityImpact } from "@/domain/model/impact";
import { getSession } from "../_lib/session";
import { lockedRefusal } from "../_lib/unlock";
import { loadAccess, modelCommand } from "../_lib/model-command";
import { type ActionResult, type Saved } from "../_lib/run-command";

const str = (v: unknown) => (typeof v === "string" ? v : "");

const byId = <R extends { id: string }>(rows: readonly R[], id: unknown): R | null => rows.find((r) => r.id === id) ?? null;

// ---- concepts ----

export async function createConceptAction(workspaceId: string, input: { name: string }): Promise<ActionResult<{ conceptId: string }>> {
  return modelCommand(workspaceId, (ctx, access, { concepts }) => createConcept(ctx, access, { concepts }, input));
}

export async function renameConceptAction(
  workspaceId: string,
  input: { conceptId: string; expectedVersion: number; name: string },
): Promise<ActionResult<Saved>> {
  return modelCommand(workspaceId, (ctx, access, { concepts }) => {
    const result = renameConcept(ctx, access, { concept: byId(concepts, input?.conceptId) }, input);
    return result.ok ? { ...result, value: { version: result.value.concept.version } } : result;
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
  }, { versions: true }); // with "move to", the moved entities' versions (slice 10a, F1)
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
export async function updateEntityAction(workspaceId: string, input: UpdateEntityInput): Promise<ActionResult<Saved<{ warning: string | null }>>> {
  return modelCommand(workspaceId, (ctx, access, { entities, concepts }) => {
    const state = { entity: byId(entities, input?.entityId), entities, concept: byId(concepts, input?.conceptId) };
    const result = updateEntity(ctx, access, state, input);
    return result.ok ? { ...result, value: { warning: result.value.warning, version: result.value.entity.version } } : result;
  });
}

/** What deleting an entity takes with it (D-47), for the dialog. Reading only. */
/** `modules`: the modules' rows of the preview (slice 15a, X-1, X-4), after InfoMapper's. */
export async function entityImpactAction(workspaceId: string, entityId: string): Promise<ActionResult<EntityImpact & { modules: [string, string][] }>> {
  const session = await getSession();
  if (!session) return { ok: false, code: "unauthenticated", message: "Your session has ended. Sign in again." };
  const { user } = session;
  const store = getDataStore(STORE_SCHEMA);
  const access = await loadAccess(store, workspaceId, user.id);
  if (!access?.member) return { ok: false, code: "not_found", message: "This workspace does not exist." };
  const locked = await lockedRefusal(store, session.unlocked, access.workspace.organization_id);
  if (locked) return locked;
  const ws = access.workspace.id;
  const [model, canvasItems, canvases, projects, requirements, requirementLinks] = await Promise.all([
    store.model.load(ws),
    store.canvasItems.list(ws),
    store.canvases.list(ws),
    store.projects.list(ws),
    store.requirements.list(ws),
    store.requirements.listLinks(ws),
  ]);
  const entity = byId(model.entities, entityId);
  if (!entity) return { ok: false, code: "not_found", message: "This entity does not exist any more." };
  const projectCanvases = (await Promise.all(projects.map((p) => store.canvases.listLinksOfProject(ws, p.id)))).flat();
  const rows = { entity, ...model, canvasItems };
  const index = buildRequirementIndex(requirements, requirementLinks, model);
  const modules = await moduleEntityDependents(store, ws, entity.id, model);
  return { ok: true, value: { ...entityImpact(rows, { canvases, projects, projectCanvases, requirements: index }), modules } };
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
    const [canvasItems, labelLinks, notes, requirementLinks] = await Promise.all([
      store.canvasItems.list(ws),
      store.labels.listLinks(ws),
      store.notes.list(ws),
      store.requirements.listLinks(ws),
    ]);
    return deleteEntity(ctx, access, { ...model, entity: byId(model.entities, input?.entityId), canvasItems, labelLinks, notes, requirementLinks }, input);
  });
}

// ---- attributes ----

export async function addAttributeAction(workspaceId: string, input: { entityId: string; below?: string }): Promise<ActionResult<{ attributeId: string }>> {
  // below a row (slice 17): its siblings are renumbered, so every version written comes back for the save chain
  return modelCommand(workspaceId, (ctx, access, { entities, attributes }) =>
    addAttribute(ctx, access, { entity: byId(entities, input?.entityId), attributes }, input),
    { versions: true },
  );
}

/** A column dropped on an entity card's header (slice 1b): a new attribute mapped from it, or a mapping to the attribute of that name. */
export async function createAttributeFromColumnAction(
  workspaceId: string,
  input: { entityId: string; sourceColumnId: string },
): Promise<ActionResult<{ attributeId: string; mappingId: string; createdAttribute: boolean }>> {
  return modelCommand(workspaceId, (ctx, access, { entities, attributes, sourceColumns, mappings, mappingInputs, classifications, classificationLinks }) =>
    createAttributeFromColumn(
      ctx,
      access,
      { entity: byId(entities, input?.entityId), attributes, column: byId(sourceColumns, input?.sourceColumnId), mappings, mappingInputs, classifications, classificationLinks },
      input,
    ),
  );
}

/** Name, type with parameters, flags and definition. */
/**
 * Name, type, flags, definition, or “Stop following” (slice 10c). A change of a followed field writes the attribute's
 * copies too: the answer carries every version written (F4), for the copies held in the browser's save chain.
 */
export async function updateAttributeAction(workspaceId: string, input: UpdateAttributeInput): Promise<ActionResult<Saved>> {
  return modelCommand(
    workspaceId,
    (ctx, access, { attributes, entities, lostOriginals }) => {
      const result = updateAttribute(ctx, access, { attribute: byId(attributes, input?.attributeId), attributes, entities, lostOriginals }, input);
      return result.ok ? { ...result, value: { version: result.value.attribute.version } } : result;
    },
    { versions: true },
  );
}

/**
 * “Paste attribute” (slice 10c, items 4, 5): a copy of the attribute, from its id, last on the entity. `nameTaken`: the
 * entity has another attribute of that name (F12).
 */
export async function pasteAttributeAction(workspaceId: string, input: PasteAttributeInput): Promise<ActionResult<{ attributeId: string; nameTaken: boolean }>> {
  return modelCommand(workspaceId, (ctx, access, { entities, attributes }) => {
    const original = byId(attributes, input?.attributeId);
    // the original's entity, for its level (slice 15a, O6)
    return pasteAttribute(ctx, access, { entity: byId(entities, input?.entityId), original, originalEntity: byId(entities, original?.entity_id), attributes }, input);
  });
}

/**
 * Moves an attribute to a position among its entity's attributes (slice 1b, D-36). The answer carries the versions of
 * the moved attribute and its renumbered siblings (slice 10a, F3).
 */
export async function reorderAttributeAction(
  workspaceId: string,
  input: { attributeId: string; expectedVersion: number; position: number },
): Promise<ActionResult<{ position: number }>> {
  return modelCommand(workspaceId, (ctx, access, { attributes }) =>
    reorderAttribute(ctx, access, { attribute: byId(attributes, input?.attributeId), attributes }, input),
    { versions: true },
  );
}

/** Deletes an attribute with its mappings, their inputs and the label links on them. */
export async function deleteAttributeAction(
  workspaceId: string,
  input: { attributeId: string; expectedVersion: number },
): Promise<ActionResult<{ mappings: number }>> {
  return modelCommand(workspaceId, async (ctx, access, { attributes, mappings, mappingInputs, attributeInputs }, store) => {
    const [labelLinks, requirementLinks] = await Promise.all([store.labels.listLinks(access.workspace.id), store.requirements.listLinks(access.workspace.id)]);
    return deleteAttribute(ctx, access, { attribute: byId(attributes, input?.attributeId), mappings, mappingInputs, attributeInputs, labelLinks, requirementLinks }, input);
  });
}

// ---- relationships ----

/** The relate button on an entity card (slice 1b): a relationship with the default ends, 1 to 0..n. */
export async function createRelationshipAction(
  workspaceId: string,
  input: { fromEntityId: string; toEntityId: string },
): Promise<ActionResult<{ relationshipId: string }>> {
  return modelCommand(workspaceId, async (ctx, access, { entities }, store) => {
    const from = byId(entities, input?.fromEntityId);
    const to = byId(entities, input?.toEntityId);
    // between a fact and a dimension the relationship starts at the dimension (slice 15a, D-67)
    const oneEnd = from && to ? await relationshipOneEnd(store, access.workspace.id, from.id, to.id) : null;
    const result = createRelationship(ctx, access, { from, to, oneEnd }, input);
    return result.ok ? { ...result, value: { relationshipId: result.value.relationship.id } } : result;
  });
}

/** Verb phrase and the cardinality at both ends. */
export async function updateRelationshipAction(workspaceId: string, input: UpdateRelationshipInput): Promise<ActionResult<Saved>> {
  return modelCommand(workspaceId, (ctx, access, { relationships }) => {
    const result = updateRelationship(ctx, access, { relationship: byId(relationships, input?.relationshipId) }, input);
    return result.ok ? { ...result, value: { version: result.value.relationship.version } } : result;
  });
}

export async function swapRelationshipAction(workspaceId: string, input: { relationshipId: string; expectedVersion: number }): Promise<ActionResult<Saved>> {
  return modelCommand(workspaceId, (ctx, access, { relationships }) => {
    const result = swapRelationship(ctx, access, { relationship: byId(relationships, input?.relationshipId) }, input);
    return result.ok ? { ...result, value: { version: result.value.relationship.version } } : result;
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
/**
 * Deletes a table from the model with its columns, cards, relationships, links and the mappings that read it (slice 7b,
 * Q7: the same cascade as a change's “Delete…”); the panel shows it all first (`sourceDeleteImpactAction`).
 */
export async function deleteSourceTableAction(
  workspaceId: string,
  input: { sourceTableId: string; expectedVersion: number },
): Promise<ActionResult<{ columns: number; mappings: number }>> {
  return modelCommand(workspaceId, async (ctx, access, model, store) => {
    const ws = access.workspace.id;
    const [canvasItems, labelLinks, notes, requirementLinks] = await Promise.all([
      store.canvasItems.list(ws),
      store.labels.listLinks(ws),
      store.notes.list(ws),
      store.requirements.listLinks(ws),
    ]);
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
        requirementLinks,
        relationships: model.sourceRelationships,
        relationshipColumns: model.sourceRelationshipColumns,
        classificationLinks: model.classificationLinks,
      },
      input,
    );
  });
}
