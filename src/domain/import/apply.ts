// Applying an import's plan (slice 7a, PRD items 28–32; prototype `applyPlan` without its changes to resolve, 7b):
// the rows the import writes, as new rows and patches of existing ones. Pure; step 4's command turns the changeset
// into writes with their change events in one change group (P7). Unchanged rows get no patch (item 6); a position
// change does (answer 11). Nothing is deleted (P3): missing is `missing_since`, and back clears it.
// A mapping that goes back to review (P6) loses its approval and gets its `review_reason` (answer 6); a renamed input in
// a rule is rewritten whatever the mapping's status.

import type { Uuid } from "../ids";
import { sameColumnType } from "../model/column-type";
import type { Timestamp } from "../types";
import type { ImportColumn, ImportMapping, ImportModel, ImportTable } from "./model";
import { planCounts, type ImportCounts, type ImportPlan } from "./plan";
import type { StandardObjectType } from "./standard";

export interface ApplyContext {
  now: Timestamp;
  newId: () => Uuid;
}

export interface NewTableRow {
  id: Uuid;
  source_system_id: Uuid;
  database_name: string;
  schema_name: string;
  name: string;
  object_type: StandardObjectType;
  file_format: string | null;
  row_count: number | null;
  comment: string | null;
}

export interface NewColumnRow {
  id: Uuid;
  source_table_id: Uuid;
  name: string;
  ordinal: number;
  data_type: string;
  type_length: number | null;
  type_precision: number | null;
  type_scale: number | null;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  is_business_key: boolean;
  is_pii: boolean;
  comment: string | null;
}

export interface NewRelationshipRow {
  id: Uuid;
  source_table_id: Uuid;
  to_source_table_id: Uuid;
  name: string;
  kind: "declared";
}

export interface NewRelationshipColumnRow {
  id: Uuid;
  source_relationship_id: Uuid;
  from_column_id: Uuid;
  to_column_id: Uuid;
  sort_order: number;
}

/** A change to an existing row, read at `version`. */
export interface RowPatch<T> {
  id: Uuid;
  version: number;
  patch: Partial<T>;
}

export interface ImportChangeset {
  system: { id: Uuid; name: string; isNew: boolean };
  tables: { insert: NewTableRow[]; update: RowPatch<ImportTable>[] };
  columns: { insert: NewColumnRow[]; update: RowPatch<ImportColumn>[] };
  relationships: { insert: NewRelationshipRow[]; update: RowPatch<{ to_source_table_id: Uuid; missing_since: Timestamp | null }>[] };
  /** Column pairs of new relationships, and of changed ones (the old pairs are removed). */
  relationshipColumns: { insert: NewRelationshipColumnRow[]; remove: Uuid[] };
  mappings: RowPatch<ImportMapping>[];
  counts: ImportCounts;
}

const lower = (s: string) => s.toLowerCase();

export function applyPlan(model: ImportModel, plan: ImportPlan, ctx: ApplyContext): { ok: true; changes: ImportChangeset } | { ok: false; errors: string[] } {
  if (plan.errors.length) return { ok: false, errors: plan.errors };
  const fields = plan.fields;
  const isNew = !("systemId" in plan.target);
  const systemId = "systemId" in plan.target ? plan.target.systemId : ctx.newId();
  const changes: ImportChangeset = {
    system: { id: systemId, name: plan.systemName, isNew },
    tables: { insert: [], update: [] },
    columns: { insert: [], update: [] },
    relationships: { insert: [], update: [] },
    relationshipColumns: { insert: [], remove: [] },
    mappings: [],
    counts: planCounts(plan),
  };

  // where each table and column is after the import, for the relationships
  const tableIdByKey = new Map<string, Uuid>();
  const columnIds = new Map<Uuid, Map<string, Uuid>>();
  const columnsOfTable = (tableId: Uuid) => columnIds.get(tableId) ?? columnIds.set(tableId, new Map()).get(tableId)!;
  const systemTables = new Set<Uuid>();
  for (const t of model.tables) {
    if (t.deleted_at !== null || t.source_system_id !== systemId) continue;
    systemTables.add(t.id);
    tableIdByKey.set(`${t.database_name}|${t.schema_name}|${t.name}`.toLowerCase(), t.id);
  }
  for (const c of model.columns) if (c.deleted_at === null && systemTables.has(c.source_table_id)) columnsOfTable(c.source_table_id).set(lower(c.name), c.id);

  for (const t of plan.tables) {
    if (!t.file) {
      // a table not in the file: missing, with its columns (P3)
      if (t.status === "missing") changes.tables.update.push({ id: t.existing!.id, version: t.existing!.version, patch: { missing_since: ctx.now } });
      for (const c of t.columns) if (c.status === "missing") changes.columns.update.push({ id: c.existing!.id, version: c.existing!.version, patch: { missing_since: ctx.now } });
      continue;
    }
    const ft = t.file;
    let tableId: Uuid;
    if (t.existing) {
      const et = t.existing;
      tableId = et.id;
      const patch: Partial<ImportTable> = {};
      if (fields.has("table_comment") && (et.comment ?? null) !== ft.comment) patch.comment = ft.comment;
      if (fields.has("file_format") && (et.file_format ?? null) !== ft.fileFormat) patch.file_format = ft.fileFormat;
      if (fields.has("object_type") && et.object_type !== ft.objectType) patch.object_type = ft.objectType;
      if (t.rows) patch.row_count = t.rows.after;
      if (et.missing_since) patch.missing_since = null;
      if (Object.keys(patch).length) changes.tables.update.push({ id: et.id, version: et.version, patch });
    } else {
      tableId = ctx.newId();
      changes.tables.insert.push({
        id: tableId,
        source_system_id: systemId,
        database_name: ft.database,
        schema_name: ft.schema,
        name: ft.name,
        object_type: ft.objectType,
        file_format: ft.fileFormat,
        row_count: ft.rowCount,
        comment: ft.comment,
      });
    }
    tableIdByKey.set(t.key, tableId);
    const names = columnsOfTable(tableId);

    for (const c of t.columns) {
      if (c.status === "missing") {
        changes.columns.update.push({ id: c.existing!.id, version: c.existing!.version, patch: { missing_since: ctx.now } });
        continue;
      }
      if (c.status === "still_missing" || !c.file) continue;
      const fc = c.file;
      if (!c.existing) {
        const id = ctx.newId();
        names.set(lower(fc.name), id);
        changes.columns.insert.push({
          id,
          source_table_id: tableId,
          name: fc.name,
          ordinal: fc.ordinal,
          data_type: fc.data_type,
          type_length: fc.type_length,
          type_precision: fc.type_precision,
          type_scale: fc.type_scale,
          is_nullable: fc.is_nullable,
          is_primary_key: fc.is_primary_key,
          is_foreign_key: fc.is_foreign_key,
          // P11: Business key and PII from the file on a new column; a re-import never changes them (P1)
          is_business_key: fc.is_business_key,
          is_pii: fc.is_pii,
          comment: fc.comment,
        });
        continue;
      }
      const ec = c.existing;
      names.set(lower(fc.name), ec.id);
      const patch: Partial<ImportColumn> = {};
      if (ec.name !== fc.name) patch.name = fc.name;
      if (ec.ordinal !== fc.ordinal) patch.ordinal = fc.ordinal;
      if (!sameColumnType(ec, fc)) Object.assign(patch, { data_type: fc.data_type, type_length: fc.type_length, type_precision: fc.type_precision, type_scale: fc.type_scale });
      if (fields.has("nullable") && ec.is_nullable !== fc.is_nullable) patch.is_nullable = fc.is_nullable;
      if (fields.has("primary_key") && ec.is_primary_key !== fc.is_primary_key) patch.is_primary_key = fc.is_primary_key;
      if (fields.has("fk_name") && ec.is_foreign_key !== fc.is_foreign_key) patch.is_foreign_key = fc.is_foreign_key;
      if (fields.has("column_comment") && (ec.comment ?? null) !== fc.comment) patch.comment = fc.comment;
      if (ec.missing_since) patch.missing_since = null;
      if (Object.keys(patch).length) changes.columns.update.push({ id: ec.id, version: ec.version, patch });
    }
  }

  // relationships between source tables
  const pairIds = (fromId: Uuid, toId: Uuid, pairs: readonly { from: string; to: string }[]) =>
    pairs.map((p) => ({ from: columnIds.get(fromId)?.get(lower(p.from)), to: columnIds.get(toId)?.get(lower(p.to)) }));
  for (const r of plan.relationships) {
    if (r.status === "unchanged" || r.status === "still_missing") continue;
    if (r.status === "missing") {
      changes.relationships.update.push({ id: r.existing!.id, version: r.existing!.version, patch: { missing_since: ctx.now } });
      continue;
    }
    const fromId = tableIdByKey.get(r.fromKey), toId = tableIdByKey.get(r.toKey);
    if (!fromId || !toId) continue;
    const ids = pairIds(fromId, toId, r.pairs);
    if (ids.some((p) => !p.from || !p.to)) continue;
    const insertPairs = (relationshipId: Uuid) =>
      ids.forEach((p, i) =>
        changes.relationshipColumns.insert.push({ id: ctx.newId(), source_relationship_id: relationshipId, from_column_id: p.from!, to_column_id: p.to!, sort_order: i }),
      );
    if (!r.existing) {
      const id = ctx.newId();
      changes.relationships.insert.push({ id, source_table_id: fromId, to_source_table_id: toId, name: r.name, kind: "declared" });
      insertPairs(id);
      continue;
    }
    const er = r.existing;
    const patch: { to_source_table_id?: Uuid; missing_since?: Timestamp | null } = {};
    if (er.to_source_table_id !== toId) patch.to_source_table_id = toId;
    if (er.missing_since) patch.missing_since = null;
    const old = [...er.columns].sort((a, b) => a.sort_order - b.sort_order);
    const samePairs = old.length === ids.length && old.every((c, i) => c.from_column_id === ids[i]!.from && c.to_column_id === ids[i]!.to);
    if (!samePairs) {
      changes.relationshipColumns.remove.push(...old.map((c) => c.id));
      insertPairs(er.id);
    }
    if (Object.keys(patch).length || !samePairs) changes.relationships.update.push({ id: er.id, version: er.version, patch });
  }

  // mappings (P6)
  for (const m of plan.mappings) {
    const patch: Partial<ImportMapping> = {};
    if (m.ruleAfter !== null) patch.rule_expression = m.ruleAfter;
    if (m.sendsBack) Object.assign(patch, { status: "review", approved_by: null, approved_at: null, review_reason: m.reasons.join("; ") });
    if (Object.keys(patch).length) changes.mappings.push({ id: m.mappingId, version: m.version, patch });
  }
  return { ok: true, changes };
}
