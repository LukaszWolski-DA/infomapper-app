// Attribute commands: “Add attribute” in the entity panel, edit in the attribute panel, delete with its mappings;
// slice 1b: a new attribute from a column dropped on an entity's header, and the attribute order (D-36); slice 10c
// (D-63): paste a copy of an attribute, its followed fields read-only while it is a copy, and “Stop following”.

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound, type DomainError } from "../errors";
import type { Uuid } from "../ids";
import { indexOf } from "../model/classifications";
import { attributePath, changesFollowed, COPIED_GONE, followOriginals, FOLLOWS_LOST_REFUSAL, FOLLOWS_REFUSAL } from "../model/copies";
import { plainTextPair } from "../model/plain-text";
import { sanitizeRich } from "../model/rich-text";
import { attributeNamedAfter } from "../model/mapping-choice";
import { logicalTypeOf } from "../model/type-check";
import type { WorkspaceAccess } from "../permissions";
import { LOGICAL_TYPES, type Attribute, type AttributeType, type Classification, type ClassificationLink, type Entity, type LabelLink, type LostOriginal, type Mapping, type MappingInput, type RequirementLink, type SourceColumn } from "../types";
import { nameSchema, optionalTextSchema, uuidSchema, versionSchema } from "../validation";
import { linksOnItems, softDeleteLinks } from "./label";
import { softDeleteRequirementLinks } from "./requirement";
import { createMapping } from "./mapping";
import { begin, current, done, found, isLive, nextSortOrder, nothingToChange, richTextSchema, softDelete } from "./shared";

const DEFAULT_ATTRIBUTE_NAME = "new_attribute";

// ---- type (AD-27) ----

const positiveInt = z.number().int().positive().max(1_000_000);
const typeInput = z
  .object({
    dataType: z.enum(LOGICAL_TYPES),
    customType: z.string().trim().max(100).nullable().optional(),
    length: positiveInt.nullable().optional(),
    precision: z.number().int().min(1).max(100).nullable().optional(),
    scale: z.number().int().min(0).max(100).nullable().optional(),
  })
  .strict();

/**
 * A change of an attribute's type (slice 9, F1): only what changed. A part that is absent keeps the stored one, `null`
 * clears it, a value sets it. A queued save then never sends back an older parameter it did not change.
 */
const typePatchInput = typeInput.extend({ dataType: z.enum(LOGICAL_TYPES).optional() });
export type AttributeTypePatch = z.input<typeof typePatchInput>;

/** The type after a patch: the stored parts, with the patch's on top (before `attributeType` clears what the type lacks). */
export function patchedType(before: AttributeType, patch: z.output<typeof typePatchInput>): z.output<typeof typeInput> {
  const pick = <T,>(value: T | undefined, stored: T): T => (value === undefined ? stored : value);
  return {
    dataType: patch.dataType ?? before.data_type,
    customType: pick(patch.customType, before.custom_type),
    length: pick(patch.length, before.type_length),
    precision: pick(patch.precision, before.type_precision),
    scale: pick(patch.scale, before.type_scale),
  };
}

/**
 * The stored type: only the parameters the logical type has are kept (length for string, precision and scale for
 * decimal, the name for custom); the others are cleared, so switching types never leaves stale parameters.
 */
export function attributeType(input: z.output<typeof typeInput>): { ok: true; type: AttributeType } | { ok: false; error: DomainError } {
  const type: AttributeType = { data_type: input.dataType, custom_type: null, type_length: null, type_precision: null, type_scale: null };
  switch (input.dataType) {
    case "string":
      type.type_length = input.length ?? null;
      break;
    case "decimal":
      type.type_precision = input.precision ?? null;
      type.type_scale = input.scale ?? null;
      if (type.type_scale !== null && type.type_precision === null) {
        return { ok: false, error: domainError("invalid", "A scale needs a precision.", { precision: "Enter the precision." }) };
      }
      if (type.type_scale !== null && type.type_scale > type.type_precision!) {
        return { ok: false, error: domainError("invalid", "The scale cannot be larger than the precision.", { scale: "At most the precision." }) };
      }
      break;
    case "custom":
      if (!input.customType) return { ok: false, error: domainError("invalid", "Name the custom type, e.g. uuid.", { customType: "Enter a name." }) };
      type.custom_type = input.customType;
      break;
  }
  return { ok: true, type };
}

// ---- add ----

const addAttributeInput = z.object({ entityId: uuidSchema, name: nameSchema.optional() }).strict();
export type AddAttributeInput = z.input<typeof addAttributeInput>;

/** Adds an attribute at the end of the entity: a nullable string, ready to be renamed. */
export function addAttribute(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { entity: Entity | null; attributes: readonly Attribute[] },
  input: unknown,
): CommandResult<{ attributeId: Uuid }> {
  const parsed = begin(access, "model.edit", addAttributeInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { entityId, name } = parsed.data;
  const workspaceId = access.workspace.id;
  if (!isLive(state.entity, workspaceId) || state.entity.id !== entityId) return fail(notFound("entity"));

  const attribute: Attribute = {
    ...newRowColumns(ctx),
    workspace_id: workspaceId,
    entity_id: entityId,
    name: name ?? DEFAULT_ATTRIBUTE_NAME,
    alias: null,
    sort_order: nextSortOrder(state.attributes.filter((a) => isLive(a, workspaceId) && a.entity_id === entityId)),
    data_type: "string",
    custom_type: null,
    type_length: null,
    type_precision: null,
    type_scale: null,
    is_primary_key: false,
    is_foreign_key: false,
    is_business_key: false,
    is_pii: false,
    is_nullable: true,
    definition_html: null,
    definition_text: null,
    copied_from_attribute_id: null,
  };
  return done(ctx, access, { attributeId: attribute.id }, [{ kind: "insert", table: "attribute", row: attribute }]);
}

// ---- edit ----

const updateAttributeInput = z
  .object({
    attributeId: uuidSchema,
    expectedVersion: versionSchema,
    name: nameSchema.optional(),
    /** Another name, shown on canvases that ask for it (slice 11, D-64): trimmed, empty clears it; not followed by copies. */
    alias: optionalTextSchema.optional(),
    type: typePatchInput.optional(),
    isPrimaryKey: z.boolean().optional(),
    isForeignKey: z.boolean().optional(),
    isBusinessKey: z.boolean().optional(),
    isPii: z.boolean().optional(),
    isNullable: z.boolean().optional(),
    definition: richTextSchema.optional(),
    /** Detaches a copy from its original, live or deleted (slice 10c, item 10). */
    stopFollowing: z.literal(true).optional(),
  })
  .strict();
export type UpdateAttributeInput = z.input<typeof updateAttributeInput>;

const FLAGS = [
  ["isPrimaryKey", "is_primary_key"],
  ["isForeignKey", "is_foreign_key"],
  ["isBusinessKey", "is_business_key"],
  ["isPii", "is_pii"],
  ["isNullable", "is_nullable"],
] as const;

export interface UpdateAttributeState {
  attribute: Attribute | null;
  /** The workspace's live attributes: the copies a change of a followed field reaches (slice 10c). */
  attributes?: readonly Attribute[];
  /** The workspace's live entities and the deleted originals of live copies: the names in a refusal (F5). */
  entities?: readonly Entity[];
  lostOriginals?: readonly LostOriginal[];
}

/**
 * Name, alias (slice 11), type with parameters, flags (PK, FK, BK, PII, nullable) and definition. Slice 10c: a change of
 * a followed field (type, parameters, Personal data) reaches every live copy below the attribute in the same change
 * group (`followOriginals`); a copy's own followed fields are refused while it has a link, live original or deleted (F2,
 * F5); `stopFollowing` clears the link. An alias is a copy's own (P10).
 */
export function updateAttribute(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: UpdateAttributeState,
  input: unknown,
): CommandResult<{ attribute: Attribute }> {
  const parsed = begin(access, "model.edit", updateAttributeInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const data = parsed.data;
  const got = current(state.attribute, access, data.attributeId, data.expectedVersion, "attribute");
  if (!got.ok) return fail(got.error);
  const before = got.row;

  const patch: Partial<Attribute> = {};
  if (data.name !== undefined && data.name !== before.name) patch.name = data.name;
  if (data.alias !== undefined && data.alias !== before.alias) patch.alias = data.alias;
  if (data.type !== undefined) {
    const t = attributeType(patchedType(before, data.type));
    if (!t.ok) return fail(t.error);
    for (const key of ["data_type", "custom_type", "type_length", "type_precision", "type_scale"] as const) {
      if (t.type[key] !== before[key]) Object.assign(patch, { [key]: t.type[key] });
    }
  }
  for (const [field, column] of FLAGS) {
    const value = data[field];
    if (value !== undefined && value !== before[column]) patch[column] = value;
  }
  if (data.definition !== undefined) {
    const { html, text } = sanitizeRich(data.definition);
    if (html !== before.definition_html) Object.assign(patch, { definition_html: html, definition_text: text });
  }
  if (data.stopFollowing && before.copied_from_attribute_id !== null) patch.copied_from_attribute_id = null;
  if (Object.keys(patch).length === 0) return fail(nothingToChange());
  const link = patch.copied_from_attribute_id === undefined ? before.copied_from_attribute_id : null;
  if (link !== null && changesFollowed(patch)) return fail(followsRefusal(state, link));

  const row = nextVersion(ctx, before, patch);
  const followed = followOriginals(ctx, state.attributes ?? [before], [{ kind: "update", table: "attribute", before, row }]);
  const result = done(ctx, access, { attribute: row }, followed.writes);
  // the working context labels the attribute changed, not the copies that follow it (F3)
  if (result.ok && followed.followers.length) result.writeSet.followers = followed.followers;
  return result;
}

/** The refusal of a followed field on a copy: its original named, live or deleted (F5). */
function followsRefusal(state: UpdateAttributeState, originalId: Uuid): DomainError {
  const live = state.attributes?.some((a) => a.id === originalId && a.deleted_at === null);
  const path = attributePath(originalId, state.attributes ?? [], state.entities ?? [], state.lostOriginals) ?? "its original";
  return domainError("invalid", live ? FOLLOWS_REFUSAL(path) : FOLLOWS_LOST_REFUSAL(path));
}

// ---- paste a copy (slice 10c, D-63) ----

const pasteInput = z.object({ entityId: uuidSchema, attributeId: uuidSchema }).strict();
export type PasteAttributeInput = z.input<typeof pasteInput>;

export interface PasteAttributeState {
  /** The entity it goes into. */
  entity: Entity | null;
  /** The attribute that was copied; null or deleted when it is gone. */
  original: Attribute | null;
  /** The workspace's live attributes. */
  attributes: readonly Attribute[];
}

/**
 * “Paste attribute” (items 4, 5): a new attribute last on the entity, its own entity included, with the original's
 * name, alias (slice 11, P10), definition and nullable (then its own), its type, parameters and Personal data
 * (followed), no keys but a foreign key when the original is a primary key (P8), and a link to the attribute that was
 * copied, a copy itself or not. No mappings, requirement links or labels (P3). `nameTaken`: the entity already has an
 * attribute of that name, case ignored (F12), for the toast.
 */
export function pasteAttribute(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: PasteAttributeState,
  input: unknown,
): CommandResult<{ attributeId: Uuid; nameTaken: boolean }> {
  const parsed = begin(access, "model.edit", pasteInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { entityId, attributeId } = parsed.data;
  const workspaceId = access.workspace.id;
  const entity = found(state.entity, access, entityId, "entity");
  if (!entity.ok) return fail(entity.error);
  const original = state.original;
  if (!isLive(original, workspaceId) || original.id !== attributeId) return fail(domainError("not_found", COPIED_GONE));

  const siblings = state.attributes.filter((a) => isLive(a, workspaceId) && a.entity_id === entityId);
  const attribute: Attribute = {
    ...newRowColumns(ctx),
    workspace_id: workspaceId,
    entity_id: entityId,
    name: original.name,
    alias: original.alias,
    sort_order: nextSortOrder(siblings),
    data_type: original.data_type,
    custom_type: original.custom_type,
    type_length: original.type_length,
    type_precision: original.type_precision,
    type_scale: original.type_scale,
    is_primary_key: false,
    is_foreign_key: original.is_primary_key,
    is_business_key: false,
    is_pii: original.is_pii,
    is_nullable: original.is_nullable,
    definition_html: original.definition_html,
    definition_text: original.definition_text,
    copied_from_attribute_id: original.id,
  };
  const nameTaken = siblings.some((a) => a.name.toLowerCase() === original.name.toLowerCase());
  return done(ctx, access, { attributeId: attribute.id, nameTaken }, [{ kind: "insert", table: "attribute", row: attribute }]);
}

// ---- delete ----

const deleteAttributeInput = z.object({ attributeId: uuidSchema, expectedVersion: versionSchema }).strict();
export type DeleteAttributeInput = z.input<typeof deleteAttributeInput>;

export interface DeleteAttributeState {
  attribute: Attribute | null;
  /** Live mappings of the attribute and their live inputs. */
  mappings: readonly Mapping[];
  mappingInputs: readonly MappingInput[];
  /** The workspace's label links: those on the attribute and its mappings go with them (slice 3a). */
  labelLinks?: readonly LabelLink[];
  /** The workspace's requirement links: those on the attribute and its mappings go with them (slice 4a). */
  requirementLinks?: readonly RequirementLink[];
}

/**
 * Deletes an attribute together with its mappings and their inputs and the label and requirement links on them, in one
 * change group.
 */
export function deleteAttribute(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: DeleteAttributeState,
  input: unknown,
): CommandResult<{ mappings: number }> {
  const parsed = begin(access, "model.edit", deleteAttributeInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.attribute, access, parsed.data.attributeId, parsed.data.expectedVersion, "attribute");
  if (!got.ok) return fail(got.error);
  const attribute = got.row;
  const workspaceId = access.workspace.id;
  const mappings = state.mappings.filter((m) => isLive(m, workspaceId) && m.attribute_id === attribute.id);
  const mappingIds = new Set(mappings.map((m) => m.id));
  const inputs = state.mappingInputs.filter((i) => isLive(i, workspaceId) && mappingIds.has(i.mapping_id));

  const writes: Write[] = [
    ...inputs.map((r) => softDelete(ctx, "mapping_input", r)),
    ...mappings.map((r) => softDelete(ctx, "mapping", r)),
    softDelete(ctx, "attribute", attribute),
    ...softDeleteLinks(ctx, linksOnItems(state.labelLinks, [{ kind: "attribute", id: attribute.id }, ...mappings.map((m) => ({ kind: "mapping" as const, id: m.id }))])),
    ...softDeleteRequirementLinks(ctx, state.requirementLinks, [{ kind: "attribute", id: attribute.id }, ...mappings.map((m) => ({ kind: "mapping" as const, id: m.id }))]),
  ];
  return done(ctx, access, { mappings: mappings.length }, writes);
}

// ---- new attribute from a column (slice 1b) ----

const fromColumnInput = z.object({ entityId: uuidSchema, sourceColumnId: uuidSchema }).strict();
export type CreateAttributeFromColumnInput = z.input<typeof fromColumnInput>;

export interface CreateAttributeFromColumnState {
  entity: Entity | null;
  /** The entity's attributes. */
  attributes: readonly Attribute[];
  column: SourceColumn | null;
  /** Live mappings of the entity's attributes and their inputs, to refuse the same mapping twice. */
  mappings: readonly Mapping[];
  mappingInputs: readonly MappingInput[];
  /** The classification list and links (slice 7c): the column's Personal data (`PII`). */
  classifications?: readonly Classification[];
  classificationLinks?: readonly ClassificationLink[];
}

/**
 * A column dropped on an entity card's header: a new attribute at the end, named after the column, with the matching
 * logical type and parameters (`logicalTypeOf`), the column's Personal data (the `PII` classification, slice 7c),
 * nullability and comment (the source's; the modeller's note is not copied, slice 7c answer F8) as in the prototype,
 * and a direct mapping from the column, in one change group. If the entity already has an attribute of that name
 * (ignoring case), the column is mapped to it instead, as the prototype does.
 */
export function createAttributeFromColumn(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: CreateAttributeFromColumnState,
  input: unknown,
): CommandResult<{ attributeId: Uuid; mappingId: Uuid; createdAttribute: boolean }> {
  const parsed = begin(access, "model.edit", fromColumnInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { entityId, sourceColumnId } = parsed.data;
  const workspaceId = access.workspace.id;
  const entity = found(state.entity, access, entityId, "entity");
  if (!entity.ok) return fail(entity.error);
  const column = found(state.column, access, sourceColumnId, "source column");
  if (!column.ok) return fail(column.error);
  const siblings = state.attributes.filter((a) => isLive(a, workspaceId) && a.entity_id === entityId);

  const existing = attributeNamedAfter(siblings, column.row);
  if (existing) {
    const r = createMapping(ctx, access, { attribute: existing, column: column.row, mappings: state.mappings, mappingInputs: state.mappingInputs }, {
      attributeId: existing.id,
      sourceColumnId,
    });
    if (!r.ok) return r;
    return { ...r, value: { attributeId: existing.id, mappingId: r.value.mappingId, createdAttribute: false } };
  }

  const { html, text } = plainTextPair(column.row.comment);
  const attribute: Attribute = {
    ...newRowColumns(ctx),
    workspace_id: workspaceId,
    entity_id: entityId,
    name: column.row.name,
    alias: null,
    sort_order: nextSortOrder(siblings),
    ...logicalTypeOf(column.row),
    is_primary_key: false,
    is_foreign_key: false,
    is_business_key: false,
    is_pii: indexOf(state).has(column.row.id, "PII"),
    is_nullable: column.row.is_nullable,
    definition_html: html,
    definition_text: text,
    copied_from_attribute_id: null,
  };
  const r = createMapping(ctx, access, { attribute, column: column.row, mappings: [], mappingInputs: [] }, { attributeId: attribute.id, sourceColumnId });
  if (!r.ok) return r;
  return done(ctx, access, { attributeId: attribute.id, mappingId: r.value.mappingId, createdAttribute: true }, [
    { kind: "insert", table: "attribute", row: attribute },
    ...r.writeSet.writes,
  ]);
}

// ---- order (D-36) ----

const reorderInput = z
  .object({ attributeId: uuidSchema, expectedVersion: versionSchema, position: z.number().int().min(0).max(100_000) })
  .strict();
export type ReorderAttributeInput = z.input<typeof reorderInput>;

/**
 * Moves an attribute to a position (0 = top) among its entity's attributes; a position past the end means the
 * bottom. The order belongs to the model, so every canvas shows it. The entity's attributes are renumbered 0..n-1
 * in one change group; only rows whose number changes are written.
 */
export function reorderAttribute(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { attribute: Attribute | null; attributes: readonly Attribute[] },
  input: unknown,
): CommandResult<{ position: number }> {
  const parsed = begin(access, "model.edit", reorderInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { attributeId, expectedVersion, position } = parsed.data;
  const got = current(state.attribute, access, attributeId, expectedVersion, "attribute");
  if (!got.ok) return fail(got.error);
  const moved = got.row;
  const list = state.attributes
    .filter((a) => isLive(a, access.workspace.id) && a.entity_id === moved.entity_id && a.id !== moved.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const before = [...list, moved].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const to = Math.min(position, list.length);
  if (before.findIndex((a) => a.id === moved.id) === to) return fail(nothingToChange());
  list.splice(to, 0, moved);

  const writes: Write[] = [];
  list.forEach((a, index) => {
    if (a.sort_order !== index) writes.push({ kind: "update", table: "attribute", before: a, row: nextVersion(ctx, a, { sort_order: index }) });
  });
  const result = done(ctx, access, { position: to }, writes);
  // the active context labels the moved attribute only, not those renumbered around it (slice 3b, Q2)
  if (result.ok) result.writeSet.mainTargets = [{ kind: "attribute", id: moved.id }];
  return result;
}
