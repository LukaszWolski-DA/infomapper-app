// Calculated attributes (slice 18, D-73; prototype `calcSection`, `openCalcPick`, the handlers `calc-on`, `calc-add`,
// `calc-rm`, `calc-off` and `attr.calcrule`): an attribute, logical or dimensional, calculated from other attributes of
// the same entity, with a plain-text rule. Every command writes the calculated attribute's row with a new version, so
// the panel's saves stay on the chain (slice 9), and is one change group with its own undo name (acceptance Q4).
//
// The checks (F7): an input is a live attribute of the same entity, never the attribute itself, never one it reads
// already, and never one whose calculation reads the attribute at some depth (no cycle). A calculated attribute may be
// left with no inputs (Q1): its last input removed, or deleted with its attribute.

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound } from "../errors";
import type { Uuid } from "../ids";
import { closesCycle, derivationIndex } from "../model/derivations";
import type { WorkspaceAccess } from "../permissions";
import type { Attribute, AttributeInput } from "../types";
import { uuidSchema, versionSchema } from "../validation";
import { begin, current, done, isLive, nothingToChange, softDelete } from "./shared";

// ---- texts (approved in step 1) ----

export const SAME_ENTITY = "An attribute is calculated from attributes of its own entity.";
export const NOT_ITSELF = "An attribute is not calculated from itself.";
export const readsAlready = (input: string) => `It is calculated from ${input} already.`;
export const cycleRefusal = (input: string, attribute: string) => `${input} is calculated from ${attribute}, so ${attribute} cannot be calculated from it.`;
export const CALCULATED_ALREADY = "It is calculated already. Add inputs instead.";
export const NOT_CALCULATED = "It is not calculated. Calculate it from attributes first.";

export const CALCULATE_LABEL = "Calculate attribute";
export const ADD_INPUTS_LABEL = "Add calculation inputs";
export const REMOVE_INPUT_LABEL = "Remove calculation input";
export const CHANGE_RULE_LABEL = "Change calculation rule";
export const STOP_CALCULATING_LABEL = "Stop calculating";

/** The first toast (prototype `openCalcPick`). */
export const calculatedToast = (attribute: string, inputs: readonly string[]) => `${attribute} is calculated from ${inputs.join(", ")}. Write its rule.`;
/** "Add inputs…"'s toast. */
export const readsMoreToast = (attribute: string, n: number) => `${attribute} reads ${n} more attribute${n === 1 ? "" : "s"}.`;
export const stoppedToast = (attribute: string) => `${attribute} is no longer calculated.`;

/** A calculation's rule: plain text like a mapping's rule, trimmed, empty is none (D-42 does not apply). */
export const calcRuleSchema = z
  .string()
  .max(20000, "This text is too long.")
  .nullable()
  .transform((v) => (v && v.trim() ? v.trim() : null));

export interface DerivationState {
  /** The attribute the input names. */
  attribute: Attribute | null;
  /** The workspace's live attributes: the inputs, their entity and their calculations. */
  attributes: readonly Attribute[];
  /** The workspace's calculation inputs. */
  attributeInputs: readonly AttributeInput[];
}

const inputsInput = z.object({ attributeId: uuidSchema, expectedVersion: versionSchema, inputIds: z.array(uuidSchema).min(1).max(50) }).strict();
export type CalculateAttributeInput = z.input<typeof inputsInput>;

/** The live input rows of a calculated attribute, in order. */
const inputRowsOf = (state: DerivationState, attributeId: Uuid, workspaceId: Uuid) =>
  state.attributeInputs.filter((i) => isLive(i, workspaceId) && i.attribute_id === attributeId).sort((a, b) => a.sort_order - b.sort_order);

/** The new input rows after the existing ones, each checked (F7); a refusal names the first input that fails. */
function newInputs(ctx: CommandContext, access: WorkspaceAccess, state: DerivationState, attribute: Attribute, inputIds: readonly Uuid[]) {
  const workspaceId = access.workspace.id;
  const byId = new Map(state.attributes.filter((a) => isLive(a, workspaceId)).map((a) => [a.id, a]));
  const index = derivationIndex([...byId.values()], state.attributeInputs);
  const existing = inputRowsOf(state, attribute.id, workspaceId);
  const reads = new Set(existing.map((i) => i.input_attribute_id));
  let order = existing.reduce((max, i) => Math.max(max, i.sort_order), -1);
  const rows: AttributeInput[] = [];
  const names: string[] = [];
  for (const id of inputIds) {
    const input = byId.get(id);
    if (!input) return { ok: false as const, error: notFound("attribute") };
    if (input.id === attribute.id) return { ok: false as const, error: domainError("invalid", NOT_ITSELF) };
    if (input.entity_id !== attribute.entity_id) return { ok: false as const, error: domainError("invalid", SAME_ENTITY) };
    if (reads.has(input.id)) return { ok: false as const, error: domainError("conflict", readsAlready(input.name)) };
    if (closesCycle(index, attribute.id, input.id)) return { ok: false as const, error: domainError("invalid", cycleRefusal(input.name, attribute.name)) };
    reads.add(input.id);
    names.push(input.name);
    rows.push({ ...newRowColumns(ctx), workspace_id: workspaceId, attribute_id: attribute.id, input_attribute_id: input.id, sort_order: ++order });
  }
  return { ok: true as const, rows, names };
}

const labelled = <T,>(result: CommandResult<T>, label: string): CommandResult<T> => {
  if (result.ok) {
    result.writeSet.label = label;
    // the working context labels the calculated attribute, not its input rows (as a move, slice 3b, Q2)
    result.writeSet.mainTargets = [{ kind: "attribute", id: (result.writeSet.writes.find((w) => w.table === "attribute")!.row as { id: Uuid }).id }];
  }
  return result;
};

/** "Calculate from attributes…" (item 1): the attribute becomes calculated from the chosen inputs. */
export function calculateAttribute(ctx: CommandContext, access: WorkspaceAccess, state: DerivationState, input: unknown): CommandResult<{ version: number; toast: string }> {
  const parsed = begin(access, "model.edit", inputsInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.attribute, access, parsed.data.attributeId, parsed.data.expectedVersion, "attribute");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  if (before.is_calculated) return fail(domainError("invalid", CALCULATED_ALREADY));
  const inputs = newInputs(ctx, access, state, before, parsed.data.inputIds);
  if (!inputs.ok) return fail(inputs.error);
  const row = nextVersion(ctx, before, { is_calculated: true });
  const writes: Write[] = [{ kind: "update", table: "attribute", before, row }, ...inputs.rows.map((r): Write => ({ kind: "insert", table: "attribute_input", row: r }))];
  return labelled(done(ctx, access, { version: row.version, toast: calculatedToast(before.name, inputs.names) }, writes), CALCULATE_LABEL);
}

/** "Add inputs…" (item 1): more inputs, after the existing ones. */
export function addAttributeInputs(ctx: CommandContext, access: WorkspaceAccess, state: DerivationState, input: unknown): CommandResult<{ version: number; toast: string }> {
  const parsed = begin(access, "model.edit", inputsInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.attribute, access, parsed.data.attributeId, parsed.data.expectedVersion, "attribute");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  if (!before.is_calculated) return fail(domainError("invalid", NOT_CALCULATED));
  const inputs = newInputs(ctx, access, state, before, parsed.data.inputIds);
  if (!inputs.ok) return fail(inputs.error);
  const row = nextVersion(ctx, before, {});
  const writes: Write[] = [{ kind: "update", table: "attribute", before, row }, ...inputs.rows.map((r): Write => ({ kind: "insert", table: "attribute_input", row: r }))];
  return labelled(done(ctx, access, { version: row.version, toast: readsMoreToast(before.name, inputs.rows.length) }, writes), ADD_INPUTS_LABEL);
}

const removeInput = z.object({ attributeId: uuidSchema, expectedVersion: versionSchema, inputId: uuidSchema }).strict();
export type RemoveAttributeInputInput = z.input<typeof removeInput>;

/** × on an input (item 1): the calculation stops reading it; the last one too (Q1: it stays calculated). */
export function removeAttributeInput(ctx: CommandContext, access: WorkspaceAccess, state: DerivationState, input: unknown): CommandResult<{ version: number }> {
  const parsed = begin(access, "model.edit", removeInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.attribute, access, parsed.data.attributeId, parsed.data.expectedVersion, "attribute");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  const rows = inputRowsOf(state, before.id, access.workspace.id).filter((i) => i.input_attribute_id === parsed.data.inputId);
  if (!before.is_calculated || !rows.length) return fail(notFound("calculation input"));
  const row = nextVersion(ctx, before, {});
  return labelled(done(ctx, access, { version: row.version }, [{ kind: "update", table: "attribute", before, row }, ...rows.map((r) => softDelete(ctx, "attribute_input", r))]), REMOVE_INPUT_LABEL);
}

const ruleInput = z.object({ attributeId: uuidSchema, expectedVersion: versionSchema, rule: calcRuleSchema }).strict();
export type SetCalculationRuleInput = z.input<typeof ruleInput>;

/** The rule field (item 1): plain text, saved on leaving the field (slice 13's draft). */
export function setCalculationRule(ctx: CommandContext, access: WorkspaceAccess, state: DerivationState, input: unknown): CommandResult<{ version: number }> {
  const parsed = begin(access, "model.edit", ruleInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.attribute, access, parsed.data.attributeId, parsed.data.expectedVersion, "attribute");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  if (!before.is_calculated) return fail(domainError("invalid", NOT_CALCULATED));
  if (parsed.data.rule === before.calc_rule) return fail(nothingToChange());
  const row = nextVersion(ctx, before, { calc_rule: parsed.data.rule });
  return labelled(done(ctx, access, { version: row.version }, [{ kind: "update", table: "attribute", before, row }]), CHANGE_RULE_LABEL);
}

const stopInput = z.object({ attributeId: uuidSchema, expectedVersion: versionSchema }).strict();

/** "Stop calculating" (item 1): no flag, no rule, no inputs. */
export function stopCalculating(ctx: CommandContext, access: WorkspaceAccess, state: DerivationState, input: unknown): CommandResult<{ version: number; toast: string }> {
  const parsed = begin(access, "model.edit", stopInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.attribute, access, parsed.data.attributeId, parsed.data.expectedVersion, "attribute");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  if (!before.is_calculated) return fail(nothingToChange());
  const row = nextVersion(ctx, before, { is_calculated: false, calc_rule: null });
  const writes: Write[] = [{ kind: "update", table: "attribute", before, row }, ...inputRowsOf(state, before.id, access.workspace.id).map((r) => softDelete(ctx, "attribute_input", r))];
  return labelled(done(ctx, access, { version: row.version, toast: stoppedToast(before.name) }, writes), STOP_CALCULATING_LABEL);
}
