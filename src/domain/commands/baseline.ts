// Baselines (slice 35, D-87; AD-03, AD-14): take one, rename it (its name and note), delete it. Outside undo: each is a
// change event that never becomes an undo step (`OUTSIDE_UNDO`), and undo never touches a baseline. The content is the
// caller's (`baselineContentOf` over `store.snapshot`, read once), written only by the insert and never again.
// Rights (the design): `baseline.create` and `baseline.rename` for owners, admins and modelers, `baseline.delete` for
// owners and admins, none in an archived workspace.

import { z } from "zod";
import { buildWriteSet, fail, newRowColumns, nextVersion, type CommandContext, type CommandResult } from "../changes";
import { domainError, notFound, staleVersion } from "../errors";
import type { Uuid } from "../ids";
import { checkPermission, type WorkspaceAccess } from "../permissions";
import type { Baseline } from "../types";
import { parseInput, uuidSchema, versionSchema } from "../validation";
import { baselineSummary, type BaselineContent, type BaselineInsert } from "../baseline/content";
import {
  BASELINE_GONE_MESSAGE,
  BASELINE_NAME_MAX,
  BASELINE_NOTE_MAX,
  baselineNameKey,
  baselineNameTakenBy,
  NAME_REQUIRED_MESSAGE,
  NAME_TOO_LONG_MESSAGE,
  nameTakenMessage,
  NOTE_TOO_LONG_MESSAGE,
  storedNote,
} from "../baseline/names";
import { SNAPSHOT_SCHEMA } from "../baseline/upgrade";

/** What a baseline command reads: the workspace's baselines (live and deleted, without their content). */
export interface BaselineState {
  readonly baselines: readonly Baseline[];
}

const nameInput = z.string().trim().min(1, NAME_REQUIRED_MESSAGE).max(BASELINE_NAME_MAX, NAME_TOO_LONG_MESSAGE);
const noteInput = z.string().nullable().optional().transform(storedNote).refine((n) => n === null || n.length <= BASELINE_NOTE_MAX, NOTE_TOO_LONG_MESSAGE);

const createInput = z.object({ workspaceId: uuidSchema, name: nameInput, note: noteInput }).strict();
export type CreateBaselineInput = z.input<typeof createInput>;

/**
 * Takes a baseline of `content`, the workspace's state as read for this command. `created_at` is the command's time;
 * the counts come from the content (the list never reads it).
 */
export function createBaseline(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: BaselineState,
  content: BaselineContent,
  input: unknown,
): CommandResult<{ baseline: Baseline }> {
  const refused = checkPermission(access, "baseline.create");
  if (refused) return fail(refused);
  const parsed = parseInput(createInput, input);
  if (!parsed.ok) return fail(parsed.error);
  if (parsed.data.workspaceId !== access.workspace.id) return fail(notFound("workspace"));
  const { name, note } = parsed.data;
  if (baselineNameTakenBy(state.baselines, name)) return fail(domainError("conflict", nameTakenMessage(name)));
  const baseline: Baseline = {
    ...newRowColumns(ctx),
    workspace_id: access.workspace.id,
    name,
    name_key: baselineNameKey(name),
    note,
    snapshot_schema: SNAPSHOT_SCHEMA,
    ...baselineSummary(content),
  };
  const row: BaselineInsert = { ...baseline, snapshot: content };
  const writeSet = buildWriteSet(ctx, access.workspace.id, [{ kind: "insert", table: "baseline", row }]);
  return { ok: true, value: { baseline }, writeSet: { ...writeSet, label: `Create baseline ${name}` } };
}

/** The live baseline the page knows, at the version it knows. */
function current(baseline: Baseline | null | undefined, access: WorkspaceAccess, id: Uuid, version: number): { ok: true; row: Baseline } | { ok: false; error: ReturnType<typeof staleVersion> } {
  if (!baseline || baseline.id !== id || baseline.workspace_id !== access.workspace.id || baseline.deleted_at !== null) {
    return { ok: false, error: domainError("not_found", BASELINE_GONE_MESSAGE) };
  }
  if (baseline.version !== version) return { ok: false, error: staleVersion() };
  return { ok: true, row: baseline };
}

const renameInput = z.object({ baselineId: uuidSchema, expectedVersion: versionSchema, name: nameInput, note: noteInput }).strict();
export type RenameBaselineInput = z.input<typeof renameInput>;

/** Changes a baseline's name and note (B1.3, D-59's version); what it holds stays as it was taken. */
export function renameBaseline(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: BaselineState,
  baseline: Baseline | null | undefined,
  input: unknown,
): CommandResult<{ baseline: Baseline; renamed: boolean }> {
  const refused = checkPermission(access, "baseline.rename");
  if (refused) return fail(refused);
  const parsed = parseInput(renameInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const found = current(baseline, access, parsed.data.baselineId, parsed.data.expectedVersion);
  if (!found.ok) return fail(found.error);
  const { name, note } = parsed.data;
  if (name === found.row.name && note === found.row.note) return fail(domainError("invalid", "Nothing to change."));
  if (baselineNameTakenBy(state.baselines, name, found.row.id)) return fail(domainError("conflict", nameTakenMessage(name)));
  const row = nextVersion(ctx, found.row, { name, name_key: baselineNameKey(name), note });
  const writeSet = buildWriteSet(ctx, access.workspace.id, [{ kind: "update", table: "baseline", before: found.row, row }]);
  return { ok: true, value: { baseline: row, renamed: name !== found.row.name }, writeSet: { ...writeSet, label: `Rename baseline ${found.row.name}` } };
}

const deleteInput = z.object({ baselineId: uuidSchema, expectedVersion: versionSchema }).strict();
export type DeleteBaselineInput = z.input<typeof deleteInput>;

/** Soft-deletes a baseline (B1.4, B2.1): it leaves the list and its name is free again; no Restore in this slice. */
export function deleteBaseline(ctx: CommandContext, access: WorkspaceAccess, baseline: Baseline | null | undefined, input: unknown): CommandResult<{ baseline: Baseline }> {
  const refused = checkPermission(access, "baseline.delete");
  if (refused) return fail(refused);
  const parsed = parseInput(deleteInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const found = current(baseline, access, parsed.data.baselineId, parsed.data.expectedVersion);
  if (!found.ok) return fail(found.error);
  const row = nextVersion(ctx, found.row, { deleted_at: ctx.now });
  const writeSet = buildWriteSet(ctx, access.workspace.id, [{ kind: "update", table: "baseline", before: found.row, row }]);
  return { ok: true, value: { baseline: row }, writeSet: { ...writeSet, label: `Delete baseline ${found.row.name}` } };
}
