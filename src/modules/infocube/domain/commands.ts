// InfoCube's commands for facts and dimensions (slice 15a, B-1, C-5): a fact or a dimension is an entity of the
// dimensional level, made by InfoMapper's own command, with its role in InfoCube's row in the same change group.
// Slice 15b: a fact's grain, a dimension's SCD type, measures (B-4), key links and Add key (role-playing R-1, R-3).

import { z } from "zod";
import { buildWriteSet, fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "@/domain/changes";
import { createEntity, type CreateEntityState } from "@/domain/commands/entity";
import { begin, current, done, found, isLive, nothingToChange, softDelete } from "@/domain/commands/shared";
import { domainError, notFound, staleVersion } from "@/domain/errors";
import type { Uuid } from "@/domain/ids";
import { infocubeOff } from "@/domain/model/levels";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { Attribute } from "@/domain/types";
import { optionalTextSchema, uuidSchema, versionSchema } from "@/domain/validation";
import { cubeIndex, dimensionAs, factEnds, keyName, roleAt, type CubeIndex, type CubeModel } from "./keys";
import { ADDITIVITIES, DEFAULT_SCD_TYPE, type CubeEntity, type CubeKey, type CubeMeasure, type CubeRole } from "./types";

/** "New fact", "New dimension": numbered among the dimensional names when taken (prototype `createEntity`). */
const DEFAULT_NAME: Record<CubeRole, string> = { fact: "New fact", dimension: "New dimension" };

/**
 * New fact or New dimension (B-1, the Cube tab and the canvas's toolbox): InfoMapper's \`createEntity\` at the dimensional
 * level, then InfoCube's row with the role (a fact without a grain yet, a dimension of SCD type 1). Refused while
 * InfoCube is off in the workspace (C-7); the role, the rights and the rest are \`createEntity\`'s.
 */
export function createCubeEntity(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: CreateEntityState,
  role: CubeRole,
  input: unknown,
  /** The default name's base (slice 15c: "Dim {entity}" for "Create dimension from this…"). */
  defaultName: string = DEFAULT_NAME[role],
): CommandResult<{ entityId: Uuid; canvasItemId: Uuid | null; warning: string | null }> {
  const made = createEntity(ctx, access, state, input, { level: "dimensional", defaultName });
  if (!made.ok) return made;
  if (!access.workspace.infocube) return { ok: false, error: infocubeOff() };
  const cube: CubeEntity = {
    ...newRowColumns(ctx),
    workspace_id: access.workspace.id,
    entity_id: made.value.entityId,
    role,
    grain: null,
    scd_type: role === "dimension" ? DEFAULT_SCD_TYPE : null,
  };
  const writes: Write[] = [...made.writeSet.writes, { kind: "insert", table: "cube_entity", row: cube }];
  return { ok: true, value: made.value, writeSet: buildWriteSet(ctx, access.workspace.id, writes) };
}

/**
 * The end a relationship between two entities must start at (D-67, the prototype's turn): between a fact and a
 * dimension, the dimension (the 1..1 end); otherwise none.
 */
export function dimensionEnd(cubeEntities: readonly Pick<CubeEntity, "entity_id" | "role" | "deleted_at">[], a: Uuid, b: Uuid): Uuid | null {
  const roleOf = (id: Uuid) => cubeEntities.find((c) => c.entity_id === id && c.deleted_at === null)?.role;
  const [ra, rb] = [roleOf(a), roleOf(b)];
  if (ra === "fact" && rb === "dimension") return b;
  if (ra === "dimension" && rb === "fact") return a;
  return null;
}

// ---- slice 15b: grain, SCD type, measures (B-4) ----

const cubeEntityInput = z
  .object({
    cubeEntityId: uuidSchema,
    expectedVersion: versionSchema,
    /** A fact's grain (plain text, trimmed, empty = none). */
    grain: optionalTextSchema.optional(),
    /** A dimension's SCD type. */
    scdType: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  })
  .strict();
export type UpdateCubeEntityInput = z.input<typeof cubeEntityInput>;

export const GRAIN_ON_DIMENSION = "Only a fact has a grain.";
export const SCD_ON_FACT = "Only a dimension has an SCD type.";

/** A fact's grain or a dimension's SCD type (B-4): InfoCube's row of the entity, at the version the panel read. */
export function updateCubeEntity(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { cube: CubeEntity | null },
  input: unknown,
): CommandResult<{ version: number }> {
  const parsed = begin(access, "model.edit", cubeEntityInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { cubeEntityId, expectedVersion, grain, scdType } = parsed.data;
  const got = current(state.cube, access, cubeEntityId, expectedVersion, "fact or dimension");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  if (grain !== undefined && before.role !== "fact") return fail(domainError("invalid", GRAIN_ON_DIMENSION));
  if (scdType !== undefined && before.role !== "dimension") return fail(domainError("invalid", SCD_ON_FACT));
  const patch: Partial<CubeEntity> = {};
  if (grain !== undefined && grain !== before.grain) patch.grain = grain;
  if (scdType !== undefined && scdType !== before.scd_type) patch.scd_type = scdType;
  if (!Object.keys(patch).length) return fail(nothingToChange());
  const row = nextVersion(ctx, before, patch);
  return done(ctx, access, { version: row.version }, [{ kind: "update", table: "cube_entity", before, row }]);
}

const NUMERIC = new Set<Attribute["data_type"]>(["integer", "decimal"]);
export const MEASURE_NOT_ON_FACT = "Only an attribute of a fact can be a measure.";
/** The toast when a foreign key is made a measure (B-4); the measure is made all the same. */
export const measureOnForeignKey = (name: string) => `${name} is a foreign key. A dimension key is usually not a measure.`;

const measureInput = z.discriminatedUnion("on", [
  z.object({ on: z.literal(true), attributeId: uuidSchema }).strict(),
  z.object({ on: z.literal(false), attributeId: uuidSchema, measureId: uuidSchema, expectedVersion: versionSchema }).strict(),
]);
export type SetMeasureInput = z.input<typeof measureInput>;

export interface MeasureState {
  attribute: Attribute | null;
  /** The attribute's entity's InfoCube row (a measure only on a fact). */
  cube: CubeEntity | null;
  /** The attribute's live measure, if any. */
  measure: CubeMeasure | null;
}

/**
 * The Measure toggle (B-4): on makes an attribute of a fact a measure, Additive for Integer and Decimal, Non-additive
 * otherwise; off deletes the measure (soft, one undo step). `warning` is the toast for a foreign key made a measure.
 */
export function setMeasure(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: MeasureState,
  input: unknown,
): CommandResult<{ measureId: Uuid | null; warning: string | null }> {
  const parsed = begin(access, "model.edit", measureInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const data = parsed.data;
  const attribute = found(state.attribute, access, data.attributeId, "attribute");
  if (!attribute.ok) return fail(attribute.error);
  const a = attribute.row;
  const live = isLive(state.measure, access.workspace.id) && state.measure.attribute_id === a.id ? state.measure : null;
  if (!data.on) {
    const got = current(live, access, data.measureId, data.expectedVersion, "measure");
    if (!got.ok) return fail(got.error);
    return done(ctx, access, { measureId: null, warning: null }, [softDelete(ctx, "cube_measure", got.row)]);
  }
  const cube = state.cube;
  if (!isLive(cube, access.workspace.id) || cube.entity_id !== a.entity_id || cube.role !== "fact") return fail(domainError("invalid", MEASURE_NOT_ON_FACT));
  if (live) return fail(nothingToChange());
  const measure: CubeMeasure = {
    ...newRowColumns(ctx),
    workspace_id: access.workspace.id,
    attribute_id: a.id,
    additivity: NUMERIC.has(a.data_type) ? "additive" : "non",
    semi_note: null,
  };
  return done(ctx, access, { measureId: measure.id, warning: a.is_foreign_key ? measureOnForeignKey(a.name) : null }, [
    { kind: "insert", table: "cube_measure", row: measure },
  ]);
}

const updateMeasureInput = z
  .object({
    measureId: uuidSchema,
    expectedVersion: versionSchema,
    additivity: z.enum(ADDITIVITIES).optional(),
    /** "Not additive across …" (trimmed, empty = none); only on a semi-additive measure. */
    semiNote: optionalTextSchema.optional(),
  })
  .strict();
export type UpdateMeasureInput = z.input<typeof updateMeasureInput>;

export const SEMI_NOTE_ONLY_SEMI = "Only a semi-additive measure has “Not additive across”.";

/** A measure's additivity and its semi-additive note (B-4): leaving semi-additive clears the note (prototype `cube.add`). */
export function updateMeasure(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { measure: CubeMeasure | null },
  input: unknown,
): CommandResult<{ version: number }> {
  const parsed = begin(access, "model.edit", updateMeasureInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { measureId, expectedVersion, additivity, semiNote } = parsed.data;
  const got = current(state.measure, access, measureId, expectedVersion, "measure");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  const nextAdditivity = additivity ?? before.additivity;
  if (semiNote && nextAdditivity !== "semi") return fail(domainError("invalid", SEMI_NOTE_ONLY_SEMI));
  const patch: Partial<CubeMeasure> = {};
  if (nextAdditivity !== before.additivity) patch.additivity = nextAdditivity;
  const note = nextAdditivity === "semi" ? (semiNote === undefined ? before.semi_note : semiNote) : null;
  if (note !== before.semi_note) patch.semi_note = note;
  if (!Object.keys(patch).length) return fail(nothingToChange());
  const row = nextVersion(ctx, before, patch);
  return done(ctx, access, { version: row.version }, [{ kind: "update", table: "cube_measure", before, row }]);
}

// ---- key links (RP-B, R-1) and Add key (R-3) ----

/** What a key command reads: the workspace's model and InfoCube's rows (deleted rows are ignored). */
export type KeyState = CubeModel;

export const NOT_FACT_DIMENSION = "This relationship does not join a fact and a dimension.";
export const notFactsForeignKey = (attribute: string, fact: string) => `${attribute} is not a foreign key of ${fact}.`;
export const alreadyCarries = (attribute: string, what: string) => `${attribute} already carries ${what}. Pick another key.`;
export const alreadyHasKey = (fact: string, what: string, key: string) => `${fact} already has a key for ${what}: ${key}.`;
export const noPrimaryKey = (dimension: string) => `${dimension} has no primary key yet.`;
/** Add key's toast (prototype `addKey`). */
export const addedKey = (name: string, what: string) => `Added ${name}, the key of ${what}.`;

const keyRef = {
  relationshipId: uuidSchema,
  /** The relationship's live link as the page knows it (active or not), null for none: the link's optimistic check. */
  currentKeyId: uuidSchema.nullable(),
};
const linkKeyInput = z.object({ ...keyRef, attributeId: uuidSchema.nullable() }).strict();
export type LinkKeyInput = z.input<typeof linkKeyInput>;

/** The relationship between a fact and a dimension, and its live link checked against the page's. */
function keyContext(access: WorkspaceAccess, index: CubeIndex, relationshipId: Uuid, currentKeyId: Uuid | null) {
  const r = index.relationship(relationshipId);
  if (!r || r.workspace_id !== access.workspace.id) return { ok: false as const, error: notFound("relationship") };
  const ends = factEnds(r, index.roleOf);
  if (!ends) return { ok: false as const, error: domainError("invalid", NOT_FACT_DIMENSION) };
  const link = index.linkOfRelationship(r.id) ?? null;
  if ((link?.id ?? null) !== currentKeyId) return { ok: false as const, error: staleVersion() };
  return { ok: true as const, r, ends, link, what: dimensionAs(index, { dimensionId: ends.dimension, role: roleAt(r, ends.dimension) }) };
}

/**
 * "Key in {fact}" (R-1): links a foreign key of the relationship's fact to it, or none. One link per relationship: its
 * live link, active or inactive, is replaced in the same change group. One per attribute: an attribute that carries
 * another relationship is refused. The attribute must be a foreign key of the fact (the select offers only those);
 * nothing is written on the attribute.
 */
export function linkKey(ctx: CommandContext, access: WorkspaceAccess, state: KeyState, input: unknown): CommandResult<{ keyId: Uuid | null }> {
  const parsed = begin(access, "model.edit", linkKeyInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { relationshipId, currentKeyId, attributeId } = parsed.data;
  const index = cubeIndex(state);
  const got = keyContext(access, index, relationshipId, currentKeyId);
  if (!got.ok) return fail(got.error);
  const { link, ends } = got;
  if (attributeId === null) {
    if (!link) return fail(nothingToChange());
    return done(ctx, access, { keyId: null }, [softDelete(ctx, "cube_key", link)]);
  }
  const a = index.attribute(attributeId);
  if (!a || a.workspace_id !== access.workspace.id) return fail(notFound("attribute"));
  if (a.entity_id !== ends.fact || !a.is_foreign_key) return fail(domainError("invalid", notFactsForeignKey(a.name, index.nameOf(ends.fact))));
  if (link?.attribute_id === a.id) return fail(nothingToChange());
  const other = index.linkOfAttribute(a.id);
  const otherRelationship = other && index.relationship(other.relationship_id);
  const otherEnds = otherRelationship && factEnds(otherRelationship, index.roleOf);
  if (other) {
    const what = otherRelationship && otherEnds ? dimensionAs(index, { dimensionId: otherEnds.dimension, role: roleAt(otherRelationship, otherEnds.dimension) }) : "another relationship";
    return fail(domainError("invalid", alreadyCarries(a.name, what)));
  }
  const key: CubeKey = { ...newRowColumns(ctx), workspace_id: access.workspace.id, relationship_id: relationshipId, attribute_id: a.id };
  return done(ctx, access, { keyId: key.id }, [...(link ? [softDelete(ctx, "cube_key", link)] : []), { kind: "insert", table: "cube_key", row: key }]);
}

const addKeyInput = z.object(keyRef).strict();
export type AddKeyInput = z.input<typeof addKeyInput>;

/**
 * Add key (R-3), one change group: a new attribute of the fact named by `keyName` from the role at the dimension's end
 * and the dimension's primary key, of the primary key's type, a foreign key, not nullable, placed after the fact's last
 * key attribute (the attributes renumbered 0..n-1, only changed rows written), and its link to the relationship. An
 * inactive link of the relationship (R3) is deleted in the same group. Refused while the relationship has an active key
 * or the dimension has no primary key.
 */
export function addKey(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: KeyState,
  input: unknown,
): CommandResult<{ attributeId: Uuid; keyId: Uuid; name: string; toast: string }> {
  const parsed = begin(access, "model.edit", addKeyInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const index = cubeIndex(state);
  const got = keyContext(access, index, parsed.data.relationshipId, parsed.data.currentKeyId);
  if (!got.ok) return fail(got.error);
  const { r, ends, link, what } = got;
  const active = index.keyOf(r.id);
  if (active) return fail(domainError("invalid", alreadyHasKey(index.nameOf(ends.fact), what, active.name)));
  const pk = index.pkOf(ends.dimension);
  if (!pk) return fail(domainError("invalid", noPrimaryKey(index.nameOf(ends.dimension))));

  const siblings = index.attributesOf(ends.fact);
  const name = keyName(roleAt(r, ends.dimension), pk.name, siblings.map((a) => a.name));
  const attribute: Attribute = {
    ...newRowColumns(ctx),
    workspace_id: access.workspace.id,
    entity_id: ends.fact,
    name,
    alias: null,
    sort_order: 0,
    data_type: pk.data_type,
    custom_type: pk.custom_type,
    type_length: pk.type_length,
    type_precision: pk.type_precision,
    type_scale: pk.type_scale,
    is_primary_key: false,
    is_foreign_key: true,
    is_business_key: false,
    is_pii: false,
    is_nullable: false,
    definition_html: null,
    definition_text: null,
    copied_from_attribute_id: null,
  };
  const order: Attribute[] = [...siblings];
  order.splice(order.findLastIndex((a) => a.is_primary_key || a.is_foreign_key) + 1, 0, attribute);
  const renumbered: Write[] = [];
  order.forEach((a, i) => {
    if (a === attribute) attribute.sort_order = i;
    else if (a.sort_order !== i) renumbered.push({ kind: "update", table: "attribute", before: a, row: nextVersion(ctx, a, { sort_order: i }) });
  });
  const key: CubeKey = { ...newRowColumns(ctx), workspace_id: access.workspace.id, relationship_id: r.id, attribute_id: attribute.id };
  const result = done(ctx, access, { attributeId: attribute.id, keyId: key.id, name, toast: addedKey(name, what) }, [
    { kind: "insert", table: "attribute", row: attribute },
    ...renumbered,
    ...(link ? [softDelete(ctx, "cube_key", link)] : []),
    { kind: "insert", table: "cube_key", row: key },
  ]);
  // the active context labels the new attribute only, not those renumbered around it (as `reorderAttribute`)
  if (result.ok) result.writeSet.mainTargets = [{ kind: "attribute", id: attribute.id }];
  return result;
}
