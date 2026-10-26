// Importing sources (slice 7a, PRD items 28 and 40; P7, P8): the server reads the text again with the domain's
// readers, builds the plan from the person's choices against the current data, and writes only when it does what the
// review showed (`planFingerprint`, answer 12). One command, one change group with a change event per written row, one
// undo step (P7); the import is recorded in `source_import`. Owners, admins and modelers, in a workspace that is not
// archived (AD-05, AD-09). The working context labels nothing an import writes (P9).
// Slice 7b: the import writes the changes to resolve it raises and settles the open ones the source settles (P7), in
// the same change group; their versions are part of P8's fingerprint.

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError, staleVersion } from "../errors";
import type { Uuid } from "../ids";
import { applyPlan, type RowPatch } from "../import/apply";
import { planFingerprint, STALE_REVIEW } from "../import/compare";
import { readDdl } from "../import/ddl";
import { relationshipsWithColumns, type ImportModel } from "../import/model";
import { buildPlan, importSummary, type ImportCounts, type ImportTarget } from "../import/plan";
import { CATALOG_VENDORS, MAX_IMPORT_ROWS, readStandard } from "../import/standard";
import type { WorkspaceAccess } from "../permissions";
import {
  IMPORT_CHANNELS,
  type Mapping,
  type SourceChange,
  type SourceColumn,
  type SourceImport,
  type SourceRelationship,
  type SourceRelationshipColumn,
  type SourceSystem,
  type SourceTable,
  type WorkspaceModel,
  type WritableRows,
} from "../types";
import { nameSchema, uuidSchema } from "../validation";
import { begin, done, softDelete } from "./shared";

/** Characters one import's text may have (PRD item 12; the limit is proposed with step 4's figures). */
export const MAX_IMPORT_TEXT = 20_000_000;

const importInput = z
  .object({
    target: z.union([z.object({ systemId: uuidSchema }).strict(), z.object({ newName: nameSchema }).strict()]),
    channel: z.enum(IMPORT_CHANNELS),
    /** The file's name, “pasted query result”, or the script's name for the DDL channel. */
    sourceLabel: z.string().trim().min(1).max(500),
    text: z.string().max(MAX_IMPORT_TEXT, "The file is too large for one import. Split it by database or schema."),
    /** The query channel's database: SQL Server's `timestamp` is read as `rowversion` (step 7). */
    vendor: z.enum(CATALOG_VENDORS).optional(),
    /** The DDL channel's fields (item 16). */
    ddl: z.object({ database: z.string().max(500).optional(), schema: z.string().max(500).optional() }).strict().optional(),
    scope: z.array(z.string().max(2000)).max(MAX_IMPORT_ROWS),
    compare: z.enum(["schemas", "tables"]),
    renames: z.array(z.tuple([z.string().max(2000), z.string().max(1000)])).max(MAX_IMPORT_ROWS),
    /** `planFingerprint` of the plan the review showed (P8). */
    fingerprint: z.string().min(1).max(100),
  })
  .strict();
export type ImportSourcesInput = z.input<typeof importInput>;

/** What an import says afterwards (item 28's toast; the system panel opens on it). */
export interface ImportOutcome {
  systemId: Uuid;
  systemName: string;
  importId: Uuid;
  counts: ImportCounts;
  /** “2 new tables, 5 new columns, …” or “No changes”. */
  summary: string;
  /** Approved mappings the import sent back to review (P6). */
  sentBack: number;
}

/** P8's refusal: the review shows what the system is now, keeping the choices that still apply (`keptChoices`). */
export const STALE_REVIEW_FIELD = "review";

/** The rows the command reads: the import engine's model, and the stored relationships behind its view. */
export interface ImportState {
  model: ImportModel;
  relationships: readonly SourceRelationship[];
  relationshipColumns: readonly SourceRelationshipColumn[];
}

/** The command's state from the workspace's live model and its changes to resolve (slice 7b). */
export const importStateOf = (model: WorkspaceModel, changes: readonly SourceChange[] = []): ImportState => ({
  model: {
    systems: model.sourceSystems,
    tables: model.sourceTables,
    columns: model.sourceColumns,
    relationships: relationshipsWithColumns(model.sourceRelationships, model.sourceRelationshipColumns),
    mappings: model.mappings,
    mappingInputs: model.mappingInputs,
    attributes: model.attributes,
    entities: model.entities,
    changes,
  },
  relationships: model.sourceRelationships,
  relationshipColumns: model.sourceRelationshipColumns,
});

export function importSources(ctx: CommandContext, access: WorkspaceAccess, state: ImportState, input: unknown): CommandResult<ImportOutcome> {
  const parsed = begin(access, "model.edit", importInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const i = parsed.data;
  const ws = access.workspace.id;

  const read =
    i.channel === "ddl"
      ? readDdl(i.text, { database: i.ddl?.database, schema: i.ddl?.schema, fileName: i.sourceLabel }).read
      : readStandard(i.text, i.sourceLabel, i.channel === "query" ? { vendor: i.vendor } : {});
  if (read.errors.length) return fail(domainError("invalid", read.errors[0]!));
  if (!i.scope.length) return fail(domainError("invalid", "Select at least one table to import."));
  const target: ImportTarget = "systemId" in i.target ? { systemId: i.target.systemId } : { newName: i.target.newName };
  const plan = buildPlan(state.model, read, target, { scope: new Set(i.scope), compare: i.compare, renames: new Map(i.renames) });
  if (plan.errors.length) return fail(domainError("conflict", plan.errors[0]!));
  // P8: write only what the review showed
  if (planFingerprint(plan) !== i.fingerprint) {
    return fail(domainError("conflict", STALE_REVIEW(plan.systemName), { [STALE_REVIEW_FIELD]: "stale" }));
  }
  const applied = applyPlan(state.model, plan, ctx);
  if (!applied.ok) return fail(domainError("conflict", applied.errors[0]!));
  const c = applied.changes;

  const writes: Write[] = [];
  if (c.system.isNew) {
    const system: SourceSystem = { ...newRowColumns(ctx), id: c.system.id, workspace_id: ws, name: c.system.name, description: null };
    writes.push({ kind: "insert", table: "source_system", row: system });
  }
  for (const t of c.tables.insert) {
    const row: SourceTable = { ...newRowColumns(ctx), ...t, workspace_id: ws, missing_since: null, retired_since: null };
    writes.push({ kind: "insert", table: "source_table", row });
  }
  for (const col of c.columns.insert) {
    const row: SourceColumn = { ...newRowColumns(ctx), ...col, workspace_id: ws, default_value: null, missing_since: null, retired_since: null, not_needed: false };
    writes.push({ kind: "insert", table: "source_column", row });
  }
  const byId = <R extends { id: Uuid }>(rows: readonly R[]) => new Map(rows.map((r) => [r.id, r]));
  /** A patch on the row as read; a row that moved on meanwhile refuses the write (AD-12). */
  const update = <T extends "source_table" | "source_column" | "source_relationship" | "mapping" | "source_change">(
    table: T,
    rows: ReadonlyMap<Uuid, WritableRows[T]>,
    patches: readonly RowPatch<WritableRows[T]>[],
  ): boolean => {
    for (const p of patches) {
      const before = rows.get(p.id);
      if (!before || before.version !== p.version) return false;
      writes.push({ kind: "update", table, before, row: nextVersion(ctx, before, p.patch) } as Write);
    }
    return true;
  };
  const relationships = byId(state.relationships);
  const ok =
    update("source_table", byId(state.model.tables), c.tables.update) &&
    update("source_column", byId(state.model.columns), c.columns.update) &&
    update("source_relationship", relationships, c.relationships.update as RowPatch<SourceRelationship>[]) &&
    update("mapping", byId<Mapping>(state.model.mappings), c.mappings) &&
    update("source_change", byId<SourceChange>(state.model.changes ?? []), c.changes.update);
  if (!ok) return fail(staleVersion());
  for (const r of c.relationships.insert) {
    const row: SourceRelationship = { ...newRowColumns(ctx), ...r, workspace_id: ws, missing_since: null };
    writes.push({ kind: "insert", table: "source_relationship", row });
  }
  const pairs = byId(state.relationshipColumns);
  for (const id of c.relationshipColumns.remove) {
    const pair = pairs.get(id);
    if (!pair) return fail(staleVersion());
    writes.push(softDelete(ctx, "source_relationship_column", pair));
  }
  for (const p of c.relationshipColumns.insert) {
    const row: SourceRelationshipColumn = { ...newRowColumns(ctx), ...p, workspace_id: ws };
    writes.push({ kind: "insert", table: "source_relationship_column", row });
  }
  const record: SourceImport = {
    ...newRowColumns(ctx),
    id: c.importId,
    workspace_id: ws,
    source_system_id: c.system.id,
    channel: i.channel,
    source_label: read.fileName,
    ...c.counts,
  };
  writes.push({ kind: "insert", table: "source_import", row: record });
  for (const r of c.changes.insert) {
    const row: SourceChange = { ...newRowColumns(ctx), ...r, workspace_id: ws, status: "open", resolution: null, resolved_by: null, resolved_at: null };
    writes.push({ kind: "insert", table: "source_change", row });
  }


  const result = done(
    ctx,
    access,
    {
      systemId: c.system.id,
      systemName: c.system.name,
      importId: record.id,
      counts: c.counts,
      summary: importSummary(c.counts),
      sentBack: plan.mappings.filter((m) => m.sendsBack).length,
    },
    writes,
  );
  if (result.ok) result.writeSet.labelNothing = true;
  return result;
}
