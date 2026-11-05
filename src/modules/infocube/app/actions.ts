"use server";

// InfoCube's server actions (slice 15a, B-2): New fact and New dimension, from the Cube tab and the canvas's toolbox.
// Each is InfoMapper's entity create at the dimensional level with InfoCube's row, one change group and one undo step;
// the card is placed as "New entity here" places it.

import { modelCommand } from "@/app/_lib/model-command";
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
