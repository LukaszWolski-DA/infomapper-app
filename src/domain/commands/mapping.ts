// Mapping commands (AD-26, D-49): create from the attribute panel (“Add a source column”), edit kind, rule and note,
// the Inputs section (add, remove, order), status with four-eyes (AD-06), delete.
// Input changes also bump the mapping's version, so one expectedVersion guards the whole mapping.

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound } from "../errors";
import type { Uuid } from "../ids";
import { checkFourEyes, checkMappingShape } from "../model/mapping-rules";
import { plainTextPair } from "../model/plain-text";
import type { WorkspaceAccess } from "../permissions";
import { MAPPING_KINDS, MAPPING_STATUSES, type Attribute, type Mapping, type MappingInput, type SourceColumn } from "../types";
import { uuidSchema, versionSchema } from "../validation";
import { begin, current, done, found, isLive, nextSortOrder, nothingToChange, plainTextSchema, softDelete } from "./shared";

const ruleSchema = z
  .string()
  .max(20000, "This rule is too long.")
  .nullable()
  .transform((v) => (v?.trim() ? v.trim() : null));

const ref = { mappingId: uuidSchema, expectedVersion: versionSchema };

/** The mapping's live inputs, in their order. */
function liveInputs(access: WorkspaceAccess, mapping: Mapping, inputs: readonly MappingInput[]): MappingInput[] {
  return inputs
    .filter((i) => isLive(i, access.workspace.id) && i.mapping_id === mapping.id)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export interface MappingState {
  mapping: Mapping | null;
  /** The mapping's inputs (others are ignored). */
  inputs: readonly MappingInput[];
}

// ---- create ----

const createMappingInput = z.object({ attributeId: uuidSchema, sourceColumnId: uuidSchema }).strict();
export type CreateMappingInput = z.input<typeof createMappingInput>;

export interface CreateMappingState {
  attribute: Attribute | null;
  column: SourceColumn | null;
  /** Live mappings of the attribute and their inputs, to refuse the same mapping twice. */
  mappings: readonly Mapping[];
  mappingInputs: readonly MappingInput[];
}

/** A direct draft mapping from one column to the attribute. An attribute can have several mappings (alternative sources). */
export function createMapping(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: CreateMappingState,
  input: unknown,
): CommandResult<{ mappingId: Uuid }> {
  const parsed = begin(access, "model.edit", createMappingInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { attributeId, sourceColumnId } = parsed.data;
  const attribute = found(state.attribute, access, attributeId, "attribute");
  if (!attribute.ok) return fail(attribute.error);
  const column = found(state.column, access, sourceColumnId, "source column");
  if (!column.ok) return fail(column.error);

  const workspaceId = access.workspace.id;
  const mappingIds = new Set(state.mappings.filter((m) => isLive(m, workspaceId) && m.attribute_id === attributeId).map((m) => m.id));
  const exists = state.mappingInputs.some((i) => isLive(i, workspaceId) && mappingIds.has(i.mapping_id) && i.source_column_id === sourceColumnId);
  if (exists) return fail(domainError("conflict", "That mapping already exists."));

  const mapping: Mapping = {
    ...newRowColumns(ctx),
    workspace_id: workspaceId,
    attribute_id: attributeId,
    kind: "direct",
    rule_expression: null,
    status: "draft",
    note_html: null,
    note_text: null,
    approved_by: null,
    approved_at: null,
  };
  const first: MappingInput = {
    ...newRowColumns(ctx),
    workspace_id: workspaceId,
    mapping_id: mapping.id,
    source_column_id: sourceColumnId,
    sort_order: 0,
  };
  return done(ctx, access, { mappingId: mapping.id }, [
    { kind: "insert", table: "mapping", row: mapping },
    { kind: "insert", table: "mapping_input", row: first },
  ]);
}

// ---- kind, rule, note ----

const updateMappingInput = z
  .object({ ...ref, kind: z.enum(MAPPING_KINDS).optional(), ruleExpression: ruleSchema.optional(), note: plainTextSchema.optional() })
  .strict();
export type UpdateMappingInput = z.input<typeof updateMappingInput>;

/** Kind, rule and note. A transform needs a rule; a direct copy reads exactly one column. */
export function updateMapping(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: MappingState,
  input: unknown,
): CommandResult<{ mapping: Mapping }> {
  const parsed = begin(access, "model.edit", updateMappingInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { mappingId, expectedVersion, kind, ruleExpression, note } = parsed.data;
  const got = current(state.mapping, access, mappingId, expectedVersion, "mapping");
  if (!got.ok) return fail(got.error);
  const before = got.row;

  const patch: Partial<Mapping> = {};
  if (kind !== undefined && kind !== before.kind) patch.kind = kind;
  if (ruleExpression !== undefined && ruleExpression !== before.rule_expression) patch.rule_expression = ruleExpression;
  if (note !== undefined) {
    const { html, text } = plainTextPair(note);
    if (text !== before.note_text) Object.assign(patch, { note_html: html, note_text: text });
  }
  if (Object.keys(patch).length === 0) return fail(nothingToChange());

  const row = nextVersion(ctx, before, patch);
  const shape = checkMappingShape(row.kind, row.rule_expression, liveInputs(access, before, state.inputs).length);
  if (shape) return fail(shape);
  return done(ctx, access, { mapping: row }, [{ kind: "update", table: "mapping", before, row }]);
}

// ---- inputs (D-49) ----

const addInputInput = z.object({ ...ref, sourceColumnId: uuidSchema, ruleExpression: ruleSchema.optional() }).strict();
export type AddMappingInputInput = z.input<typeof addInputInput>;

/**
 * Adds a column as the last input. A second input turns the mapping into a transform, which is saved only with a
 * rule: the rule comes in the same call, or the mapping already has one.
 */
export function addMappingInput(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: MappingState & { column: SourceColumn | null },
  input: unknown,
): CommandResult<{ mapping: Mapping; mappingInputId: Uuid }> {
  const parsed = begin(access, "model.edit", addInputInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { mappingId, expectedVersion, sourceColumnId, ruleExpression } = parsed.data;
  const got = current(state.mapping, access, mappingId, expectedVersion, "mapping");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  const column = found(state.column, access, sourceColumnId, "source column");
  if (!column.ok) return fail(column.error);
  const inputs = liveInputs(access, before, state.inputs);
  if (inputs.some((i) => i.source_column_id === sourceColumnId)) {
    return fail(domainError("conflict", "This column is already an input of the mapping."));
  }

  const row = nextVersion(ctx, before, {
    kind: inputs.length >= 1 ? "transform" : before.kind,
    rule_expression: ruleExpression !== undefined ? ruleExpression : before.rule_expression,
  });
  const shape = checkMappingShape(row.kind, row.rule_expression, inputs.length + 1);
  if (shape) return fail(shape);

  const added: MappingInput = {
    ...newRowColumns(ctx),
    workspace_id: access.workspace.id,
    mapping_id: before.id,
    source_column_id: sourceColumnId,
    sort_order: nextSortOrder(inputs),
  };
  return done(ctx, access, { mapping: row, mappingInputId: added.id }, [
    { kind: "update", table: "mapping", before, row },
    { kind: "insert", table: "mapping_input", row: added },
  ]);
}

const removeInputInput = z.object({ ...ref, mappingInputId: uuidSchema }).strict();
export type RemoveMappingInputInput = z.input<typeof removeInputInput>;

/** Removes an input. The last input cannot go (delete the mapping instead); a transform stays a transform. */
export function removeMappingInput(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: MappingState,
  input: unknown,
): CommandResult<{ mapping: Mapping }> {
  const parsed = begin(access, "model.edit", removeInputInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { mappingId, expectedVersion, mappingInputId } = parsed.data;
  const got = current(state.mapping, access, mappingId, expectedVersion, "mapping");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  const inputs = liveInputs(access, before, state.inputs);
  const removed = inputs.find((i) => i.id === mappingInputId);
  if (!removed) return fail(notFound("input"));
  const shape = checkMappingShape(before.kind, before.rule_expression, inputs.length - 1);
  if (shape) return fail(shape);

  const row = nextVersion(ctx, before, {});
  return done(ctx, access, { mapping: row }, [
    { kind: "update", table: "mapping", before, row },
    softDelete(ctx, "mapping_input", removed),
  ]);
}

const reorderInputsInput = z.object({ ...ref, mappingInputIds: z.array(uuidSchema).min(1) }).strict();
export type ReorderMappingInputsInput = z.input<typeof reorderInputsInput>;

/** Sets the order of the inputs, as used in the rule (first name, then last name). */
export function reorderMappingInputs(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: MappingState,
  input: unknown,
): CommandResult<{ mapping: Mapping }> {
  const parsed = begin(access, "model.edit", reorderInputsInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { mappingId, expectedVersion, mappingInputIds } = parsed.data;
  const got = current(state.mapping, access, mappingId, expectedVersion, "mapping");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  const inputs = liveInputs(access, before, state.inputs);
  const same = mappingInputIds.length === inputs.length && new Set(mappingInputIds).size === inputs.length &&
    inputs.every((i) => mappingInputIds.includes(i.id));
  if (!same) return fail(domainError("invalid", "The order must list every input of the mapping once."));

  const moved: Write[] = [];
  mappingInputIds.forEach((id, index) => {
    const i = inputs.find((x) => x.id === id)!;
    if (i.sort_order !== index) moved.push({ kind: "update", table: "mapping_input", before: i, row: nextVersion(ctx, i, { sort_order: index }) });
  });
  if (moved.length === 0) return fail(nothingToChange());
  const row = nextVersion(ctx, before, {});
  return done(ctx, access, { mapping: row }, [{ kind: "update", table: "mapping", before, row }, ...moved]);
}

// ---- status (AD-06) ----

const setStatusInput = z.object({ ...ref, status: z.enum(MAPPING_STATUSES) }).strict();
export type SetMappingStatusInput = z.input<typeof setStatusInput>;

export interface SetMappingStatusState {
  mapping: Mapping | null;
  /** Who last changed the mapping's inputs, kind or rule (`lastContentEditor`). */
  contentAuthorId: Uuid;
}

/**
 * Draft, in review, approved. Reviewers may do this too. With four-eyes on, the last content author cannot approve.
 * Approving records who and when; leaving `approved` clears both. Every approval is in the change log.
 */
export function setMappingStatus(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: SetMappingStatusState,
  input: unknown,
): CommandResult<{ mapping: Mapping }> {
  const parsed = begin(access, "mapping.set_status", setStatusInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { mappingId, expectedVersion, status } = parsed.data;
  const got = current(state.mapping, access, mappingId, expectedVersion, "mapping");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  if (status === before.status) return fail(nothingToChange());
  if (status === "approved") {
    const refused = checkFourEyes(access.workspace, ctx.actorId, state.contentAuthorId);
    if (refused) return fail(refused);
  }
  const row = nextVersion(ctx, before, {
    status,
    approved_by: status === "approved" ? ctx.actorId : null,
    approved_at: status === "approved" ? ctx.now : null,
  });
  return done(ctx, access, { mapping: row }, [{ kind: "update", table: "mapping", before, row }]);
}

// ---- delete ----

const deleteMappingInput = z.object(ref).strict();
export type DeleteMappingInput = z.input<typeof deleteMappingInput>;

/** Deletes a mapping and its inputs. */
export function deleteMapping(ctx: CommandContext, access: WorkspaceAccess, state: MappingState, input: unknown): CommandResult {
  const parsed = begin(access, "model.edit", deleteMappingInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.mapping, access, parsed.data.mappingId, parsed.data.expectedVersion, "mapping");
  if (!got.ok) return fail(got.error);
  const inputs = liveInputs(access, got.row, state.inputs);
  return done(ctx, access, undefined, [
    ...inputs.map((i) => softDelete(ctx, "mapping_input", i)),
    softDelete(ctx, "mapping", got.row),
  ]);
}
