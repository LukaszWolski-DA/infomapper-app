// The classification list and classifications on sources (slice 7c, P1, P3, P4; items 8–13): add an own
// classification, rename any one, remove any one with its links (its impact shown first, D-47), restore a removed
// built-in one empty, and set or clear a classification on a source table or column. Each is one change group and one
// undo step. Owners, admins and modelers, in a workspace that is not archived (item 12, AD-05, AD-09).
// Open changes to resolve that a removed Business key decides settle through `settleAfterWrites` (Q7), as every
// command's do, so the toggle, the removal and a deleted column settle the same way.

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, notFound, staleVersion } from "../errors";
import type { Uuid } from "../ids";
import { fitsScope, nameTakenBy, normClassification, TAKEN_NAME, whatStops } from "../model/classifications";
import type { WorkspaceAccess } from "../permissions";
import { businessKeySettlements } from "../source-changes/settle";
import { CLASSIFICATION_SCOPES, type Classification, type ClassificationLink, type SourceChange, type SourceColumn, type SourceTable } from "../types";
import { uuidSchema, versionSchema } from "../validation";
import { begin, current, done, isLive, softDelete } from "./shared";

/** A name as typed: trimmed, up to 80 characters, with at least one letter or digit (`norm` must not be empty). */
const classificationNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(80, "This name is too long.")
  .refine((v) => normClassification(v).length > 0, "Enter a name.");

export const RESTORE_TAKEN = (other: string, name: string) => `Rename ${other} first: ${name} is taken.`;
export const ONLY_BUILTIN_RESTORED = "Only built-in classifications can be restored.";
export const NOT_REMOVED = "It is in the list already.";

const takenError = () => domainError("conflict", TAKEN_NAME, { name: TAKEN_NAME });

// ---- add (own ones) ----

const addInput = z.object({ scope: z.enum(CLASSIFICATION_SCOPES), name: classificationNameSchema }).strict();
export type AddClassificationInput = z.input<typeof addInput>;

/** An own classification (item 8): no code, matched by name in an import file. */
export function addClassification(ctx: CommandContext, access: WorkspaceAccess, state: { classifications: readonly Classification[] }, input: unknown): CommandResult<{ classification: Classification }> {
  const parsed = begin(access, "model.edit", addInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { scope, name } = parsed.data;
  const ws = access.workspace.id;
  if (nameTakenBy(state.classifications.filter((c) => c.workspace_id === ws), scope, name)) return fail(takenError());
  const row: Classification = { ...newRowColumns(ctx), workspace_id: ws, code: null, name, name_key: normClassification(name), scope, origin: "own" };
  return done(ctx, access, { classification: row }, [{ kind: "insert", table: "classification", row }]);
}

// ---- rename (any one) ----

const renameInput = z.object({ classificationId: uuidSchema, expectedVersion: versionSchema, name: classificationNameSchema }).strict();
export type RenameClassificationInput = z.input<typeof renameInput>;

/** Item 9: a built-in one keeps its code, so its rules and a file's code keep working. */
export function renameClassification(ctx: CommandContext, access: WorkspaceAccess, state: { classifications: readonly Classification[] }, input: unknown): CommandResult<{ classification: Classification }> {
  const parsed = begin(access, "model.edit", renameInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { classificationId, expectedVersion, name } = parsed.data;
  const got = current(state.classifications.find((c) => c.id === classificationId), access, classificationId, expectedVersion, "classification");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  if (name === before.name) return fail(domainError("invalid", "Nothing to change."));
  if (nameTakenBy(state.classifications.filter((c) => c.workspace_id === access.workspace.id), before.scope, name, before.id)) return fail(takenError());
  const row = nextVersion(ctx, before, { name, name_key: normClassification(name) });
  return done(ctx, access, { classification: row }, [{ kind: "update", table: "classification", before, row }]);
}

// ---- remove (any one), with its impact first ----

export interface ClassificationUseRows {
  classifications: readonly Classification[];
  links: readonly ClassificationLink[];
  tables: readonly SourceTable[];
  columns: readonly SourceColumn[];
  /** The workspace's changes to resolve: the open ones a removed Business key settles (Q7). */
  changes?: readonly SourceChange[];
}

export interface ClassificationImpact {
  name: string;
  /** `schema.table`, in name order. */
  tables: { id: Uuid; label: string }[];
  /** `schema.table.column`, in name order. */
  columns: { id: Uuid; label: string }[];
  /** For a built-in one a rule reads: what stops (answer F3). */
  stops: string | null;
  /** Open business key changes that settle (Q7). */
  settles: number;
}

/** What removing a classification takes with it (item 10, D-47): the form shows it before anything is written. */
export function classificationImpact(rows: ClassificationUseRows, classificationId: Uuid): ClassificationImpact | null {
  const c = rows.classifications.find((x) => x.id === classificationId && x.deleted_at === null);
  if (!c) return null;
  const links = rows.links.filter((l) => l.deleted_at === null && l.classification_id === c.id);
  const table = new Map(rows.tables.filter((t) => t.deleted_at === null).map((t) => [t.id, t]));
  const column = new Map(rows.columns.filter((x) => x.deleted_at === null).map((x) => [x.id, x]));
  const tables: ClassificationImpact["tables"] = [];
  const columns: ClassificationImpact["columns"] = [];
  for (const l of links) {
    if (l.source_table_id) {
      const t = table.get(l.source_table_id);
      if (t) tables.push({ id: t.id, label: `${t.schema_name}.${t.name}` });
    } else if (l.source_column_id) {
      const x = column.get(l.source_column_id);
      const t = x && table.get(x.source_table_id);
      if (x && t) columns.push({ id: x.id, label: `${t.schema_name}.${t.name}.${x.name}` });
    }
  }
  const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);
  const settles = c.code === "BK" ? businessKeySettlements(rows.changes ?? [], new Set(links.flatMap((l) => (l.source_column_id ? [l.source_column_id] : [])))) : 0;
  return { name: c.name, tables: tables.sort(byLabel), columns: columns.sort(byLabel), stops: whatStops(c), settles };
}

const removeInput = z.object({ classificationId: uuidSchema, expectedVersion: versionSchema }).strict();
export type RemoveClassificationInput = z.input<typeof removeInput>;

/** Item 10: the classification and every link of it, in one change group. */
export function removeClassification(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { classifications: readonly Classification[]; links: readonly ClassificationLink[] },
  input: unknown,
): CommandResult<{ name: string; tables: number; columns: number }> {
  const parsed = begin(access, "model.edit", removeInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { classificationId, expectedVersion } = parsed.data;
  const got = current(state.classifications.find((c) => c.id === classificationId), access, classificationId, expectedVersion, "classification");
  if (!got.ok) return fail(got.error);
  const links = state.links.filter((l) => isLive(l, access.workspace.id) && l.classification_id === classificationId);
  const writes: Write[] = [...links.map((l) => softDelete(ctx, "classification_link", l)), softDelete(ctx, "classification", got.row)];
  return done(ctx, access, { name: got.row.name, tables: links.filter((l) => l.source_table_id).length, columns: links.filter((l) => l.source_column_id).length }, writes);
}

// ---- restore (built-in ones) ----

const restoreInput = z.object({ classificationId: uuidSchema, expectedVersion: versionSchema }).strict();
export type RestoreClassificationInput = z.input<typeof restoreInput>;

/**
 * Item 11: a removed built-in classification comes back empty, under the name it had; refused while another
 * classification of its scope has that name (answer F10).
 */
export function restoreClassification(ctx: CommandContext, access: WorkspaceAccess, state: { classifications: readonly Classification[] }, input: unknown): CommandResult<{ classification: Classification }> {
  const parsed = begin(access, "model.edit", restoreInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { classificationId, expectedVersion } = parsed.data;
  const ws = access.workspace.id;
  const before = state.classifications.find((c) => c.id === classificationId && c.workspace_id === ws);
  if (!before) return fail(notFound("classification"));
  if (before.deleted_at === null) return fail(domainError("conflict", NOT_REMOVED));
  if (before.code === null) return fail(domainError("invalid", ONLY_BUILTIN_RESTORED));
  if (before.version !== expectedVersion) return fail(staleVersion());
  const other = nameTakenBy(state.classifications.filter((c) => c.workspace_id === ws), before.scope, before.name, before.id);
  if (other) return fail(domainError("conflict", RESTORE_TAKEN(other.name, before.name)));
  const row = nextVersion(ctx, before, { deleted_at: null });
  return done(ctx, access, { classification: row }, [{ kind: "update", table: "classification", before, row }]);
}

// ---- set or clear on a table or column (items 13, 14) ----

const setInput = z
  .object({
    classificationId: uuidSchema,
    target: z.object({ kind: z.enum(["source_table", "source_column"]), id: uuidSchema }).strict(),
    on: z.boolean(),
  })
  .strict();
export type SetClassificationInput = z.input<typeof setInput>;

export interface SetClassificationState {
  classifications: readonly Classification[];
  links: readonly ClassificationLink[];
  tables: readonly SourceTable[];
  columns: readonly SourceColumn[];
}

export const WRONG_SCOPE = (name: string, scope: "table" | "column") => `${name} is a ${scope} classification.`;

/** One toggle: a new link, or the live link soft-deleted (answer F19: a set again is a new row). */
export function setClassification(ctx: CommandContext, access: WorkspaceAccess, state: SetClassificationState, input: unknown): CommandResult<{ name: string; objectName: string; on: boolean }> {
  const parsed = begin(access, "model.edit", setInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { classificationId, target, on } = parsed.data;
  const ws = access.workspace.id;
  const object = target.kind === "source_table" ? state.tables.find((t) => t.id === target.id) : state.columns.find((c) => c.id === target.id);
  if (!isLive(object, ws)) return fail(notFound(target.kind === "source_table" ? "source table" : "source column"));
  const c = state.classifications.find((x) => x.id === classificationId);
  if (!isLive(c, ws)) return fail(notFound("classification"));
  if (!fitsScope(c, target.kind)) return fail(domainError("invalid", WRONG_SCOPE(c.name, c.scope)));
  const column = target.kind === "source_column" ? "source_column_id" : "source_table_id";
  const link = state.links.find((l) => isLive(l, ws) && l.classification_id === c.id && l[column] === target.id);
  if (on) {
    if (link) return fail(domainError("conflict", `It is marked ${c.name} already.`));
    const row: ClassificationLink = {
      ...newRowColumns(ctx),
      workspace_id: ws,
      classification_id: c.id,
      source_table_id: target.kind === "source_table" ? target.id : null,
      source_column_id: target.kind === "source_column" ? target.id : null,
    };
    return done(ctx, access, { name: c.name, objectName: object.name, on }, [{ kind: "insert", table: "classification_link", row }]);
  }
  if (!link) return fail(domainError("invalid", "Nothing to change."));
  return done(ctx, access, { name: c.name, objectName: object.name, on }, [softDelete(ctx, "classification_link", link)]);
}

/** The classification links on the given tables and columns (the delete cascade, answer F18). */
export function linksOnSources(links: readonly ClassificationLink[] | undefined, tableIds: ReadonlySet<Uuid>, columnIds: ReadonlySet<Uuid>): ClassificationLink[] {
  return (links ?? []).filter(
    (l) => l.deleted_at === null && ((l.source_table_id !== null && tableIds.has(l.source_table_id)) || (l.source_column_id !== null && columnIds.has(l.source_column_id))),
  );
}
