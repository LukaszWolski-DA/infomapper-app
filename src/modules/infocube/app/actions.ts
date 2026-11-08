"use server";

// InfoCube's server actions (slice 15a, B-2): New fact and New dimension, from the Cube tab and the canvas's toolbox.
// Each is InfoMapper's entity create at the dimensional level with InfoCube's row, one change group and one undo step;
// the card is placed as "New entity here" places it.

import { modelCommand, modelRead } from "@/app/_lib/model-command";
import { busMatrix, type BusMatrix } from "../domain/bus-matrix";
import { cubeIndex } from "../domain/keys";
import type { ActionResult } from "@/app/_lib/run-command";
import type { DataStore } from "@/data";
import type { WorkspaceModel } from "@/domain/types";
import {
  addKey,
  createCubeEntity,
  linkKey,
  setMeasure,
  updateCubeEntity,
  updateMeasure,
  type AddKeyInput,
  type KeyState,
  type LinkKeyInput,
  type SetMeasureInput,
  type UpdateCubeEntityInput,
  type UpdateMeasureInput,
} from "../domain/commands";
import type { CubeRole } from "../domain/types";
import { lastContentEditor } from "@/domain/model/mapping-rules";
import {
  addCubeMappingInput,
  createCubeMapping,
  createDimensionFrom,
  createOnHeader,
  CUBE_MAPPING_LOG,
  deleteCubeMapping,
  removeCubeMappingInput,
  retargetCubeMapping,
  setCubeMappingStatus,
  updateCubeMapping,
  type AddCubeMappingInputInput,
  type CreateCubeMappingInput,
  type CreateDimensionFromInput,
  type CreateOnHeaderInput,
  type DeleteCubeMappingInput,
  type MappingModel,
  type RemoveCubeMappingInputInput,
  type RetargetCubeMappingInput,
  type SetCubeMappingStatusInput,
  type UpdateCubeMappingInput,
} from "../domain/mappings";

const create = (role: CubeRole) =>
  async function (
    workspaceId: string,
    input: { conceptId: string; placement: { canvasId: string; x: number; y: number; height?: number; frames?: { frameId: string; expectedVersion: number }[] } },
  ): Promise<ActionResult<{ entityId: string; canvasItemId: string | null; name: string }>> {
    return modelCommand(workspaceId, async (ctx, access, { concepts, entities }, store) => {
      const canvasId = typeof input?.placement?.canvasId === "string" ? input.placement.canvasId : "";
      const [canvas, frames] = await Promise.all([store.canvases.get(access.workspace.id, canvasId), store.frames.listOfCanvas(access.workspace.id, canvasId)]);
      const concept = concepts.find((c) => c.id === input?.conceptId) ?? null;
      const result = createCubeEntity(ctx, access, { concept, entities, canvas, frames }, role, input);
      if (!result.ok) return result;
      const write = result.writeSet.writes.find((w) => w.kind === "insert" && w.table === "entity");
      const name = write?.kind === "insert" && write.table === "entity" ? write.row.name : "";
      return { ...result, value: { entityId: result.value.entityId, canvasItemId: result.value.canvasItemId, name } };
    });
  };

export async function createFactAction(...args: Parameters<ReturnType<typeof create>>) {
  return create("fact")(...args);
}

export async function createDimensionAction(...args: Parameters<ReturnType<typeof create>>) {
  return create("dimension")(...args);
}

// ---- slice 15b: grain, SCD type, measures, key links, Add key (B-4, R-1, R-3) ----

/** InfoCube's rows and the model a key command reads (the key commands' `KeyState`). */
async function keyState(store: DataStore, workspaceId: string, model: WorkspaceModel): Promise<KeyState> {
  const [cubeEntities, cubeMeasures, cubeKeys] = await Promise.all([
    store.modules.list(workspaceId, "cube_entity"),
    store.modules.list(workspaceId, "cube_measure"),
    store.modules.list(workspaceId, "cube_key"),
  ]);
  return { entities: model.entities, attributes: model.attributes, relationships: model.relationships, cubeEntities, cubeMeasures, cubeKeys };
}

/** A fact's grain or a dimension's SCD type (saved on the chain with the `cube_entity` row checked). */
export async function updateCubeEntityAction(workspaceId: string, input: UpdateCubeEntityInput): Promise<ActionResult<{ version: number }>> {
  return modelCommand(workspaceId, async (ctx, access, _model, store) => {
    const cube = (await store.modules.list(access.workspace.id, "cube_entity")).find((c) => c.id === input?.cubeEntityId) ?? null;
    return updateCubeEntity(ctx, access, { cube }, input);
  });
}

/** The Measure toggle: on inserts the attribute's measure, off deletes it. */
export async function setMeasureAction(workspaceId: string, input: SetMeasureInput): Promise<ActionResult<{ measureId: string | null; warning: string | null }>> {
  return modelCommand(workspaceId, async (ctx, access, { attributes }, store) => {
    const attribute = attributes.find((a) => a.id === input?.attributeId) ?? null;
    const [cubes, measures] = await Promise.all([store.modules.list(access.workspace.id, "cube_entity"), store.modules.list(access.workspace.id, "cube_measure")]);
    const cube = cubes.find((c) => c.deleted_at === null && c.entity_id === attribute?.entity_id) ?? null;
    const measure = measures.find((m) => m.deleted_at === null && m.attribute_id === attribute?.id) ?? null;
    return setMeasure(ctx, access, { attribute, cube, measure }, input);
  });
}

/** A measure's additivity and its "Not additive across" note. */
export async function updateMeasureAction(workspaceId: string, input: UpdateMeasureInput): Promise<ActionResult<{ version: number }>> {
  return modelCommand(workspaceId, async (ctx, access, _model, store) => {
    const measure = (await store.modules.list(access.workspace.id, "cube_measure")).find((m) => m.id === input?.measureId) ?? null;
    return updateMeasure(ctx, access, { measure }, input);
  });
}

/** "Key in {fact}": links a foreign key of the fact to the relationship, or none. */
export async function linkKeyAction(workspaceId: string, input: LinkKeyInput): Promise<ActionResult<{ keyId: string | null }>> {
  return modelCommand(workspaceId, async (ctx, access, model, store) => linkKey(ctx, access, await keyState(store, access.workspace.id, model), input));
}

/** Add key: the new foreign key, the fact's order and the link in one undo step; answers every version it wrote. */
export async function addKeyAction(workspaceId: string, input: AddKeyInput): Promise<ActionResult<{ attributeId: string; keyId: string; name: string; toast: string }>> {
  return modelCommand(workspaceId, async (ctx, access, model, store) => addKey(ctx, access, await keyState(store, access.workspace.id, model), input), { versions: true });
}

// ---- slice 15c: dimensional mappings on the canvas (B-6, C4, C7, O9) ----

/** The model and InfoCube's mapping rows a mapping command reads. */
async function mappingState(store: DataStore, workspaceId: string, model: WorkspaceModel): Promise<MappingModel> {
  const [cubeMappings, cubeMappingInputs] = await Promise.all([store.modules.list(workspaceId, "cube_mapping"), store.modules.list(workspaceId, "cube_mapping_input")]);
  return { entities: model.entities, attributes: model.attributes, cubeMappings, cubeMappingInputs, relationships: model.relationships };
}

/** A logical attribute dropped on a dimensional one (either way round): a direct Draft mapping. */
export async function createCubeMappingAction(workspaceId: string, input: CreateCubeMappingInput): Promise<ActionResult<{ mappingId: string; toast: string }>> {
  return modelCommand(workspaceId, async (ctx, access, model, store) => createCubeMapping(ctx, access, await mappingState(store, access.workspace.id, model), input));
}

/** A logical attribute dropped on a fact's or a dimension's header: its copy and the mapping, the card opened. */
export async function createOnHeaderAction(workspaceId: string, input: CreateOnHeaderInput): Promise<ActionResult<{ mappingId: string; attributeId: string; toast: string }>> {
  return modelCommand(
    workspaceId,
    async (ctx, access, model, store) => {
      const state = await mappingState(store, access.workspace.id, model);
      const cardId = input?.card?.canvasItemId;
      const card = typeof cardId === "string" ? ((await store.canvasItems.list(access.workspace.id)).find((i) => i.id === cardId) ?? null) : null;
      return createOnHeader(ctx, access, { ...state, card }, input);
    },
    { versions: true },
  );
}

/** The line's menu: Draft, In review, Approved; reviewers too, four-eyes from InfoCube's change log. */
export async function setCubeMappingStatusAction(workspaceId: string, input: SetCubeMappingStatusInput): Promise<ActionResult<{ version: number }>> {
  return modelCommand(workspaceId, async (ctx, access, model, store) => {
    const state = await mappingState(store, access.workspace.id, model);
    const mapping = state.cubeMappings.find((m) => m.id === input?.mappingId);
    const events = mapping ? await store.changeEvents.listForMapping(access.workspace.id, mapping.id, CUBE_MAPPING_LOG) : [];
    const contentAuthorId = mapping ? lastContentEditor(mapping, events, CUBE_MAPPING_LOG) : ctx.actorId;
    return setCubeMappingStatus(ctx, access, { ...state, contentAuthorId }, input);
  });
}

/** The kind, the rule, the note ("Edit transformation rule…" makes it a transformation). */
export async function updateCubeMappingAction(workspaceId: string, input: UpdateCubeMappingInput): Promise<ActionResult<{ version: number; notice: string | null }>> {
  return modelCommand(workspaceId, async (ctx, access, model, store) => updateCubeMapping(ctx, access, await mappingState(store, access.workspace.id, model), input));
}

/** "Delete mapping", the Delete key: the mapping and its inputs. */
export async function deleteCubeMappingAction(workspaceId: string, input: DeleteCubeMappingInput): Promise<ActionResult<null>> {
  return modelCommand(workspaceId, async (ctx, access, model, store) => {
    const result = deleteCubeMapping(ctx, access, await mappingState(store, access.workspace.id, model), input);
    return result.ok ? { ...result, value: null } : result;
  });
}

// ---- slice 15c step 5: the mapping's panel, "Create dimension from this…" ----

/** "Add a logical attribute": the last input; a second one makes a direct copy a transformation (X2). */
export async function addCubeMappingInputAction(
  workspaceId: string,
  input: AddCubeMappingInputInput,
): Promise<ActionResult<{ version: number; toast: string; notice: string | null; becameTransform: boolean }>> {
  return modelCommand(workspaceId, async (ctx, access, model, store) => addCubeMappingInput(ctx, access, await mappingState(store, access.workspace.id, model), input));
}

/** × "Stop reading this attribute" (never on the last input). */
export async function removeCubeMappingInputAction(workspaceId: string, input: RemoveCubeMappingInputInput): Promise<ActionResult<{ version: number; notice: string | null }>> {
  return modelCommand(workspaceId, async (ctx, access, model, store) => removeCubeMappingInput(ctx, access, await mappingState(store, access.workspace.id, model), input));
}

/** "Target attribute": another fact's or dimension's attribute. */
export async function retargetCubeMappingAction(workspaceId: string, input: RetargetCubeMappingInput): Promise<ActionResult<{ version: number; toast: string; notice: string | null }>> {
  return modelCommand(workspaceId, async (ctx, access, model, store) => retargetCubeMapping(ctx, access, await mappingState(store, access.workspace.id, model), input));
}

/** "Create dimension from this…" (B-2): the dimension, its key, the copies and their mappings, its card; one undo step. */
export async function createDimensionFromAction(
  workspaceId: string,
  input: CreateDimensionFromInput,
): Promise<ActionResult<{ entityId: string; canvasItemId: string | null; name: string; keyName: string; toast: string; warning: string | null }>> {
  return modelCommand(workspaceId, async (ctx, access, model, store) => {
    const ws = access.workspace.id;
    const canvasId = typeof input?.placement?.canvasId === "string" ? input.placement.canvasId : "";
    const [state, canvas, frames, items] = await Promise.all([
      mappingState(store, ws, model),
      canvasId ? store.canvases.get(ws, canvasId) : Promise.resolve(null),
      canvasId ? store.frames.listOfCanvas(ws, canvasId) : Promise.resolve([]),
      store.canvasItems.list(ws),
    ]);
    const original = model.entities.find((e) => e.id === input?.entityId) ?? null;
    const concept = model.concepts.find((c) => c.id === original?.concept_id) ?? null;
    return createDimensionFrom(ctx, access, { ...state, create: { concept, entities: model.entities, canvas, frames }, items, original }, input);
  });
}

// ---- slice 15d: the bus matrix (B-8, R-8, RP-10) ----

/**
 * The bus matrix's rows, read when its dialog opens (Y5): for every role who can open the workspace, through the store,
 * nothing written; the dialog is a snapshot of that moment.
 */
export async function busMatrixAction(workspaceId: string): Promise<ActionResult<BusMatrix>> {
  return modelRead(workspaceId, async (access, model, store) => busMatrix(cubeIndex(await keyState(store, access.workspace.id, model)), model.entities, model.concepts, access.workspace.name));
}
