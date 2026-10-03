"use server";

// Model writes from the left panel (slice 1a, step 4): “New concept”, concept rename and delete (D-46, D-47),
// a new entity from “+” with its card, and the entity name from the right panel.

import { revalidatePath } from "next/cache";
import type { DataStore } from "@/data";
import { createConcept, deleteConcept, renameConcept } from "@/domain/commands/concept";
import { createEntity, updateEntity } from "@/domain/commands/entity";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceAccess } from "@/domain/permissions";
import { runCommand, type ActionResult } from "../_lib/run-command";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };

async function loadAccess(store: DataStore, workspaceId: unknown, userId: Uuid): Promise<WorkspaceAccess | null> {
  if (typeof workspaceId !== "string") return null;
  const workspace = await store.workspaces.get(workspaceId);
  if (!workspace) return null;
  return { workspace, member: await store.workspaces.getMember(workspace.id, userId) };
}

function done<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function createConceptAction(workspaceId: string, input: { name: string }): Promise<ActionResult<{ conceptId: string }>> {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const { concepts } = await store.model.load(access.workspace.id);
      return createConcept(ctx, access, { concepts }, input);
    }),
  );
}

export async function renameConceptAction(
  workspaceId: string,
  input: { conceptId: string; expectedVersion: number; name: string },
): Promise<ActionResult> {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const { concepts } = await store.model.load(access.workspace.id);
      const result = renameConcept(ctx, access, { concept: concepts.find((c) => c.id === input?.conceptId) ?? null }, input);
      return result.ok ? { ...result, value: undefined } : result;
    }),
  );
}

export async function deleteConceptAction(
  workspaceId: string,
  input: { conceptId: string; expectedVersion: number; moveToConceptId?: string | null },
): Promise<ActionResult<{ movedEntities: number }>> {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const { concepts, entities } = await store.model.load(access.workspace.id);
      const concept = concepts.find((c) => c.id === input?.conceptId) ?? null;
      return deleteConcept(ctx, access, { concept, concepts, entities: entities.filter((e) => e.concept_id === concept?.id) }, input);
    }),
  );
}

/** A new entity in a concept, with its card on the canvas at the given spot (D-46). */
export async function createEntityAction(
  workspaceId: string,
  input: { conceptId: string; placement: { canvasId: string; x: number; y: number } },
): Promise<ActionResult<{ entityId: string; canvasItemId: string | null; name: string }>> {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const [{ concepts, entities }, canvas] = await Promise.all([
        store.model.load(access.workspace.id),
        store.canvases.get(access.workspace.id, typeof input?.placement?.canvasId === "string" ? input.placement.canvasId : ""),
      ]);
      const concept = concepts.find((c) => c.id === input?.conceptId) ?? null;
      const result = createEntity(ctx, access, { concept, entities, canvas }, input);
      if (!result.ok) return result;
      const write = result.writeSet.writes.find((w) => w.kind === "insert" && w.table === "entity");
      const name = write?.kind === "insert" && write.table === "entity" ? write.row.name : "";
      return { ...result, value: { ...result.value, name } };
    }),
  );
}

/** The entity's name (right panel). A duplicate name comes back as a warning; it does not block (B-25). */
export async function renameEntityAction(
  workspaceId: string,
  input: { entityId: string; expectedVersion: number; name: string },
): Promise<ActionResult<{ warning: string | null }>> {
  return done(
    await runCommand(async (ctx, store, user) => {
      const access = await loadAccess(store, workspaceId, user.id);
      if (!access) return NOT_FOUND;
      const { entities } = await store.model.load(access.workspace.id);
      const entity = entities.find((e) => e.id === input?.entityId) ?? null;
      const result = updateEntity(ctx, access, { entity, entities, concept: null }, input);
      return result.ok ? { ...result, value: { warning: result.value.warning } } : result;
    }),
  );
}
