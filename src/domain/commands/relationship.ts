// Relationship commands: create (the relate button on an entity card, slice 1b; "Relate to itself" in its menu, slice
// 10a, D-61), and in the right panel label, cardinality on both ends, swap direction, delete.

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult } from "../changes";
import type { WorkspaceAccess } from "../permissions";
import { CARDINALITY_MAX, type Entity, type Relationship } from "../types";
import { optionalTextSchema, uuidSchema, versionSchema } from "../validation";
import { begin, current, done, found, nothingToChange, softDelete } from "./shared";

// ---- create ----

const createRelationshipInput = z.object({ fromEntityId: uuidSchema, toEntityId: uuidSchema }).strict();
export type CreateRelationshipInput = z.input<typeof createRelationshipInput>;

/**
 * A relationship with the prototype's default ends, 1 to 0..n, and no label yet; the panel then sets the label and the
 * cardinality. From an entity to itself (D-61) the ends are 0..1 to 0..n: a parent, optional, and its children.
 */
export function createRelationship(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { from: Entity | null; to: Entity | null },
  input: unknown,
): CommandResult<{ relationship: Relationship }> {
  const parsed = begin(access, "model.edit", createRelationshipInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { fromEntityId, toEntityId } = parsed.data;
  const from = found(state.from, access, fromEntityId, "entity");
  if (!from.ok) return fail(from.error);
  const to = found(state.to, access, toEntityId, "entity");
  if (!to.ok) return fail(to.error);

  const relationship: Relationship = {
    ...newRowColumns(ctx),
    workspace_id: access.workspace.id,
    from_entity_id: fromEntityId,
    to_entity_id: toEntityId,
    label: null,
    from_min: fromEntityId === toEntityId ? 0 : 1,
    from_max: "1",
    to_min: 0,
    to_max: "n",
    description: null,
  };
  return done(ctx, access, { relationship }, [{ kind: "insert", table: "relationship", row: relationship }]);
}

// ---- edit ----

const ref = { relationshipId: uuidSchema, expectedVersion: versionSchema };
const min = z.union([z.literal(0), z.literal(1)]);

const updateRelationshipInput = z
  .object({
    ...ref,
    label: optionalTextSchema.optional(),
    fromMin: min.optional(),
    fromMax: z.enum(CARDINALITY_MAX).optional(),
    toMin: min.optional(),
    toMax: z.enum(CARDINALITY_MAX).optional(),
    description: optionalTextSchema.optional(),
  })
  .strict();
export type UpdateRelationshipInput = z.input<typeof updateRelationshipInput>;

const COLUMNS = [
  ["label", "label"],
  ["fromMin", "from_min"],
  ["fromMax", "from_max"],
  ["toMin", "to_min"],
  ["toMax", "to_max"],
  ["description", "description"],
] as const;

export function updateRelationship(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { relationship: Relationship | null },
  input: unknown,
): CommandResult<{ relationship: Relationship }> {
  const parsed = begin(access, "model.edit", updateRelationshipInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const data = parsed.data;
  const got = current(state.relationship, access, data.relationshipId, data.expectedVersion, "relationship");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  const patch: Partial<Relationship> = {};
  for (const [field, column] of COLUMNS) {
    const value = data[field];
    if (value !== undefined && value !== before[column]) Object.assign(patch, { [column]: value });
  }
  if (Object.keys(patch).length === 0) return fail(nothingToChange());
  const row = nextVersion(ctx, before, patch);
  return done(ctx, access, { relationship: row }, [{ kind: "update", table: "relationship", before, row }]);
}

const refInput = z.object(ref).strict();
export type RelationshipRefInput = z.input<typeof refInput>;

/**
 * Swaps the two ends: the entities and their cardinalities change places. On a relationship from an entity to itself
 * only the cardinalities do, so with equal ends there is nothing to change (slice 10a, F10).
 */
export function swapRelationship(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { relationship: Relationship | null },
  input: unknown,
): CommandResult<{ relationship: Relationship }> {
  const parsed = begin(access, "model.edit", refInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.relationship, access, parsed.data.relationshipId, parsed.data.expectedVersion, "relationship");
  if (!got.ok) return fail(got.error);
  const r = got.row;
  if (r.from_entity_id === r.to_entity_id && r.from_min === r.to_min && r.from_max === r.to_max) return fail(nothingToChange());
  const row = nextVersion(ctx, r, {
    from_entity_id: r.to_entity_id,
    to_entity_id: r.from_entity_id,
    from_min: r.to_min,
    from_max: r.to_max,
    to_min: r.from_min,
    to_max: r.from_max,
  });
  return done(ctx, access, { relationship: row }, [{ kind: "update", table: "relationship", before: r, row }]);
}

export function deleteRelationship(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { relationship: Relationship | null },
  input: unknown,
): CommandResult {
  const parsed = begin(access, "model.edit", refInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.relationship, access, parsed.data.relationshipId, parsed.data.expectedVersion, "relationship");
  if (!got.ok) return fail(got.error);
  return done(ctx, access, undefined, [softDelete(ctx, "relationship", got.row)]);
}
