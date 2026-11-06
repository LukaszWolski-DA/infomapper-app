// InfoCube's dimensional mappings (slice 15c, B-6, M1, AD-36): logical attribute(s) → an attribute of a fact or a
// dimension. The commands (create by a drop onto a row or a header, inputs, kind, rule, note, status with four-eyes, the
// target, delete), "Create dimension from this…" (B-2) and the derived reads (what an attribute feeds and is fed from, the
// cards' feeds, the delete previews' rows). InfoMapper's `mapping` stays source column(s) → attribute.
//
// D-51's first rule (O12): a change of an approved mapping's inputs, kind, rule or target sends it back to review and
// clears its approval; a note alone does not. Every content change bumps the mapping's version, so one expectedVersion
// guards the mapping and its inputs (as InfoMapper's). A transformation may have no rule yet (the prototype: "Describe
// the rule"); a direct copy reads exactly one attribute (AD-26).
//
// Deleting an attribute takes its mappings in the same change group through the module cascade (`goesWhole`, Q-5): a
// target's mappings, and every mapping that reads it, whole.

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "@/domain/changes";
import type { CreateEntityState } from "@/domain/commands/entity";
import { begin, current, done, found, nextSortOrder, nothingToChange, softDelete } from "@/domain/commands/shared";
import { domainError, notFound } from "@/domain/errors";
import type { Uuid } from "@/domain/ids";
import { isDimensional, isLogical } from "@/domain/model/levels";
import { BACK_TO_REVIEW_MESSAGE, checkFourEyes, type MappingLog } from "@/domain/model/mapping-rules";
import { plainTextPair } from "@/domain/model/plain-text";
import { sanitizeRich } from "@/domain/model/rich-text";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { Attribute, CanvasItem, Entity } from "@/domain/types";
import { uuidSchema, versionSchema } from "@/domain/validation";
import { createCubeEntity } from "./commands";
import { snakeCase, typeWord } from "./keys";
import { CUBE_MAPPING_KINDS, CUBE_MAPPING_STATUSES, type CubeMapping, type CubeMappingInput } from "./types";

/** The change log's tables of a dimensional mapping, for four-eyes (C11): a re-pointed target is content too (X5). */
export const CUBE_MAPPING_LOG: MappingLog = { mapping: "cube_mapping", input: "cube_mapping_input", content: ["kind", "rule_expression", "attribute_id"] };

// ---- the texts (the prototype's: `DIM_MSG`, `createCubeMap`, `createDimAttrFrom`, `insCmap`'s handlers, `createDimFrom`) ----

/** A logical attribute dropped on a logical one, or a logical attribute as a mapping's target. */
export const LOGICAL_TO_LOGICAL = "A logical attribute maps onto a fact or a dimension. To relate two logical entities, draw a relationship.";
/** A dimensional attribute dropped on a dimensional one, or a dimensional attribute as an input. */
export const DIMENSIONAL_TO_DIMENSIONAL = "A dimensional attribute is fed from the logical model. Drag a logical attribute onto it.";
/** A dimensional attribute dropped on a source column. */
export const DIMENSIONAL_TO_COLUMN = "Facts and dimensions are fed from the logical model, not from source columns.";
/** The drop of an identical mapping: the page selects the existing one. */
export const MAPPING_EXISTS_SELECTED = "That mapping already exists. It is selected now.";
/** A re-point onto a target that has the identical mapping (difference 8). */
export const MAPPING_EXISTS = "That mapping already exists.";
export const ALREADY_READS = "It already reads that attribute.";
export const DIRECT_READS_ONE = "A direct copy reads one attribute. Remove the others first.";
/** The last input's remove (the panel offers no × there; "Delete mapping" does it). New text, for approval. */
export const LAST_INPUT = "A mapping reads at least one attribute. Delete the mapping instead.";
/** "Create dimension from this…" on an entity that is not logical. New text, for approval. */
export const DIMENSION_FROM_LOGICAL_ONLY = "A dimension is created from a logical entity.";
/** The surrogate key's description (the prototype's). */
export const SURROGATE_KEY_DESCRIPTION = "Surrogate key of the dimension.";

export const mappedToast = (from: string, to: string, types: readonly [string, string] | null) =>
  `Mapped ${from} to ${to}${types ? `. The types differ (${types[0]} → ${types[1]}).` : ""}`;
export const addedOnHeaderToast = (attribute: string, entity: string, from: string) => `Added ${attribute} to ${entity}, fed from ${from}. Rename it on the right.`;
export const readsTooToast = (from: string, wasDirect: boolean) => `It reads ${from} too${wasDirect ? ", so it is a transformation now. Describe the rule" : ""}.`;
export const repointedToast = (to: string) => `Re-pointed to ${to}`;
export const createdDimensionToast = (name: string, n: number, from: string, key: string) =>
  `Created ${name} with ${n} attribute${n === 1 ? "" : "s"} fed from ${from}, plus its key ${key}.`;

// ---- the model a command reads ----

/** The model and InfoCube's mapping rows a command or read needs (deleted rows are ignored). */
export interface MappingModel {
  entities: readonly Pick<Entity, "id" | "name" | "model_level" | "deleted_at">[];
  attributes: readonly Attribute[];
  cubeMappings: readonly CubeMapping[];
  cubeMappingInputs: readonly CubeMappingInput[];
}

const live = <T extends { deleted_at: string | null }>(r: T | null | undefined): r is T => !!r && r.deleted_at === null;
const byOrder = (a: Attribute, b: Attribute) => a.sort_order - b.sort_order || a.name.localeCompare(b.name);
/** In the order they were made: by `created_at`, else by id (UUID v7; the page's rows come without `created_*`, O8). */
const madeFirst = (a: CubeMapping, b: CubeMapping) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id);

/** One read of the dimensional mappings, built once per page or command. */
export interface MappingIndex {
  attribute(id: Uuid): Attribute | undefined;
  entity(id: Uuid): MappingModel["entities"][number] | undefined;
  /** The live attributes of an entity, in their order. */
  attributesOf(entityId: Uuid): readonly Attribute[];
  /** A live attribute's level, by its entity; undefined for none. */
  levelOf(attributeId: Uuid): "logical" | "dimensional" | undefined;
  mapping(id: Uuid): CubeMapping | undefined;
  /** A mapping's live inputs, in their order. */
  inputsOf(mappingId: Uuid): readonly CubeMappingInput[];
  /** The live mappings onto a dimensional attribute, in the order they were made. */
  mappingsTo(attributeId: Uuid): readonly CubeMapping[];
  /** The live mappings that read a logical attribute, in the order they were made. */
  mappingsFrom(attributeId: Uuid): readonly CubeMapping[];
  /** "Customer.segment_code" (the prototype's `attrLabel`). */
  label(attributeId: Uuid): string;
}

export function mappingIndex(model: MappingModel): MappingIndex {
  const entities = new Map(model.entities.filter(live).map((e) => [e.id, e]));
  const attributes = new Map(model.attributes.filter((a) => live(a) && entities.has(a.entity_id)).map((a) => [a.id, a]));
  const attributesOf = new Map<Uuid, Attribute[]>();
  for (const a of attributes.values()) (attributesOf.get(a.entity_id) ?? attributesOf.set(a.entity_id, []).get(a.entity_id)!).push(a);
  for (const list of attributesOf.values()) list.sort(byOrder);
  const mappings = new Map(model.cubeMappings.filter(live).map((m) => [m.id, m]));
  const inputs = new Map<Uuid, CubeMappingInput[]>();
  const from = new Map<Uuid, Set<CubeMapping>>();
  for (const i of model.cubeMappingInputs) {
    const m = live(i) ? mappings.get(i.mapping_id) : undefined;
    if (!m) continue;
    (inputs.get(m.id) ?? inputs.set(m.id, []).get(m.id)!).push(i);
    (from.get(i.attribute_id) ?? from.set(i.attribute_id, new Set()).get(i.attribute_id)!).add(m);
  }
  for (const list of inputs.values()) list.sort((a, b) => a.sort_order - b.sort_order);
  const to = new Map<Uuid, CubeMapping[]>();
  for (const m of mappings.values()) (to.get(m.attribute_id) ?? to.set(m.attribute_id, []).get(m.attribute_id)!).push(m);
  for (const list of to.values()) list.sort(madeFirst);
  return {
    attribute: (id) => attributes.get(id),
    entity: (id) => entities.get(id),
    attributesOf: (id) => attributesOf.get(id) ?? [],
    levelOf(id) {
      const a = attributes.get(id);
      const e = a && entities.get(a.entity_id);
      return e ? (isDimensional(e) ? "dimensional" : "logical") : undefined;
    },
    mapping: (id) => mappings.get(id),
    inputsOf: (id) => inputs.get(id) ?? [],
    mappingsTo: (id) => to.get(id) ?? [],
    mappingsFrom: (id) => [...(from.get(id) ?? [])].sort(madeFirst),
    label(id) {
      const a = attributes.get(id);
      return `${(a && entities.get(a.entity_id)?.name) ?? "?"}.${a?.name ?? "?"}`;
    },
  };
}

/** The live mapping onto a target that reads exactly these inputs in this order, if any ("That mapping already exists"). */
export function identicalMapping(index: MappingIndex, targetId: Uuid, inputIds: readonly Uuid[], exceptId?: Uuid): CubeMapping | undefined {
  return index.mappingsTo(targetId).find((m) => {
    if (m.id === exceptId) return false;
    const own = index.inputsOf(m.id).map((i) => i.attribute_id);
    return own.length === inputIds.length && own.every((id, n) => id === inputIds[n]);
  });
}

/** An input's and a target's types when they differ (the create's toast, the panel's warning on a direct copy). */
export const typesDiffer = (input: Attribute | undefined, target: Attribute | undefined): [string, string] | null =>
  input && target && typeWord(input) !== typeWord(target) ? [typeWord(input), typeWord(target)] : null;

/** The refusal of an input that is not logical or a target that is not dimensional, else null. */
function levelRefusal(index: MappingIndex, inputId: Uuid | null, targetId: Uuid | null) {
  if (inputId !== null && index.levelOf(inputId) !== "logical") return domainError("invalid", DIMENSIONAL_TO_DIMENSIONAL);
  if (targetId !== null && index.levelOf(targetId) !== "dimensional") return domainError("invalid", LOGICAL_TO_LOGICAL);
  return null;
}

/** The dimensional entity's attribute with this name, case ignored (the prototype maps onto it instead of copying). */
const sameNamed = (index: MappingIndex, entityId: Uuid, name: string): Attribute | undefined =>
  index.attributesOf(entityId).find((a) => a.name.toLocaleLowerCase() === name.toLocaleLowerCase());

// ---- the drop (B-6; step 1's drag table) ----

/** What a row's drop on the canvas does: a mapping onto a row, a new attribute on a header, the existing one, a toast. */
export type DropPlan =
  | { t: "map"; inputId: Uuid; targetId: Uuid }
  | { t: "header"; inputId: Uuid; entityId: Uuid }
  | { t: "exists"; mappingId: Uuid }
  | { t: "refuse"; message: string }
  | { t: "none" };

/**
 * An attribute's row dropped on another attribute's row, an entity card's header or a source column's row (the
 * prototype's `findDrop`): the mapping always runs logical → dimensional, whichever end the drag started from. A logical
 * row's drop on a column does nothing in 15c (X1). A source column's own drag stays InfoMapper's.
 */
export function planDrop(index: MappingIndex, fromId: Uuid, onto: { attributeId: Uuid } | { entityId: Uuid } | { columnId: Uuid } | null): DropPlan {
  const from = index.levelOf(fromId);
  if (!from || !onto) return { t: "none" };
  if ("columnId" in onto) return from === "dimensional" ? { t: "refuse", message: DIMENSIONAL_TO_COLUMN } : { t: "none" };
  if ("entityId" in onto) {
    const e = index.entity(onto.entityId);
    if (!e || from !== "logical" || !isDimensional(e)) return { t: "none" };
    const same = sameNamed(index, e.id, index.attribute(fromId)!.name);
    return same ? withExisting(index, fromId, same.id) : { t: "header", inputId: fromId, entityId: e.id };
  }
  if (onto.attributeId === fromId) return { t: "none" };
  const to = index.levelOf(onto.attributeId);
  if (!to) return { t: "none" };
  if (from === to) return { t: "refuse", message: from === "logical" ? LOGICAL_TO_LOGICAL : DIMENSIONAL_TO_DIMENSIONAL };
  return from === "logical" ? withExisting(index, fromId, onto.attributeId) : withExisting(index, onto.attributeId, fromId);
}

function withExisting(index: MappingIndex, inputId: Uuid, targetId: Uuid): DropPlan {
  const dup = identicalMapping(index, targetId, [inputId]);
  return dup ? { t: "exists", mappingId: dup.id } : { t: "map", inputId, targetId };
}

// ---- D-51 ----

/** D-51's first rule on a dimensional mapping: a content change of an approved one sends it to review (O12). */
export function cubeAfterContentChange(before: Pick<CubeMapping, "status">): { patch: Partial<CubeMapping>; notice: string | null } {
  if (before.status !== "approved") return { patch: {}, notice: null };
  return { patch: { status: "review", approved_by: null, approved_at: null }, notice: BACK_TO_REVIEW_MESSAGE };
}

// ---- create ----

const newMapping = (ctx: CommandContext, workspaceId: Uuid, targetId: Uuid): CubeMapping => ({
  ...newRowColumns(ctx),
  workspace_id: workspaceId,
  attribute_id: targetId,
  kind: "direct",
  rule_expression: null,
  status: "draft",
  note: null,
  approved_by: null,
  approved_at: null,
});
const newInput = (ctx: CommandContext, workspaceId: Uuid, mappingId: Uuid, attributeId: Uuid, sortOrder: number): CubeMappingInput => ({
  ...newRowColumns(ctx),
  workspace_id: workspaceId,
  mapping_id: mappingId,
  attribute_id: attributeId,
  sort_order: sortOrder,
});
/** A new direct Draft mapping from one logical attribute: its two rows. */
const mappingWrites = (ctx: CommandContext, workspaceId: Uuid, inputId: Uuid, targetId: Uuid): { mapping: CubeMapping; writes: Write[] } => {
  const mapping = newMapping(ctx, workspaceId, targetId);
  return {
    mapping,
    writes: [
      { kind: "insert", table: "cube_mapping", row: mapping },
      { kind: "insert", table: "cube_mapping_input", row: newInput(ctx, workspaceId, mapping.id, inputId, 0) },
    ],
  };
};

const createInput = z.object({ inputAttributeId: uuidSchema, targetAttributeId: uuidSchema }).strict();
export type CreateCubeMappingInput = z.input<typeof createInput>;

/**
 * A logical attribute onto a dimensional one (a drop on a row, "Add a logical attribute" in a dimensional attribute's
 * panel): a direct Draft mapping, one undo step. Refused: an input that is not logical, a target that is not dimensional,
 * the identical mapping (the page selects the existing one).
 */
export function createCubeMapping(ctx: CommandContext, access: WorkspaceAccess, state: MappingModel, input: unknown): CommandResult<{ mappingId: Uuid; toast: string }> {
  const parsed = begin(access, "model.edit", createInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { inputAttributeId, targetAttributeId } = parsed.data;
  const index = mappingIndex(state);
  const refused = levelRefusal(index, inputAttributeId, targetAttributeId);
  if (refused) return fail(refused);
  if (identicalMapping(index, targetAttributeId, [inputAttributeId])) return fail(domainError("conflict", MAPPING_EXISTS_SELECTED));
  const { mapping, writes } = mappingWrites(ctx, access.workspace.id, inputAttributeId, targetAttributeId);
  const types = typesDiffer(index.attribute(inputAttributeId), index.attribute(targetAttributeId));
  return done(ctx, access, { mappingId: mapping.id, toast: mappedToast(index.label(inputAttributeId), index.label(targetAttributeId), types) }, writes);
}

const onHeaderInput = z
  .object({
    inputAttributeId: uuidSchema,
    entityId: uuidSchema,
    /** The target's card where it was dropped, at the version the page read: shown open with the new row (the prototype). */
    card: z.object({ canvasItemId: uuidSchema, expectedVersion: versionSchema }).strict().optional(),
  })
  .strict();
export type CreateOnHeaderInput = z.input<typeof onHeaderInput>;

/**
 * A logical attribute dropped on a fact's or a dimension's header (B-6): a new attribute of that entity, a plain copy of
 * the input (name, type and its parameters, Personal data, definition; no key, nullable; not a D-63 copy, which follows
 * its original within a level), placed last, and its direct Draft mapping, one change group. When the entity already
 * has an attribute of that name (case ignored) the drop maps onto it instead (`createCubeMapping`). The card the drop
 * landed on is opened and its row filter set to All when it would hide the new row.
 */
export function createOnHeader(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: MappingModel & { card?: CanvasItem | null },
  input: unknown,
): CommandResult<{ mappingId: Uuid; attributeId: Uuid; toast: string }> {
  const parsed = begin(access, "model.edit", onHeaderInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { inputAttributeId, entityId, card } = parsed.data;
  const index = mappingIndex(state);
  const refused = levelRefusal(index, inputAttributeId, null);
  if (refused) return fail(refused);
  const entity = index.entity(entityId);
  if (!entity || !isDimensional(entity)) return fail(domainError("invalid", LOGICAL_TO_LOGICAL));
  const source = index.attribute(inputAttributeId)!;
  const same = sameNamed(index, entityId, source.name);
  if (same) {
    const mapped = createCubeMapping(ctx, access, state, { inputAttributeId, targetAttributeId: same.id });
    return mapped.ok ? { ...mapped, value: { ...mapped.value, attributeId: same.id } } : mapped;
  }
  const siblings = index.attributesOf(entityId);
  const attribute: Attribute = {
    ...plainCopy(ctx, access.workspace.id, source, entityId),
    sort_order: nextSortOrder(siblings),
  };
  const { mapping, writes } = mappingWrites(ctx, access.workspace.id, source.id, attribute.id);
  const cardWrites: Write[] = [];
  if (card) {
    const got = current(state.card, access, card.canvasItemId, card.expectedVersion, "card");
    if (!got.ok) return fail(got.error);
    if (got.row.entity_id !== entityId) return fail(domainError("invalid", "That card shows another entity."));
    const patch: Partial<CanvasItem> = {};
    if (got.row.collapsed) patch.collapsed = false;
    if (got.row.row_filter !== "all" && got.row.row_filter !== "mapped") patch.row_filter = "all";
    if (Object.keys(patch).length) cardWrites.push({ kind: "update", table: "canvas_item", before: got.row, row: nextVersion(ctx, got.row, patch) });
  }
  const result = done(ctx, access, { mappingId: mapping.id, attributeId: attribute.id, toast: addedOnHeaderToast(attribute.name, entity.name, index.label(source.id)) }, [
    { kind: "insert", table: "attribute", row: attribute },
    ...writes,
    ...cardWrites,
  ]);
  // the active context labels the new attribute (as Add key); the step's name says both rows (Łukasz, 15c step 4)
  if (result.ok) {
    result.writeSet.mainTargets = [{ kind: "attribute", id: attribute.id }];
    result.writeSet.label = "Create attribute and its mapping";
  }
  return result;
}

/** A plain copy of a logical attribute in a dimensional entity: no key, nullable, no link to its original. */
function plainCopy(ctx: CommandContext, workspaceId: Uuid, a: Attribute, entityId: Uuid): Attribute {
  return {
    ...newRowColumns(ctx),
    workspace_id: workspaceId,
    entity_id: entityId,
    name: a.name,
    alias: null,
    sort_order: 0,
    data_type: a.data_type,
    custom_type: a.custom_type,
    type_length: a.type_length,
    type_precision: a.type_precision,
    type_scale: a.type_scale,
    is_primary_key: false,
    is_foreign_key: false,
    is_business_key: false,
    is_pii: a.is_pii,
    is_nullable: true,
    definition_html: a.definition_html,
    definition_text: a.definition_text,
    copied_from_attribute_id: null,
  };
}

// ---- the panel's edits ----

const ref = { mappingId: uuidSchema, expectedVersion: versionSchema };

/** The mapping the input names at its version, with its live inputs. */
function mappingAt(access: WorkspaceAccess, index: MappingIndex, state: MappingModel, mappingId: Uuid, expectedVersion: number) {
  const got = current(state.cubeMappings.find((m) => m.id === mappingId), access, mappingId, expectedVersion, "mapping");
  if (!got.ok) return got;
  return { ok: true as const, row: got.row, inputs: index.inputsOf(got.row.id) };
}

const addInputInput = z.object({ ...ref, attributeId: uuidSchema }).strict();
export type AddCubeMappingInputInput = z.input<typeof addInputInput>;

/**
 * "Add a logical attribute" in the mapping's panel: the attribute as the last input. A second input makes a direct copy
 * a transformation (X2, prototype l. 2980); its rule is written afterwards. D-51.
 */
export function addCubeMappingInput(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: MappingModel,
  input: unknown,
): CommandResult<{ version: number; toast: string; notice: string | null; becameTransform: boolean }> {
  const parsed = begin(access, "model.edit", addInputInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { mappingId, expectedVersion, attributeId } = parsed.data;
  const index = mappingIndex(state);
  const got = mappingAt(access, index, state, mappingId, expectedVersion);
  if (!got.ok) return fail(got.error);
  const { row: before, inputs } = got;
  const refused = levelRefusal(index, attributeId, null);
  if (refused) return fail(refused);
  if (inputs.some((i) => i.attribute_id === attributeId)) return fail(domainError("conflict", ALREADY_READS));
  const becameTransform = before.kind === "direct" && inputs.length >= 1;
  const content = cubeAfterContentChange(before);
  const row = nextVersion(ctx, before, { ...(becameTransform ? { kind: "transform" as const } : {}), ...content.patch });
  const added = newInput(ctx, access.workspace.id, before.id, attributeId, nextSortOrder(inputs));
  return done(ctx, access, { version: row.version, toast: readsTooToast(index.label(attributeId), becameTransform), notice: content.notice, becameTransform }, [
    { kind: "update", table: "cube_mapping", before, row },
    { kind: "insert", table: "cube_mapping_input", row: added },
  ]);
}

const removeInputInput = z.object({ ...ref, inputId: uuidSchema }).strict();
export type RemoveCubeMappingInputInput = z.input<typeof removeInputInput>;

/** × "Stop reading this attribute": not on the last input. A transformation stays one. D-51. */
export function removeCubeMappingInput(ctx: CommandContext, access: WorkspaceAccess, state: MappingModel, input: unknown): CommandResult<{ version: number; notice: string | null }> {
  const parsed = begin(access, "model.edit", removeInputInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { mappingId, expectedVersion, inputId } = parsed.data;
  const index = mappingIndex(state);
  const got = mappingAt(access, index, state, mappingId, expectedVersion);
  if (!got.ok) return fail(got.error);
  const { row: before, inputs } = got;
  const removed = inputs.find((i) => i.id === inputId);
  if (!removed) return fail(notFound("input"));
  if (inputs.length === 1) return fail(domainError("invalid", LAST_INPUT));
  const content = cubeAfterContentChange(before);
  const row = nextVersion(ctx, before, content.patch);
  return done(ctx, access, { version: row.version, notice: content.notice }, [
    { kind: "update", table: "cube_mapping", before, row },
    softDelete(ctx, "cube_mapping_input", removed),
  ]);
}

const ruleSchema = z
  .string()
  .max(20000, "This rule is too long.")
  .nullable()
  .transform((v) => (v?.trim() ? v.trim() : null));
const noteSchema = z
  .string()
  .max(20000, "This note is too long.")
  .nullable()
  .transform((v) => (v?.trim() ? v.trim() : null));
const updateInput = z.object({ ...ref, kind: z.enum(CUBE_MAPPING_KINDS).optional(), ruleExpression: ruleSchema.optional(), note: noteSchema.optional() }).strict();
export type UpdateCubeMappingInput = z.input<typeof updateInput>;

/**
 * "How the value is carried", the rule and the note. A direct copy with more than one input is refused. A change of the
 * kind or the rule is content (D-51); the note alone is not.
 */
export function updateCubeMapping(ctx: CommandContext, access: WorkspaceAccess, state: MappingModel, input: unknown): CommandResult<{ version: number; notice: string | null }> {
  const parsed = begin(access, "model.edit", updateInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { mappingId, expectedVersion, kind, ruleExpression, note } = parsed.data;
  const index = mappingIndex(state);
  const got = mappingAt(access, index, state, mappingId, expectedVersion);
  if (!got.ok) return fail(got.error);
  const { row: before, inputs } = got;
  const patch: Partial<CubeMapping> = {};
  if (kind !== undefined && kind !== before.kind) {
    if (kind === "direct" && inputs.length > 1) return fail(domainError("invalid", DIRECT_READS_ONE));
    patch.kind = kind;
  }
  if (ruleExpression !== undefined && ruleExpression !== before.rule_expression) patch.rule_expression = ruleExpression;
  if (note !== undefined && note !== before.note) patch.note = note;
  if (!Object.keys(patch).length) return fail(nothingToChange());
  const content = patch.kind !== undefined || patch.rule_expression !== undefined ? cubeAfterContentChange(before) : { patch: {}, notice: null };
  const row = nextVersion(ctx, before, { ...patch, ...content.patch });
  return done(ctx, access, { version: row.version, notice: content.notice }, [{ kind: "update", table: "cube_mapping", before, row }]);
}

const retargetInput = z.object({ ...ref, attributeId: uuidSchema }).strict();
export type RetargetCubeMappingInput = z.input<typeof retargetInput>;

/** "Target attribute": another dimensional attribute. Content (D-51, X5); onto the identical mapping is refused. */
export function retargetCubeMapping(ctx: CommandContext, access: WorkspaceAccess, state: MappingModel, input: unknown): CommandResult<{ version: number; toast: string; notice: string | null }> {
  const parsed = begin(access, "model.edit", retargetInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { mappingId, expectedVersion, attributeId } = parsed.data;
  const index = mappingIndex(state);
  const got = mappingAt(access, index, state, mappingId, expectedVersion);
  if (!got.ok) return fail(got.error);
  const { row: before, inputs } = got;
  if (attributeId === before.attribute_id) return fail(nothingToChange());
  const refused = levelRefusal(index, null, attributeId);
  if (refused) return fail(refused);
  if (identicalMapping(index, attributeId, inputs.map((i) => i.attribute_id), before.id)) return fail(domainError("conflict", MAPPING_EXISTS));
  const content = cubeAfterContentChange(before);
  const row = nextVersion(ctx, before, { attribute_id: attributeId, ...content.patch });
  return done(ctx, access, { version: row.version, toast: repointedToast(index.label(attributeId)), notice: content.notice }, [
    { kind: "update", table: "cube_mapping", before, row },
  ]);
}

const statusInput = z.object({ ...ref, status: z.enum(CUBE_MAPPING_STATUSES) }).strict();
export type SetCubeMappingStatusInput = z.input<typeof statusInput>;

/**
 * Draft, In review, Approved (O9): reviewers may do it (`mapping.set_status`), nothing else. With four-eyes on, the last
 * content editor (`lastContentEditor` with `CUBE_MAPPING_LOG`) cannot approve. Approving records who and when; leaving
 * Approved clears both (AD-06).
 */
export function setCubeMappingStatus(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: MappingModel & { contentAuthorId: Uuid },
  input: unknown,
): CommandResult<{ version: number }> {
  const parsed = begin(access, "mapping.set_status", statusInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { mappingId, expectedVersion, status } = parsed.data;
  const got = current(state.cubeMappings.find((m) => m.id === mappingId), access, mappingId, expectedVersion, "mapping");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  if (status === before.status) return fail(nothingToChange());
  if (status === "approved") {
    const refused = checkFourEyes(access.workspace, ctx.actorId, state.contentAuthorId);
    if (refused) return fail(refused);
  }
  const approved = status === "approved";
  const row = nextVersion(ctx, before, { status, approved_by: approved ? ctx.actorId : null, approved_at: approved ? ctx.now : null });
  return done(ctx, access, { version: row.version }, [{ kind: "update", table: "cube_mapping", before, row }]);
}

const deleteInput = z.object(ref).strict();
export type DeleteCubeMappingInput = z.input<typeof deleteInput>;

/** "Delete mapping", the Delete key and the line's menu: the mapping and its inputs, one undo step. */
export function deleteCubeMapping(ctx: CommandContext, access: WorkspaceAccess, state: MappingModel, input: unknown): CommandResult {
  const parsed = begin(access, "model.edit", deleteInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const index = mappingIndex(state);
  const got = mappingAt(access, index, state, parsed.data.mappingId, parsed.data.expectedVersion);
  if (!got.ok) return fail(got.error);
  const result = done(ctx, access, undefined, [...got.inputs.map((i) => softDelete(ctx, "cube_mapping_input", i)), softDelete(ctx, "cube_mapping", got.row)]);
  // the step is named by the mapping, not its first written row (an input)
  if (result.ok) result.writeSet.label = "Delete dimensional mapping";
  return result;
}

// ---- "Create dimension from this…" (B-2) ----

/**
 * The dialog's proposed name (Łukasz, 15c step 3; prototype `askDimFrom`): "Dim {entity}", or the first of
 * "Dim {entity} 2", 3… that no fact or dimension is called (`taken`, case ignored by the caller).
 */
export function proposedDimensionName(entity: string, taken: (name: string) => boolean): string {
  let name = `Dim ${entity}`;
  for (let n = 2; taken(name); n++) name = `Dim ${entity} ${n}`;
  return name;
}

/** The card's gap to the right of the original (the prototype's 80). */
export const DIMENSION_GAP = 80;

const dimensionFromInput = z
  .object({
    entityId: uuidSchema,
    /** The dialog's name: trimmed; empty takes "Dim {entity}", numbered within the level. */
    name: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((v) => (v ? v : undefined)),
    /** The ticked attributes of the entity, in any order (the copies keep the entity's). */
    attributeIds: z.array(uuidSchema).max(2000),
    /**
     * The canvas the dialog was opened on and the free spot the canvas found right of the original's card
     * (`besideSpots`); the card joins a frame as a placed card.
     */
    placement: z
      .object({
        canvasId: uuidSchema,
        x: z.number().finite(),
        y: z.number().finite(),
        height: z.number().finite().positive().max(1_000_000).optional(),
        frames: z.array(z.object({ frameId: uuidSchema, expectedVersion: versionSchema }).strict()).max(200).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type CreateDimensionFromInput = z.input<typeof dimensionFromInput>;

export interface CreateDimensionFromState extends MappingModel {
  /** The entity's concept, canvas and frames (`createEntity`'s; the new dimension is in the original's concept). */
  create: Omit<CreateEntityState, "entities"> & { entities: readonly Entity[] };
  /** The canvas's cards: the original's place. */
  items: readonly CanvasItem[];
  /** The original with its definition. */
  original: Entity | null;
}

/**
 * B-2, one change group and one undo step: a dimension in the original's concept (`createCubeEntity`, SCD type 1), its
 * surrogate key `{entity}_key` first (Integer, primary key, not nullable, "Surrogate key of the dimension."), a plain
 * copy of each ticked attribute in the original's order (as a drop on a header copies) and a direct Draft mapping from
 * each original; its definition "From {entity}: …" when the original has one; its card to the right of the original's
 * on the canvas, when the original is on it. Nothing changes in the original.
 */
export function createDimensionFrom(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: CreateDimensionFromState,
  input: unknown,
): CommandResult<{ entityId: Uuid; canvasItemId: Uuid | null; name: string; keyName: string; toast: string; warning: string | null }> {
  const parsed = begin(access, "model.edit", dimensionFromInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { entityId, name, attributeIds, placement } = parsed.data;
  const original = found(state.original, access, entityId, "entity");
  if (!original.ok) return fail(original.error);
  const e = original.row;
  if (!isLogical(e)) return fail(domainError("invalid", DIMENSION_FROM_LOGICAL_ONLY));
  const index = mappingIndex(state);
  const own = index.attributesOf(e.id);
  const ticked = new Set(attributeIds);
  if ([...ticked].some((id) => !own.some((a) => a.id === id))) return fail(notFound("attribute"));

  const item = placement ? state.items.find((i) => i.deleted_at === null && i.canvas_id === placement.canvasId && i.entity_id === e.id) : undefined;
  const made = createCubeEntity(
    ctx,
    access,
    state.create,
    "dimension",
    {
      conceptId: e.concept_id,
      ...(name ? { name } : {}),
      ...(item && placement
        ? { placement: { canvasId: placement.canvasId, x: placement.x, y: placement.y, ...(placement.height ? { height: placement.height } : {}), frames: placement.frames } }
        : {}),
    },
    `Dim ${e.name}`,
  );
  if (!made.ok) return made;
  const dimensionId = made.value.entityId;
  const writes = made.writeSet.writes.map((w): Write => {
    if (w.kind !== "insert" || w.table !== "entity" || !e.definition_html) return w;
    const { html, text } = sanitizeRich(`${plainTextPair(`From ${e.name}:`).html ?? ""}${e.definition_html}`);
    return { ...w, row: { ...w.row, definition_html: html, definition_text: text } };
  });
  const dimension = writes.find((w) => w.kind === "insert" && w.table === "entity");
  const dimensionName = dimension?.kind === "insert" && dimension.table === "entity" ? dimension.row.name : "";

  const key: Attribute = {
    ...newRowColumns(ctx),
    workspace_id: access.workspace.id,
    entity_id: dimensionId,
    name: `${snakeCase(e.name)}_key`,
    alias: null,
    sort_order: 0,
    data_type: "integer",
    custom_type: null,
    type_length: null,
    type_precision: null,
    type_scale: null,
    is_primary_key: true,
    is_foreign_key: false,
    is_business_key: false,
    is_pii: false,
    is_nullable: false,
    ...plainTextAsDefinition(SURROGATE_KEY_DESCRIPTION),
    copied_from_attribute_id: null,
  };
  writes.push({ kind: "insert", table: "attribute", row: key });
  const copies = own.filter((a) => ticked.has(a.id));
  copies.forEach((a, n) => {
    const copy: Attribute = { ...plainCopy(ctx, access.workspace.id, a, dimensionId), sort_order: n + 1 };
    writes.push({ kind: "insert", table: "attribute", row: copy }, ...mappingWrites(ctx, access.workspace.id, a.id, copy.id).writes);
  });
  const result = done(
    ctx,
    access,
    {
      entityId: dimensionId,
      canvasItemId: made.value.canvasItemId,
      name: dimensionName,
      keyName: key.name,
      toast: createdDimensionToast(dimensionName, copies.length, e.name, key.name),
      warning: made.value.warning,
    },
    writes,
  );
  // the step's name says what was made (Łukasz, 15c step 5), not createEntity's "Create entity"
  if (result.ok) result.writeSet.label = "Create dimension";
  return result;
}

const plainTextAsDefinition = (text: string) => {
  const { html, text: plain } = plainTextPair(text);
  return { definition_html: html, definition_text: plain };
};

// ---- the derived reads ----

/** One row of a panel's list of dimensional mappings (prototype `cubeAttrSection`): the other end, the status, ƒ. */
export interface FeedRow {
  mappingId: Uuid;
  status: CubeMapping["status"];
  transform: boolean;
  /** "Fact Sales.quantity" (what a logical attribute feeds) or "Order Line.unit_price + Order Line.discount" (what feeds). */
  label: string;
}

/** "Feeds facts and dimensions": what a logical attribute feeds, one row per mapping. */
export const feedsOf = (index: MappingIndex, attributeId: Uuid): FeedRow[] =>
  index.mappingsFrom(attributeId).map((m) => ({ mappingId: m.id, status: m.status, transform: m.kind === "transform", label: index.label(m.attribute_id) }));

/** "Comes from the logical model": what feeds a dimensional attribute, one row per mapping, its inputs joined by " + ". */
export const fedFrom = (index: MappingIndex, attributeId: Uuid): FeedRow[] =>
  index.mappingsTo(attributeId).map((m) => ({
    mappingId: m.id,
    status: m.status,
    transform: m.kind === "transform",
    label: index.inputsOf(m.id).map((i) => index.label(i.attribute_id)).join(" + "),
  }));

/**
 * The cards' feeds (P17, C12, X4): each dimensional attribute with at least one dimensional mapping, any status (the
 * prototype's bar), and how many. A dimensional card's bar, row states and Mapped / Not mapped filter read it.
 */
export function rowFeeds(index: MappingIndex, attributes: readonly { id: Uuid; deleted_at: string | null }[]): Record<Uuid, number> {
  const out: Record<Uuid, number> = {};
  for (const a of attributes) {
    if (a.deleted_at !== null || index.levelOf(a.id) !== "dimensional") continue;
    const n = index.mappingsTo(a.id).length;
    if (n) out[a.id] = n;
  }
  return out;
}

/** The Overview's "{n} of {m} fed" (P17): the dimensional attributes of these entities, and those with a feed. */
export function fedCount(index: MappingIndex, entityIds: readonly Uuid[]): { fed: number; total: number } {
  let fed = 0;
  let total = 0;
  for (const id of entityIds) {
    const e = index.entity(id);
    if (!e || !isDimensional(e)) continue;
    for (const a of index.attributesOf(id)) {
      total++;
      if (index.mappingsTo(a.id).length) fed++;
    }
  }
  return { fed, total };
}

const counted = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const unique = <T>(list: readonly T[]) => [...new Set(list)];

/** The mappings a delete takes along: those onto a dimensional attribute and those reading a logical one (Q-5). */
function mappingsGoingWith(index: MappingIndex, attributeIds: readonly Uuid[]): CubeMapping[] {
  return unique(attributeIds.flatMap((id) => (index.levelOf(id) === "dimensional" ? index.mappingsTo(id) : index.mappingsFrom(id))));
}

/** The facts and dimensions that lose a feed: the targets' entities, each once, by name. */
function losingFeed(index: MappingIndex, mappings: readonly CubeMapping[]): string[] {
  return unique(mappings.map((m) => index.attribute(m.attribute_id)?.entity_id).filter((id): id is Uuid => !!id))
    .map((id) => index.entity(id)?.name ?? "?")
    .sort((a, b) => a.localeCompare(b));
}

export const loseFeed = (names: readonly string[]) => (names.length > 1 ? "lose their feed from the logical model" : "loses its feed from the logical model");

/**
 * The dimensional mappings' rows in an entity's or an attribute's delete preview (X-2, X-4; prototype `cubeDependents`):
 * "{n} dimensional mappings – deleted, {k} of them approved"; for a logical one also "{facts and dimensions} – lose
 * their feed from the logical model".
 */
export function mappingDependents(index: MappingIndex, of: { entityId: Uuid } | { attributeId: Uuid }): [string, string][] {
  const ids = "entityId" in of ? index.attributesOf(of.entityId).map((a) => a.id) : [of.attributeId];
  const mappings = mappingsGoingWith(index, ids);
  if (!mappings.length) return [];
  const approved = mappings.filter((m) => m.status === "approved").length;
  const rows: [string, string][] = [[counted(mappings.length, "dimensional mapping"), `deleted${approved ? `, ${approved} of them approved` : ""}`]];
  const logical = "entityId" in of ? index.entity(of.entityId) && !isDimensional(index.entity(of.entityId)!) : index.levelOf(of.attributeId) === "logical";
  if (logical) {
    const names = losingFeed(index, mappings);
    rows.push([names.join(", "), loseFeed(names)]);
  }
  return rows;
}

/**
 * An attribute's second click (X-3, R4): "{n} dimensional mappings" among what goes with it and, for a logical one,
 * "{facts and dimensions} lose their feed from the logical model". Only attributes with dimensional mappings.
 */
export function mappingAttributeDeletes(index: MappingIndex, attributes: readonly { id: Uuid; deleted_at: string | null }[]): Record<Uuid, { also: string[]; then: string[]; toast: string[] }> {
  const out: Record<Uuid, { also: string[]; then: string[]; toast: string[] }> = {};
  for (const a of attributes) {
    if (a.deleted_at !== null) continue;
    const mappings = mappingsGoingWith(index, [a.id]);
    if (!mappings.length) continue;
    const names = index.levelOf(a.id) === "logical" ? losingFeed(index, mappings) : [];
    const n = counted(mappings.length, "dimensional mapping");
    // the delete's toast counts them beside InfoMapper's mappings (P10)
    out[a.id] = { also: [n], then: names.length ? [`${names.join(", ")} ${loseFeed(names)}`] : [], toast: [n] };
  }
  return out;
}
