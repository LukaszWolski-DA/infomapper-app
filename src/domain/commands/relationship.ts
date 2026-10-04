// Relationship commands in the right panel: label, cardinality on both ends, swap direction, delete.
// Drawing new relationships on the canvas is slice 1b (AD-30).

import { z } from "zod";
import { fail, nextVersion, type CommandContext, type CommandResult } from "../changes";
import type { WorkspaceAccess } from "../permissions";
import { CARDINALITY_MAX, type Relationship } from "../types";
import { optionalTextSchema, uuidSchema, versionSchema } from "../validation";
import { begin, current, done, nothingToChange, softDelete } from "./shared";

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

/** Swaps the two ends: the entities and their cardinalities change places. */
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
