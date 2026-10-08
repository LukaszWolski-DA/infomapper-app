// Concept commands: “New concept” (D-46), rename, delete (D-47).

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult } from "../changes";
import { domainError, notFound } from "../errors";
import type { Uuid } from "../ids";
import { nextConceptColor } from "../model/concept-colors";
import type { WorkspaceAccess } from "../permissions";
import type { Concept, Entity, Frame } from "../types";
import { nameSchema, uuidSchema, versionSchema } from "../validation";
import { begin, current, done, isLive, nextSortOrder, softDeleted } from "./shared";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ---- create ----

const createConceptInput = z.object({ name: nameSchema }).strict();
export type CreateConceptInput = z.input<typeof createConceptInput>;

/** Creates a concept at the end of the list, in the first palette colour no concept uses yet (D-41). */
export function createConcept(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { concepts: readonly Concept[] },
  input: unknown,
): CommandResult<{ conceptId: Uuid }> {
  const parsed = begin(access, "model.edit", createConceptInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const concepts = state.concepts.filter((c) => isLive(c, access.workspace.id));
  const concept: Concept = {
    ...newRowColumns(ctx),
    workspace_id: access.workspace.id,
    name: parsed.data.name,
    description_html: null,
    description_text: null,
    color: nextConceptColor(concepts.map((c) => c.color)),
    sort_order: nextSortOrder(concepts),
  };
  return done(ctx, access, { conceptId: concept.id }, [{ kind: "insert", table: "concept", row: concept }]);
}

// ---- rename ----

const renameConceptInput = z.object({ conceptId: uuidSchema, expectedVersion: versionSchema, name: nameSchema }).strict();
export type RenameConceptInput = z.input<typeof renameConceptInput>;

export function renameConcept(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { concept: Concept | null },
  input: unknown,
): CommandResult<{ concept: Concept }> {
  const parsed = begin(access, "model.edit", renameConceptInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { conceptId, expectedVersion, name } = parsed.data;
  const got = current(state.concept, access, conceptId, expectedVersion, "concept");
  if (!got.ok) return fail(got.error);
  const row = nextVersion(ctx, got.row, { name });
  return done(ctx, access, { concept: row }, [{ kind: "update", table: "concept", before: got.row, row }]);
}

// ---- delete (D-47) ----

const deleteConceptInput = z
  .object({ conceptId: uuidSchema, expectedVersion: versionSchema, moveToConceptId: uuidSchema.nullable().optional() })
  .strict();
export type DeleteConceptInput = z.input<typeof deleteConceptInput>;

export interface DeleteConceptState {
  concept: Concept | null;
  /** Live concepts of the workspace (to pick the one the entities move to). */
  concepts: readonly Concept[];
  /** Live entities of the concept. */
  entities: readonly Entity[];
  /** Frames on every canvas of the workspace: the concept's frames become free frames (D-47, slice 2b). */
  frames?: readonly Frame[];
}

/**
 * Deletes a concept. Its concept frames on every canvas become free frames, keeping their name, place and the
 * concept's colour, which they were drawn in (D-47; Łukasz, slice 2b step 1 answer 9), in the same change group. An
 * empty concept is deleted directly. A concept with entities is deleted only together with
 * moving its entities to another concept, in one change group; there is no cascade. The only concept cannot be
 * deleted while it holds entities.
 */
export function deleteConcept(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: DeleteConceptState,
  input: unknown,
): CommandResult<{ movedEntities: number }> {
  const parsed = begin(access, "model.edit", deleteConceptInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { conceptId, expectedVersion, moveToConceptId } = parsed.data;
  const got = current(state.concept, access, conceptId, expectedVersion, "concept");
  if (!got.ok) return fail(got.error);
  const concept = got.row;
  const entities = state.entities.filter((e) => isLive(e, access.workspace.id) && e.concept_id === concept.id);
  const others = state.concepts.filter((c) => isLive(c, access.workspace.id) && c.id !== concept.id);

  const freed = (state.frames ?? [])
    .filter((f) => isLive(f, access.workspace.id) && f.kind === "concept" && f.concept_id === concept.id)
    .map((f) => ({ kind: "update" as const, table: "frame" as const, before: f, row: nextVersion(ctx, f, { kind: "free", concept_id: null, color: concept.color }) }));

  if (entities.length === 0) {
    return done(ctx, access, { movedEntities: 0 }, [
      ...freed,
      { kind: "update", table: "concept", before: concept, row: softDeleted(ctx, concept) },
    ]);
  }
  const held = plural(entities.length, "entity", "entities");
  if (others.length === 0) {
    return fail(
      domainError("invalid", `${concept.name} is the only concept and holds ${held}. Create another concept to move them to first.`),
    );
  }
  if (!moveToConceptId) {
    return fail(domainError("invalid", `${concept.name} holds ${held}. Choose a concept to move them to first.`, { moveToConceptId: "Choose a concept." }));
  }
  const target = others.find((c) => c.id === moveToConceptId);
  if (!target) {
    return fail(moveToConceptId === concept.id ? domainError("invalid", "Choose another concept to move the entities to.") : notFound("concept"));
  }

  return done(ctx, access, { movedEntities: entities.length }, [
    ...entities.map((e) => ({ kind: "update" as const, table: "entity" as const, before: e, row: nextVersion(ctx, e, { concept_id: target.id }) })),
    ...freed,
    { kind: "update", table: "concept", before: concept, row: softDeleted(ctx, concept) },
  ]);
}
