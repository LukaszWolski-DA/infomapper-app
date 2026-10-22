// The import's plan (slice 7a, PRD items 22–32; prototype `buildPlan`, `diffCols`, `massWarn` and the mapping rule of
// `applyPlan`): what an import of a read file into a system would do, before anything is written. One mechanism for the
// first import and every re-import. Pure: the same model, file and choices give the same plan (P8 compares two).
//   Tables are matched by database.schema.table, columns by name within their table, both ignoring case; relationships
//   by foreign key name on their from-table. A field the file leaves out is never compared (P2).
//   Missing is judged only inside the scope (P4): the schemas of the selected tables, or only the columns of the
//   selected tables. Nothing is deleted: missing is a status (P3).
//   Renames are the modeller's choice; the engine suggests one where a gone column and a new one share position and
//   type (P5).
//   Mappings (P6, per input, AD-26): an approved mapping goes back to review when an input gets a type conflict it did
//   not have, an input marked business key changes type, or a renamed input is named in its rule (rewritten).
//   Position changes are written and shown among the unchanged columns (step 1, answer 11); a comment the file would
//   overwrite shows as a change (answer 8).

import type { Uuid } from "../ids";
import { columnTypeKey, sameColumnType } from "../model/column-type";
import { checkMappingTypes, formatAttributeType, formatColumnType, type ColumnType } from "../model/type-check";
import type { Attribute, MappingStatus } from "../types";
import type { ImportColumn, ImportMapping, ImportModel, ImportRelationship, ImportTable } from "./model";
import { tableKey, type StandardColumn, type StandardField, type StandardRead, type StandardTable } from "./standard";

export type ImportTarget = { systemId: Uuid } | { newName: string };

/** What a missing table or column is judged against (P4). */
export type MissingScope = "schemas" | "tables";

export interface PlanChoices {
  /** Keys of the file's tables this import covers; all of them at first. */
  scope: ReadonlySet<string>;
  compare: MissingScope;
  /** Rename choices by gone column (`RenameChoice.key`): the new column's name, or "" for “removed”. Absent: the suggestion. */
  renames: ReadonlyMap<string, string>;
}

export type TableStatus = "new" | "changed" | "unchanged" | "missing" | "still_missing" | "back";
export type ColumnStatus = TableStatus | "rename";
export type RelationshipStatus = "new" | "changed" | "unchanged" | "missing" | "still_missing" | "back";

export interface FieldChange {
  field: "name" | "type" | "nullable" | "primary key" | "foreign key" | "comment" | "file format" | "object type";
  before: string;
  after: string;
}

export interface PlanColumn {
  status: ColumnStatus;
  existing: ImportColumn | null;
  file: StandardColumn | null;
  /** What the source changes (empty for unchanged, new and missing columns). */
  changes: FieldChange[];
  /** A new physical position, written but not a change (answer 11). */
  position: { before: number; after: number } | null;
  /** The rename choice this column belongs to: the gone column's key. */
  renameKey: string | null;
  /** The file's Business key / PII when they differ from the column's (item 11: “your classifications are kept”). */
  fileClassifications: string[] | null;
  /** Live mappings reading the column (`ImportPlan.mappings` has their impact). */
  mappingIds: Uuid[];
}

export interface PlanTable {
  key: string;
  status: TableStatus;
  file: StandardTable | null;
  existing: ImportTable | null;
  /** Comment, file format and object type changes (P2: only fields the file has). */
  meta: FieldChange[];
  /** Row count before and after, when the file gives a different one (written, not a change). */
  rows: { before: number | null; after: number } | null;
  columns: PlanColumn[];
}

export interface PlanRelationship {
  status: RelationshipStatus;
  name: string;
  fromKey: string;
  toKey: string;
  /** `schema.table` of each end. */
  fromLabel: string;
  toLabel: string;
  /** Column names, from-table → to-table, as the file declares them (empty for a missing one). */
  pairs: { from: string; to: string }[];
  existing: ImportRelationship | null;
}

export interface RenameChoice {
  /** `table key|column name` in lower case. */
  key: string;
  tableKey: string;
  fromId: Uuid;
  from: string;
  /** The new column chosen, or "" for removed. */
  choice: string;
  /** The suggestion: same position and type (P5); "" when none. */
  suggested: string;
  /** The table's new columns not chosen by another gone column. */
  options: string[];
}

export interface MappingImpact {
  mappingId: Uuid;
  version: number;
  attributeId: Uuid;
  /** “Customer.email” */
  label: string;
  status: MappingStatus;
  /** Approved and at least one reason (P6): the mapping goes back to review. */
  sendsBack: boolean;
  /** P6's reasons, in input order; a draft or review mapping has them too (its status stays). */
  reasons: string[];
  /** Inputs that do not fit after the import: “varchar(255) into string(120)”. */
  conflicts: { columnId: Uuid; short: string }[];
  /** Inputs that had a type problem and fit after the import. */
  fitsAgain: Uuid[];
  /** The rule after renamed inputs are rewritten; null when it stays. */
  ruleAfter: string | null;
}

export interface ImportPlan {
  target: ImportTarget;
  /** The system's name, or the new name. */
  systemName: string;
  /** Stop the import (a taken name, a system that differs only in case…); the review cannot go on. */
  errors: string[];
  /** The reader's warnings, then the plan's (unresolved foreign keys). */
  warnings: string[];
  fields: ReadonlySet<StandardField>;
  compare: MissingScope;
  tables: PlanTable[];
  relationships: PlanRelationship[];
  renames: RenameChoice[];
  mappings: MappingImpact[];
  /** Item 23: more than half of the system's present columns would be marked missing. */
  massWarning: { missing: number; present: number } | null;
}

const lower = (s: string) => s.toLowerCase();
const yesNo = (b: boolean) => (b ? "yes" : "no");
const isLive = (r: { deleted_at: string | null }) => r.deleted_at === null;
const renameKeyOf = (key: string, column: string) => `${key}|${lower(column)}`;
const typeOf = (c: ColumnType): ColumnType => ({ data_type: c.data_type, type_length: c.type_length, type_precision: c.type_precision, type_scale: c.type_scale });

/** What the source owns on a column (P1), compared only where the file has the field (P2). */
function columnChanges(e: ImportColumn, f: StandardColumn, fields: ReadonlySet<StandardField>): FieldChange[] {
  const out: FieldChange[] = [];
  if (e.name !== f.name) out.push({ field: "name", before: e.name, after: f.name });
  if (!sameColumnType(e, f)) out.push({ field: "type", before: formatColumnType(e), after: formatColumnType(f) });
  if (fields.has("nullable") && e.is_nullable !== f.is_nullable) out.push({ field: "nullable", before: yesNo(e.is_nullable), after: yesNo(f.is_nullable) });
  if (fields.has("primary_key") && e.is_primary_key !== f.is_primary_key) out.push({ field: "primary key", before: yesNo(e.is_primary_key), after: yesNo(f.is_primary_key) });
  if (fields.has("fk_name") && e.is_foreign_key !== f.is_foreign_key) out.push({ field: "foreign key", before: yesNo(e.is_foreign_key), after: yesNo(f.is_foreign_key) });
  if (fields.has("column_comment") && (e.comment ?? "") !== (f.comment ?? "")) out.push({ field: "comment", before: e.comment || "–", after: f.comment || "–" });
  return out;
}

function tableMeta(e: ImportTable, f: StandardTable, fields: ReadonlySet<StandardField>): FieldChange[] {
  const out: FieldChange[] = [];
  if (fields.has("table_comment") && (e.comment ?? "") !== (f.comment ?? "")) out.push({ field: "comment", before: e.comment || "–", after: f.comment || "–" });
  if (fields.has("file_format") && (e.file_format ?? "") !== (f.fileFormat ?? "")) out.push({ field: "file format", before: e.file_format || "–", after: f.fileFormat || "–" });
  if (fields.has("object_type") && e.object_type !== f.objectType) out.push({ field: "object type", before: e.object_type, after: f.objectType });
  return out;
}

/** The file's Business key / PII names when they differ from the column's flags (item 11). */
function classificationNote(e: ImportColumn, f: StandardColumn, fields: ReadonlySet<StandardField>): string[] | null {
  if (!fields.has("classifications") || !f.classifications.length) return null;
  return f.is_business_key !== e.is_business_key || f.is_pii !== e.is_pii ? f.classifications : null;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A rule with renamed column names rewritten, whole words, ignoring case; null when nothing changes. */
export function rewriteRule(rule: string, renames: ReadonlyMap<string, string>): string | null {
  if (!renames.size) return null;
  const names = [...renames.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const re = new RegExp(`(?<![\\w$#@])(${names.join("|")})(?![\\w$#@])`, "gi");
  const out = rule.replace(re, (m) => renames.get(lower(m)) ?? m);
  return out === rule ? null : out;
}

export function buildPlan(model: ImportModel, read: StandardRead, target: ImportTarget, choices: PlanChoices): ImportPlan {
  const errors: string[] = [];
  const warnings = [...read.warnings];
  const fields = read.fields;
  const systems = model.systems.filter(isLive);
  let systemId: Uuid | null = null;
  let systemName: string;
  if ("systemId" in target) {
    const system = systems.find((s) => s.id === target.systemId);
    if (!system) errors.push("That source system no longer exists.");
    systemId = system?.id ?? null;
    systemName = system?.name ?? "";
  } else {
    systemName = target.newName.trim();
    if (!systemName) errors.push("Name the new system.");
    else if (systems.some((s) => lower(s.name) === lower(systemName))) {
      errors.push(`A system named ${systemName} already exists. Pick it under “An existing system”.`);
    }
  }

  // the system's live tables and columns, indexed
  const existing = systemId ? model.tables.filter((t) => isLive(t) && t.source_system_id === systemId) : [];
  const exByKey = new Map<string, ImportTable>();
  for (const t of existing) {
    const k = tableKey(t.database_name, t.schema_name, t.name);
    const twin = exByKey.get(k);
    if (twin) errors.push(`${systemName} has two tables that differ only in case: ${twin.schema_name}.${twin.name} and ${t.schema_name}.${t.name}.`);
    else exByKey.set(k, t);
  }
  const tableIds = new Set(existing.map((t) => t.id));
  const colsOf = new Map<Uuid, ImportColumn[]>();
  for (const c of model.columns) {
    if (!isLive(c) || !tableIds.has(c.source_table_id)) continue;
    const list = colsOf.get(c.source_table_id);
    if (list) list.push(c);
    else colsOf.set(c.source_table_id, [c]);
  }
  for (const list of colsOf.values()) list.sort((a, b) => a.ordinal - b.ordinal);
  const liveMappings = new Map(model.mappings.filter(isLive).map((m) => [m.id, m]));
  const inputsOf = new Map<Uuid, Uuid[]>(); // mapping → columns, in rule order
  const mappingsOfColumn = new Map<Uuid, Uuid[]>();
  for (const i of [...model.mappingInputs].filter((i) => isLive(i) && liveMappings.has(i.mapping_id)).sort((a, b) => a.sort_order - b.sort_order)) {
    (inputsOf.get(i.mapping_id) ?? inputsOf.set(i.mapping_id, []).get(i.mapping_id)!).push(i.source_column_id);
    (mappingsOfColumn.get(i.source_column_id) ?? mappingsOfColumn.set(i.source_column_id, []).get(i.source_column_id)!).push(i.mapping_id);
  }
  const mappingIdsOf = (columnId: Uuid | undefined) => (columnId ? (mappingsOfColumn.get(columnId) ?? []) : []);

  const inScope = read.tables.filter((t) => choices.scope.has(t.key));
  const schemasInScope = new Set(inScope.map((t) => `${lower(t.database)}|${lower(t.schema)}`));
  const tables: PlanTable[] = [];
  const renames: RenameChoice[] = [];

  for (const ft of inScope) {
    const et = exByKey.get(ft.key) ?? null;
    if (!et) {
      tables.push({
        key: ft.key,
        status: "new",
        file: ft,
        existing: null,
        meta: [],
        rows: null,
        columns: ft.columns.map((fc) => ({ status: "new", existing: null, file: fc, changes: [], position: null, renameKey: null, fileClassifications: null, mappingIds: [] })),
      });
      continue;
    }
    const ecols = colsOf.get(et.id) ?? [];
    const byName = new Map<string, ImportColumn>();
    for (const c of ecols) {
      const twin = byName.get(lower(c.name));
      if (twin) errors.push(`${et.schema_name}.${et.name} in ${systemName} has two columns that differ only in case: ${twin.name} and ${c.name}.`);
      else byName.set(lower(c.name), c);
    }
    const columns: PlanColumn[] = [];
    const used = new Set<Uuid>();
    const unmatched: StandardColumn[] = [];
    for (const fc of ft.columns) {
      const ec = byName.get(lower(fc.name));
      if (!ec) {
        unmatched.push(fc);
        continue;
      }
      used.add(ec.id);
      const changes = columnChanges(ec, fc, fields);
      columns.push({
        status: ec.missing_since ? "back" : changes.length ? "changed" : "unchanged",
        existing: ec,
        file: fc,
        changes,
        position: ec.ordinal !== fc.ordinal ? { before: ec.ordinal, after: fc.ordinal } : null,
        renameKey: null,
        fileClassifications: classificationNote(ec, fc, fields),
        mappingIds: mappingIdsOf(ec.id),
      });
    }
    const gone = ecols.filter((c) => !used.has(c.id));
    // renames (P5): a suggestion where position and type agree; the modeller may pair any gone column with any new one
    const active = gone.filter((c) => !c.missing_since);
    const suggestion = new Map<Uuid, string>();
    const suggested = new Set<string>();
    for (const fc of unmatched) {
      const cand = active.find((c) => !suggestion.has(c.id) && c.ordinal === fc.ordinal && sameColumnType(c, fc));
      if (cand && !suggested.has(fc.name)) {
        suggestion.set(cand.id, fc.name);
        suggested.add(fc.name);
      }
    }
    const pairOf = new Map<Uuid, string>();
    const taken = new Set<string>();
    for (const c of active) {
      const key = renameKeyOf(ft.key, c.name);
      const wanted = choices.renames.has(key) ? choices.renames.get(key)! : (suggestion.get(c.id) ?? "");
      if (wanted && !taken.has(wanted) && unmatched.some((f) => f.name === wanted)) {
        pairOf.set(c.id, wanted);
        taken.add(wanted);
      }
    }
    for (const c of active) {
      if (!unmatched.length) continue;
      const key = renameKeyOf(ft.key, c.name);
      const mine = pairOf.get(c.id) ?? "";
      renames.push({
        key,
        tableKey: ft.key,
        fromId: c.id,
        from: c.name,
        choice: mine,
        suggested: suggestion.get(c.id) ?? "",
        // a new column paired elsewhere is not offered (item 26)
        options: unmatched.map((f) => f.name).filter((n) => n === mine || !taken.has(n)),
      });
    }
    for (const fc of unmatched) {
      const ec = active.find((c) => pairOf.get(c.id) === fc.name);
      if (ec) {
        columns.push({
          status: "rename",
          existing: ec,
          file: fc,
          changes: columnChanges(ec, fc, fields),
          position: ec.ordinal !== fc.ordinal ? { before: ec.ordinal, after: fc.ordinal } : null,
          renameKey: renameKeyOf(ft.key, ec.name),
          fileClassifications: classificationNote(ec, fc, fields),
          mappingIds: mappingIdsOf(ec.id),
        });
      } else {
        columns.push({ status: "new", existing: null, file: fc, changes: [], position: null, renameKey: null, fileClassifications: null, mappingIds: [] });
      }
    }
    for (const ec of gone) {
      if (pairOf.has(ec.id)) continue;
      columns.push({
        status: ec.missing_since ? "still_missing" : "missing",
        existing: ec,
        file: null,
        changes: [],
        position: null,
        renameKey: ec.missing_since || !unmatched.length ? null : renameKeyOf(ft.key, ec.name),
        fileClassifications: null,
        mappingIds: mappingIdsOf(ec.id),
      });
    }
    columns.sort((a, b) => (a.file ? a.file.ordinal : 1000000 + a.existing!.ordinal) - (b.file ? b.file.ordinal : 1000000 + b.existing!.ordinal));
    const meta = tableMeta(et, ft, fields);
    const status: TableStatus = et.missing_since
      ? "back"
      : meta.length || columns.some((c) => c.status !== "unchanged" && c.status !== "still_missing")
        ? "changed"
        : "unchanged";
    const rows = ft.rowCount !== null && ft.rowCount !== et.row_count ? { before: et.row_count, after: ft.rowCount } : null;
    tables.push({ key: ft.key, status, file: ft, existing: et, meta, rows, columns });
  }

  // the system's tables in an imported schema that are not in the file: missing (P4; never with "tables")
  if (choices.compare === "schemas") {
    const fileKeys = new Set(read.tables.map((t) => t.key));
    for (const [key, et] of exByKey) {
      if (fileKeys.has(key)) continue; // in the file: in scope above, or left out of the scope and untouched
      if (!schemasInScope.has(`${lower(et.database_name)}|${lower(et.schema_name)}`)) continue;
      tables.push({
        key,
        status: et.missing_since ? "still_missing" : "missing",
        file: null,
        existing: et,
        meta: [],
        rows: null,
        columns: (colsOf.get(et.id) ?? []).map((ec) => ({
          status: ec.missing_since ? "still_missing" : "missing",
          existing: ec,
          file: null,
          changes: [],
          position: null,
          renameKey: null,
          fileClassifications: null,
          mappingIds: mappingIdsOf(ec.id),
        })),
      });
    }
  }

  const relationships = planRelationships(model, inScope, exByKey, colsOf, tables, warnings);
  const mappings = planMappings(model, tables, liveMappings, inputsOf);

  let massWarning: ImportPlan["massWarning"] = null;
  if (systemId) {
    const present = existing.reduce((n, t) => n + (colsOf.get(t.id) ?? []).filter((c) => !c.missing_since).length, 0);
    const missing = tables.reduce((n, t) => n + t.columns.filter((c) => c.status === "missing").length, 0);
    if (present && missing > present / 2) massWarning = { missing, present };
  }

  return { target, systemName, errors, warnings, fields, compare: choices.compare, tables, relationships, renames, mappings, massWarning };
}

function planRelationships(
  model: ImportModel,
  inScope: readonly StandardTable[],
  exByKey: ReadonlyMap<string, ImportTable>,
  colsOf: ReadonlyMap<Uuid, ImportColumn[]>,
  tables: readonly PlanTable[],
  warnings: string[],
): PlanRelationship[] {
  const out: PlanRelationship[] = [];
  const fileByKey = new Map(inScope.map((t) => [t.key, t]));
  const existingIds = new Set([...exByKey.values()].map((t) => t.id));
  const tableById = new Map([...exByKey.values()].map((t) => [t.id, t]));
  // column names after the import: a renamed column has its new name, so a rename alone never changes a relationship
  const columnName = new Map<Uuid, string>();
  for (const list of colsOf.values()) for (const c of list) columnName.set(c.id, c.name);
  for (const t of tables) for (const c of t.columns) if (c.existing && c.file) columnName.set(c.existing.id, c.file.name);
  const rels = model.relationships.filter((r) => isLive(r) && existingIds.has(r.source_table_id));
  const relsFrom = new Map<Uuid, ImportRelationship[]>();
  for (const r of rels) (relsFrom.get(r.source_table_id) ?? relsFrom.set(r.source_table_id, []).get(r.source_table_id)!).push(r);
  const label = (t: { schema: string; name: string }) => `${t.schema}.${t.name}`;
  const keyOfTable = (t: ImportTable) => tableKey(t.database_name, t.schema_name, t.name);
  const missingTables = new Set(tables.filter((t) => t.status === "missing").map((t) => t.existing!.id));
  const seen = new Set<Uuid>();

  /** A target table's column names after the import, and its primary key. */
  const targetColumns = (key: string): { names: Map<string, string>; pk: string[] } | null => {
    const ft = fileByKey.get(key);
    if (ft) return { names: new Map(ft.columns.map((c) => [lower(c.name), c.name])), pk: ft.columns.filter((c) => c.is_primary_key).map((c) => c.name) };
    const et = exByKey.get(key);
    if (!et) return null;
    const cols = colsOf.get(et.id) ?? [];
    return { names: new Map(cols.map((c) => [lower(c.name), c.name])), pk: cols.filter((c) => c.is_primary_key).map((c) => c.name) };
  };

  for (const ft of inScope) {
    const et = exByKey.get(ft.key);
    const fromNames = new Set(ft.columns.map((c) => lower(c.name)));
    for (const fk of ft.foreignKeys) {
      const toKey = tableKey(ft.database, fk.toSchema, fk.toTable);
      const target = targetColumns(toKey);
      if (!target) {
        warnings.push(`Foreign key ${fk.name} on ${label(ft)} refers to ${fk.toSchema}.${fk.toTable}, which is neither in this file nor in the system. Relationship skipped.`);
        continue;
      }
      // a pair without its target column points at the target's primary key (as the DDL channel does)
      const pairs = fk.pairs.map((p, i) => ({ from: p.from, to: p.to || target.pk[i] || "" }));
      const unknown = pairs.find((p) => !fromNames.has(lower(p.from)) || !target.names.has(lower(p.to)));
      if (unknown) {
        warnings.push(`Foreign key ${fk.name} on ${label(ft)} names a column that is not in ${unknown.to && !target.names.has(lower(unknown.to)) ? `${fk.toSchema}.${fk.toTable}` : label(ft)}. Relationship skipped.`);
        continue;
      }
      const resolved = pairs.map((p) => ({ from: p.from, to: target.names.get(lower(p.to))! }));
      const er = et ? (relsFrom.get(et.id) ?? []).find((r) => lower(r.name) === lower(fk.name)) ?? null : null;
      let status: RelationshipStatus = "new";
      if (er) {
        seen.add(er.id);
        const toTable = tableById.get(er.to_source_table_id);
        const before = [...er.columns].sort((a, b) => a.sort_order - b.sort_order).map((c) => `${lower(columnName.get(c.from_column_id) ?? "")}→${lower(columnName.get(c.to_column_id) ?? "")}`).join(",");
        const after = resolved.map((p) => `${lower(p.from)}→${lower(p.to)}`).join(",");
        const sameTarget = !!toTable && keyOfTable(toTable) === toKey;
        status = er.missing_since ? "back" : before === after && sameTarget ? "unchanged" : "changed";
      }
      out.push({ status, name: fk.name, fromKey: ft.key, toKey, fromLabel: label(ft), toLabel: `${fk.toSchema}.${fk.toTable}`, pairs: resolved, existing: er });
    }
  }
  // relationships the file no longer declares on its tables, and those of a missing table (item 32)
  for (const r of rels) {
    if (seen.has(r.id)) continue;
    const from = tableById.get(r.source_table_id)!;
    const to = tableById.get(r.to_source_table_id);
    const fromInFile = fileByKey.has(keyOfTable(from));
    const endMissing = missingTables.has(r.source_table_id) || missingTables.has(r.to_source_table_id);
    if (!fromInFile && !endMissing) continue;
    out.push({
      status: r.missing_since ? "still_missing" : "missing",
      name: r.name,
      fromKey: keyOfTable(from),
      toKey: to ? keyOfTable(to) : "",
      fromLabel: `${from.schema_name}.${from.name}`,
      toLabel: to ? `${to.schema_name}.${to.name}` : "?",
      pairs: [],
      existing: r,
    });
  }
  return out;
}

function planMappings(model: ImportModel, tables: readonly PlanTable[], liveMappings: ReadonlyMap<Uuid, ImportMapping>, inputsOf: ReadonlyMap<Uuid, Uuid[]>): MappingImpact[] {
  // the columns whose type or name the import changes
  const after = new Map<Uuid, { type: ColumnType; name: string; before: ImportColumn }>();
  for (const t of tables) {
    for (const c of t.columns) {
      if (!c.existing || !c.file || (c.status !== "changed" && c.status !== "rename" && c.status !== "back")) continue;
      if (sameColumnType(c.existing, c.file) && c.existing.name === c.file.name) continue;
      after.set(c.existing.id, { type: typeOf(c.file), name: c.file.name, before: c.existing });
    }
  }
  if (!after.size) return [];
  const columnById = new Map(model.columns.map((c) => [c.id, c]));
  const attributes = new Map<Uuid, Attribute>(model.attributes.map((a) => [a.id, a]));
  const entities = new Map(model.entities.map((e) => [e.id, e]));
  const out: MappingImpact[] = [];
  for (const [mappingId, inputs] of inputsOf) {
    if (!inputs.some((id) => after.has(id))) continue;
    const m = liveMappings.get(mappingId)!;
    const attribute = attributes.get(m.attribute_id);
    if (!attribute) continue;
    const beforeCols = inputs.map((id) => ({ id, ...typeOf(columnById.get(id)!) }));
    const afterCols = inputs.map((id) => ({ id, ...(after.get(id)?.type ?? typeOf(columnById.get(id)!)) }));
    const renamed = new Map<string, string>();
    for (const id of inputs) {
      const a = after.get(id);
      if (a && lower(a.before.name) !== lower(a.name)) renamed.set(lower(a.before.name), a.name);
    }
    const ruleAfter = m.rule_expression ? rewriteRule(m.rule_expression, renamed) : null;
    const checkBefore = checkMappingTypes(m, attribute, beforeCols);
    const checkAfter = checkMappingTypes({ kind: m.kind, rule_expression: ruleAfter ?? m.rule_expression }, attribute, afterCols);
    const problemBefore = new Set(checkBefore.problems.map((p) => p.source_column_id));
    const problemAfter = new Set(checkAfter.problems.map((p) => p.source_column_id));
    const reasons: string[] = [];
    const conflicts: MappingImpact["conflicts"] = [];
    for (const id of inputs) {
      const a = after.get(id);
      const col = afterCols.find((c) => c.id === id)!;
      const short = `${formatColumnType(col)} into ${formatAttributeType(attribute)}`;
      if (problemAfter.has(id)) conflicts.push({ columnId: id, short });
      if (!a) continue;
      if (problemAfter.has(id) && !problemBefore.has(id)) reasons.push(`type conflict, ${short}`);
      if (a.before.is_business_key && columnTypeKey(a.before) !== columnTypeKey(a.type)) {
        reasons.push(`business key column changed type, ${formatColumnType(a.before)} → ${formatColumnType(a.type)}`);
      }
    }
    if (ruleAfter) reasons.push(`its rule now reads ${ruleAfter}`);
    const fitsAgain = inputs.filter((id) => problemBefore.has(id) && !problemAfter.has(id));
    if (!reasons.length && !fitsAgain.length && !conflicts.length) continue;
    const entity = entities.get(attribute.entity_id);
    out.push({
      mappingId,
      version: m.version,
      attributeId: attribute.id,
      label: `${entity?.name ?? "?"}.${attribute.name}`,
      status: m.status,
      sendsBack: m.status === "approved" && reasons.length > 0,
      reasons,
      conflicts,
      fitsAgain,
      ruleAfter,
    });
  }
  return out;
}

/** The import's counts (item 4's columns; the summary of item 28). */
export interface ImportCounts {
  tables_new: number;
  columns_new: number;
  columns_changed: number;
  columns_renamed: number;
  columns_missing: number;
  relationships_new: number;
}

export function planCounts(plan: ImportPlan): ImportCounts {
  const counts: ImportCounts = { tables_new: 0, columns_new: 0, columns_changed: 0, columns_renamed: 0, columns_missing: 0, relationships_new: 0 };
  for (const t of plan.tables) {
    if (t.status === "new") counts.tables_new++;
    for (const c of t.columns) {
      if (c.status === "new") counts.columns_new++;
      else if (c.status === "changed" || c.status === "back") counts.columns_changed++;
      else if (c.status === "rename") counts.columns_renamed++;
      else if (c.status === "missing") counts.columns_missing++;
    }
  }
  counts.relationships_new = plan.relationships.filter((r) => r.status === "new").length;
  return counts;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** “2 new tables, 5 new columns, 1 changed column, 1 renamed column, 3 missing from source, 1 new relationship” (item 28). */
export function importSummary(k: ImportCounts): string {
  const parts: string[] = [];
  if (k.tables_new) parts.push(plural(k.tables_new, "new table"));
  if (k.columns_new) parts.push(plural(k.columns_new, "new column"));
  if (k.columns_changed) parts.push(plural(k.columns_changed, "changed column"));
  if (k.columns_renamed) parts.push(plural(k.columns_renamed, "renamed column"));
  if (k.columns_missing) parts.push(`${k.columns_missing} missing from source`);
  if (k.relationships_new) parts.push(plural(k.relationships_new, "new relationship"));
  return parts.join(", ") || "No changes";
}
