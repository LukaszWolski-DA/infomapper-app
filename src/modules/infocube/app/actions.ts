"use server";

// InfoCube's server actions (slice 15a, B-2): New fact and New dimension, from the Cube tab and the canvas's toolbox.
// Each is InfoMapper's entity create at the dimensional level with InfoCube's row, one change group and one undo step;
// the card is placed as "New entity here" places it.

import { modelCommand } from "@/app/_lib/model-command";
import type { ActionResult } from "@/app/_lib/run-command";
import { createCubeEntity } from "../domain/commands";
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
