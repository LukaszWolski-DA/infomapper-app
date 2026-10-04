// Helpers shared by the model commands (slice 1a).

import { z } from "zod";
import { buildWriteSet, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound, staleVersion, type DomainError } from "../errors";
import type { Uuid } from "../ids";
import { checkPermission, type WorkspaceAccess, type WorkspaceAction } from "../permissions";
import type { StandardColumns, Timestamp, WritableRows, WritableTable } from "../types";
import { parseInput } from "../validation";

type Row = { id: Uuid; workspace_id: Uuid; deleted_at: Timestamp | null; version: number };

/** A row that exists, is not deleted and belongs to the workspace. */
export const isLive = <R extends { deleted_at: Timestamp | null; workspace_id: Uuid }>(row: R | null | undefined, workspaceId: Uuid): row is R =>
  !!row && row.deleted_at === null && row.workspace_id === workspaceId;

/** Permission first, then the input: a refused role learns nothing about the data. */
export function begin<S extends z.ZodType>(
  access: WorkspaceAccess,
  action: WorkspaceAction,
  schema: S,
  input: unknown,
): { ok: true; data: z.output<S> } | { ok: false; error: DomainError } {
  const denied = checkPermission(access, action);
  if (denied) return { ok: false, error: denied };
  return parseInput(schema, input);
}

/** The row the input names, live and at the version the user read; otherwise not found or stale. */
export function current<R extends Row>(
  row: R | null | undefined,
  access: WorkspaceAccess,
  id: Uuid,
  expectedVersion: number,
  what: string,
): { ok: true; row: R } | { ok: false; error: DomainError } {
  if (!isLive(row, access.workspace.id) || row.id !== id) return { ok: false, error: notFound(what) };
  if (row.version !== expectedVersion) return { ok: false, error: staleVersion() };
  return { ok: true, row };
}

/** A live row of the workspace with the given id, or a not-found error. */
export function found<R extends Omit<Row, "version">>(
  row: R | null | undefined,
  access: WorkspaceAccess,
  id: Uuid,
  what: string,
): { ok: true; row: R } | { ok: false; error: DomainError } {
  if (!isLive(row, access.workspace.id) || row.id !== id) return { ok: false, error: notFound(what) };
  return { ok: true, row };
}

export const done = <T>(ctx: CommandContext, access: WorkspaceAccess, value: T, writes: Write[]): CommandResult<T> => ({
  ok: true,
  value,
  writeSet: buildWriteSet(ctx, access.workspace.id, writes),
});

/** The soft-deleted next version of a row. */
export const softDeleted = <R extends Row & { updated_at: Timestamp; updated_by: Uuid }>(ctx: CommandContext, row: R): R =>
  nextVersion(ctx, row, { deleted_at: ctx.now } as Partial<R>);

/** Tables whose rows are soft-deleted (they have the standard columns). */
export type SoftDeletableTable = { [T in WritableTable]: WritableRows[T] extends StandardColumns ? T : never }[WritableTable];

/** The write that soft-deletes a row of a table. */
export const softDelete = <T extends SoftDeletableTable>(ctx: CommandContext, table: T, row: WritableRows[T]): Write =>
  ({ kind: "update", table, before: row, row: softDeleted(ctx, row) }) as Write;

export const nothingToChange = (): DomainError => domainError("invalid", "Nothing to change.");

/** Optional plain text (definitions, notes): absent = unchanged, empty = cleared. */
export const plainTextSchema = z.string().max(20000, "This text is too long.").nullable();

/** Sort order after the last of the given rows. */
export const nextSortOrder = (rows: readonly { sort_order: number }[]): number =>
  rows.reduce((max, r) => Math.max(max, r.sort_order + 1), 0);
