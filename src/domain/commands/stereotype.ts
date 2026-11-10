// The workspace's entity stereotypes (slice 24, D-79; items 3–7): add an own one with its code, rename or define any
// one, remove an own one (its entities moved to another in the same change group). Each is one change group and one
// undo step, for owners, admins and modelers in a workspace that is not archived (D-57's roles, `model.edit`).
// Entities keep the code, so a rename or a definition writes the stereotype's row only.

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError } from "../errors";
import {
  isBuiltinStereotype,
  STEREOTYPE_CODE_TAKEN,
  STEREOTYPE_NAME_TAKEN,
  stereotypeCodeRefusal,
  stereotypeNameTakenBy,
  stereotypeRow,
  typedStereotypeCode,
} from "../model/stereotypes";
import { normClassification } from "../model/classifications";
import type { WorkspaceAccess } from "../permissions";
import type { Entity, Stereotype } from "../types";
import { uuidSchema, versionSchema } from "../validation";
import { begin, current, done, isLive, nothingToChange, plainTextSchema, softDelete } from "./shared";

/** A name as typed: trimmed, up to 80 characters, with at least one letter or digit. */
const stereotypeNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(80, "This name is too long.")
  .refine((v) => normClassification(v).length > 0, "Enter a name.");

const nameTaken = () => domainError("conflict", STEREOTYPE_NAME_TAKEN, { name: STEREOTYPE_NAME_TAKEN });

export interface StereotypeState {
  /** The workspace's stereotypes, removed and deleted ones included (their codes stay taken). */
  stereotypes: readonly Stereotype[];
}

// ---- the undo history's names and the toasts (F9, F10) ----

export const ADD_STEREOTYPE_LABEL = (name: string) => `Add stereotype ${name}`;
export const RENAME_STEREOTYPE_LABEL = (name: string) => `Rename stereotype ${name}`;
export const STEREOTYPE_DEFINITION_LABEL = (name: string) => `Change definition of ${name}`;
export const REMOVE_STEREOTYPE_LABEL = (name: string) => `Remove stereotype ${name}`;

export const STEREOTYPE_ADDED = (name: string, code: string) => `Stereotype “${name}” added (${code}).`;
export const STEREOTYPE_RENAMED = (name: string) => `Renamed to ${name}; entities keep the stereotype.`;
export const STEREOTYPE_DEFINITION_SAVED = (name: string) => `Saved the definition of ${name}.`;
export const STEREOTYPE_DEFINITION_CLEARED = (name: string) => `Cleared the definition of ${name}.`;
export const STEREOTYPE_REMOVED = (name: string) => `${name} removed.`;
export const STEREOTYPE_REMOVED_MOVED = (name: string, n: number, other: string) =>
  n === 1 ? `${name} removed; 1 entity is now ${other}.` : `${name} removed; ${n} entities are now ${other}.`;

export const BUILTIN_NOT_REMOVED = "A built-in stereotype can't be removed.";
export const CHOOSE_MOVE_TO = "Choose the stereotype they get instead.";

const named = <T>(r: CommandResult<T>, label: string): CommandResult<T> => {
  if (r.ok) r.writeSet.label = label;
  return r;
};

const listOf = (state: StereotypeState, access: WorkspaceAccess) => state.stereotypes.filter((s) => s.workspace_id === access.workspace.id);

// ---- add (own ones) ----

const addInput = z.object({ name: stereotypeNameSchema, code: z.string().max(200) }).strict();
export type AddStereotypeInput = z.input<typeof addInput>;

/**
 * An own stereotype (item 5): its code required (the page proposes it from the name, F6), trimmed and lower-cased,
 * letters, digits and `_`, starting with a letter, at most 30; unique against every code and live name (F5).
 */
export function addStereotype(ctx: CommandContext, access: WorkspaceAccess, state: StereotypeState, input: unknown): CommandResult<{ stereotype: Stereotype }> {
  const parsed = begin(access, "model.edit", addInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { name } = parsed.data;
  const list = listOf(state, access);
  if (stereotypeNameTakenBy(list, name)) return fail(nameTaken());
  const code = typedStereotypeCode(parsed.data.code) ?? "";
  const refusal = stereotypeCodeRefusal(list, code);
  if (refusal) return fail(domainError(refusal === STEREOTYPE_CODE_TAKEN ? "conflict" : "invalid", refusal, { code: refusal }));
  const cols = newRowColumns(ctx);
  const row = stereotypeRow({ id: cols.id, workspace_id: access.workspace.id, created_at: cols.created_at, created_by: cols.created_by }, { code, name, definition: null, origin: "own" });
  return named(done(ctx, access, { stereotype: row }, [{ kind: "insert", table: "stereotype", row }]), ADD_STEREOTYPE_LABEL(name));
}

// ---- rename (any one) ----

const renameInput = z.object({ stereotypeId: uuidSchema, expectedVersion: versionSchema, name: stereotypeNameSchema }).strict();
export type RenameStereotypeInput = z.input<typeof renameInput>;

/** Item 3: only the name changes; its code, and every entity's, stay. */
export function renameStereotype(ctx: CommandContext, access: WorkspaceAccess, state: StereotypeState, input: unknown): CommandResult<{ stereotype: Stereotype }> {
  const parsed = begin(access, "model.edit", renameInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { stereotypeId, expectedVersion, name } = parsed.data;
  const got = current(state.stereotypes.find((s) => s.id === stereotypeId), access, stereotypeId, expectedVersion, "stereotype");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  if (name === before.name) return fail(nothingToChange());
  if (stereotypeNameTakenBy(listOf(state, access), name, before.id)) return fail(nameTaken());
  const row = nextVersion(ctx, before, { name, name_key: normClassification(name) });
  return named(done(ctx, access, { stereotype: row }, [{ kind: "update", table: "stereotype", before, row }]), RENAME_STEREOTYPE_LABEL(before.name));
}

// ---- a definition (any one) ----

const definitionInput = z.object({ stereotypeId: uuidSchema, expectedVersion: versionSchema, definition: plainTextSchema }).strict();
export type SetStereotypeDefinitionInput = z.input<typeof definitionInput>;

/** Item 4: plain text, trimmed, empty clears it (null). */
export function setStereotypeDefinition(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: StereotypeState,
  input: unknown,
): CommandResult<{ stereotype: Stereotype; name: string; removed: boolean }> {
  const parsed = begin(access, "model.edit", definitionInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { stereotypeId, expectedVersion } = parsed.data;
  const got = current(state.stereotypes.find((s) => s.id === stereotypeId), access, stereotypeId, expectedVersion, "stereotype");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  const definition = parsed.data.definition?.trim() || null;
  if (definition === before.definition) return fail(nothingToChange());
  const row = nextVersion(ctx, before, { definition });
  return named(done(ctx, access, { stereotype: row, name: before.name, removed: definition === null }, [{ kind: "update", table: "stereotype", before, row }]), STEREOTYPE_DEFINITION_LABEL(before.name));
}

// ---- remove (own ones), with the move of its entities ----

const removeInput = z.object({ stereotypeId: uuidSchema, expectedVersion: versionSchema, moveTo: uuidSchema.optional() }).strict();
export type RemoveStereotypeInput = z.input<typeof removeInput>;

export interface RemoveStereotypeState extends StereotypeState {
  /** The workspace's entities as stored: the live logical ones on the code move (F16). */
  entities: readonly Entity[];
}

/**
 * Item 6 (F16): an own stereotype, soft-deleted; its live entities (logical only: a fact or a dimension keeps `object`,
 * C-5) get `moveTo`'s code in the same change group. Without entities it goes at once (`moveTo` is ignored); with them
 * `moveTo` is required, another live stereotype. The entities are read as they stand (the page holds no versions of
 * them), so the answer's count is the server's.
 */
export function removeStereotype(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: RemoveStereotypeState,
  input: unknown,
): CommandResult<{ name: string; moved: number; movedTo: string | null }> {
  const parsed = begin(access, "model.edit", removeInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { stereotypeId, expectedVersion, moveTo } = parsed.data;
  const ws = access.workspace.id;
  const got = current(state.stereotypes.find((s) => s.id === stereotypeId), access, stereotypeId, expectedVersion, "stereotype");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  if (isBuiltinStereotype(before)) return fail(domainError("invalid", BUILTIN_NOT_REMOVED));
  const using = state.entities.filter((e) => isLive(e, ws) && e.stereotype === before.code);
  const writes: Write[] = [];
  let target: Stereotype | null = null;
  if (using.length) {
    if (!moveTo) return fail(domainError("invalid", CHOOSE_MOVE_TO));
    const to = state.stereotypes.find((s) => s.id === moveTo);
    if (!isLive(to, ws) || to.id === before.id) return fail(domainError("invalid", CHOOSE_MOVE_TO));
    target = to;
    for (const e of using) writes.push({ kind: "update", table: "entity", before: e, row: nextVersion(ctx, e, { stereotype: to.code }) });
  }
  writes.push(softDelete(ctx, "stereotype", before));
  return named(done(ctx, access, { name: before.name, moved: using.length, movedTo: target?.name ?? null }, writes), REMOVE_STEREOTYPE_LABEL(before.name));
}
