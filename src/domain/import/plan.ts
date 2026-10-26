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
//   Changes to resolve (slice 7b, P1, P4, P7; prototype `issue(...)` and `settle(...)` in `applyPlan`): what the import
//   raises (`raises`) and which open changes the source settles (`settles`) are part of the plan, so the review shows
//   them and P8 compares them. A first import of a system raises none; mapping changes only for mappings the import
//   sends back from approved (step 1, Q13).
//   Classifications (slice 7c, P6, P7; answers F9, F11–F13): each value of the file's `classifications` is matched to a
//   live column classification of the workspace's list by code or current name (`normClassification`); a new column is
//   written with what matched, an existing column keeps the modeller's and the review says when the file differs
//   (“The file says …”). An unknown value, and a table classification named on a column, is a warning, one per value
//   and table. Suggestions (`hints`) for new columns the file does not classify: Business key for the only primary key
//   column of a table with no business key (in the file or among its stored columns), Link key in Data Vault 2.0 mode
//   for a foreign key that is not a primary key; each needs its classification in the list. The business key rules
//   read the Business key classification's links by its code.

import type { Uuid } from "../ids";
import { indexOf, normClassification, type ClassificationIndex } from "../model/classifications";
import { columnTypeKey, sameColumnType } from "../model/column-type";
import { checkMappingTypes, formatAttributeType, formatColumnType, type ColumnType } from "../model/type-check";
import { DETAIL } from "../source-changes/texts";
import type { Attribute, Classification, MappingStatus, SourceChange, SourceChangeKind, SourceChangeSeverity } from "../types";
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
  /** Suggested classifications the modeller unticked (`ClassificationHint.id`, slice 7c, P7). */
  hintsOff?: ReadonlySet<string>;
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
  /**
   * The file's classifications, by their current names, when they differ from an existing column's (item 11: “your
   * classifications are kept”; slice 7c: the whole list). Null for a new column and when the file names none.
   */
  fileClassifications: string[] | null;
  /** The live classifications the file's values matched, in list order (slice 7c): a new column is written with them. */
  classificationIds: Uuid[];
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
  /** The stored name when the file names the same relationship differently (a name change, “changed”). */
  renamedFrom: string | null;
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
  /** The change it raises when sent back (slice 7b): type conflict before business key before rule (prototype). */
  kind: "type_conflict" | "business_key_changed" | "rule_updated" | null;
  /** The first input the import changes; the change names it. */
  columnId: Uuid | null;
}

/** A change to resolve the import raises (slice 7b, item 6); new tables and columns get their ids when applied. */
export interface PlannedRaise {
  kind: SourceChangeKind;
  severity: SourceChangeSeverity;
  tableKey: string;
  /** The existing table, or null for a new one (found by `tableKey` when applied). */
  tableId: Uuid | null;
  /** The existing column; a new column is named by `columnName`. */
  columnId: Uuid | null;
  columnName: string | null;
  mappingId: Uuid | null;
  objectLabel: string;
  detail: string;
}

/** A suggested classification for a new column (slice 7c, P7; prototype `plan.hints`); ticked unless in `hintsOff`. */
export interface ClassificationHint {
  /** `{table key}|{column name in lower case}|{code}`. */
  id: string;
  tableKey: string;
  column: string;
  code: "BK" | "LK";
  classificationId: Uuid;
  /** `schema.table.column` */
  label: string;
  why: string;
  on: boolean;
}

export const HINT_WHY = {
  BK: "the only primary key column, and the table has no business key",
  LK: "a foreign key: a candidate for a link between hubs",
} as const;

/** One warning per value and table (answer F13; Łukasz's texts, step 2). */
const where = (row: number, n: number) => `(row ${row}${n ? `; ${n.toLocaleString("en-GB")} more row${n === 1 ? "" : "s"} in this table` : ""})`;
export const UNKNOWN_CLASSIFICATION = (row: number, value: string, column: string, others: number) =>
  `Unknown classification “${value}” on ${column} ${where(row, others)}, ignored. Add it to the classification list (“Edit the list…” in a table or column panel) to use it.`;
export const TABLE_CLASSIFICATION_ON_COLUMN = (row: number, value: string, column: string, others: number) =>
  `“${value}” is a table classification; ignored on ${column} ${where(row, others)}.`;

/** An open change the source settles (P7): its column or table is back, or a new one left before a decision. */
export interface PlannedSettle {
  changeId: Uuid;
  version: number;
  why: "back" | "left_before_decision";
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
  /** The file's tables that cannot be selected (names that differ only in case in the system), with the reason. */
  leftOut: { key: string; reason: string }[];
  tables: PlanTable[];
  relationships: PlanRelationship[];
  renames: RenameChoice[];
  mappings: MappingImpact[];
  /** Item 23: more than half of the system's present columns would be marked missing. */
  massWarning: { missing: number; present: number } | null;
  /** Changes to resolve it raises, in table order, then the mappings it sends back (slice 7b). */
  raises: PlannedRaise[];
  /** Open changes the source settles (slice 7b, P7). */
  settles: PlannedSettle[];
  /** Suggested classifications for new columns (slice 7c, P7). */
  hints: ClassificationHint[];
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

/** The file's values matched to the list (slice 7c, P6): live classifications by code and by name, per scope. */
interface Matcher {
  column: ReadonlyMap<string, Classification>;
  table: ReadonlyMap<string, Classification>;
}

function matcherOf(cls: ClassificationIndex): Matcher {
  const column = new Map<string, Classification>(), table = new Map<string, Classification>();
  for (const c of cls.list) {
    const m = c.scope === "column" ? column : table;
    m.set(c.name_key, c);
    if (c.code !== null) m.set(normClassification(c.code), c);
  }
  return { column, table };
}

/** The file's classifications by name when they differ from the column's (item 11), else null. */
function fileSays(cls: ClassificationIndex, columnId: Uuid, matched: readonly Uuid[]): string[] | null {
  if (!matched.length) return null;
  const mine = new Set(cls.of(columnId).map((c) => c.id));
  const same = mine.size === matched.length && matched.every((id) => mine.has(id));
  return same ? null : matched.map((id) => cls.byId.get(id)!.name);
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

export const TABLES_IN_CASE = (system: string, a: string, b: string) =>
  `${system} has two tables whose names differ only in case, ${a} and ${b}, so the file's table cannot be matched to one of them. It is left out of this import; rename or delete one of the two first.`;
export const COLUMNS_IN_CASE = (system: string, table: string, a: string, b: string) =>
  `${table} in ${system} has two columns whose names differ only in case, ${a} and ${b}. The table is left out of this import; rename or delete one of the two first.`;

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
  // names that differ only in case cannot be matched: those tables are left out, the rest is imported (step 3, answer 1)
  const blocked = new Map<string, string>();
  for (const t of existing) {
    const k = tableKey(t.database_name, t.schema_name, t.name);
    const twin = exByKey.get(k);
    if (twin) blocked.set(k, TABLES_IN_CASE(systemName, `${twin.schema_name}.${twin.name}`, `${t.schema_name}.${t.name}`));
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
  for (const [k, t] of exByKey) {
    if (blocked.has(k)) continue;
    const seenNames = new Map<string, string>();
    for (const c of colsOf.get(t.id) ?? []) {
      const twin = seenNames.get(lower(c.name));
      if (twin !== undefined) {
        blocked.set(k, COLUMNS_IN_CASE(systemName, `${t.schema_name}.${t.name}`, twin, c.name));
        break;
      }
      seenNames.set(lower(c.name), c.name);
    }
  }
  const fileKeys = new Set(read.tables.map((t) => t.key));
  const liveMappings = new Map(model.mappings.filter(isLive).map((m) => [m.id, m]));
  const inputsOf = new Map<Uuid, Uuid[]>(); // mapping → columns, in rule order
  const mappingsOfColumn = new Map<Uuid, Uuid[]>();
  for (const i of [...model.mappingInputs].filter((i) => isLive(i) && liveMappings.has(i.mapping_id)).sort((a, b) => a.sort_order - b.sort_order)) {
    (inputsOf.get(i.mapping_id) ?? inputsOf.set(i.mapping_id, []).get(i.mapping_id)!).push(i.source_column_id);
    (mappingsOfColumn.get(i.source_column_id) ?? mappingsOfColumn.set(i.source_column_id, []).get(i.source_column_id)!).push(i.mapping_id);
  }
  const mappingIdsOf = (columnId: Uuid | undefined) => (columnId ? (mappingsOfColumn.get(columnId) ?? []) : []);

  const leftOut = [...blocked].filter(([k]) => fileKeys.has(k)).map(([key, reason]) => ({ key, reason }));
  for (const b of leftOut) warnings.push(b.reason);
  const inScope = read.tables.filter((t) => choices.scope.has(t.key) && !blocked.has(t.key));
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
        columns: ft.columns.map((fc) => ({ status: "new", existing: null, file: fc, changes: [], position: null, renameKey: null, fileClassifications: null, classificationIds: [], mappingIds: [] })),
      });
      continue;
    }
    const ecols = colsOf.get(et.id) ?? [];
    const byName = new Map(ecols.map((c) => [lower(c.name), c]));
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
        fileClassifications: null,
        classificationIds: [],
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
      // a choice of a new column the file no longer has does not apply (P8's refresh): the suggestion does
      const chosen = choices.renames.get(key);
      const wanted = chosen !== undefined && (chosen === "" || unmatched.some((f) => f.name === chosen)) ? chosen : (suggestion.get(c.id) ?? "");
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
          fileClassifications: null,
          classificationIds: [],
          mappingIds: mappingIdsOf(ec.id),
        });
      } else {
        columns.push({ status: "new", existing: null, file: fc, changes: [], position: null, renameKey: null, fileClassifications: null, classificationIds: [], mappingIds: [] });
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
        classificationIds: [],
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
    for (const [key, et] of exByKey) {
      if (fileKeys.has(key)) continue; // in the file: in scope above, or left out of the scope and untouched
      if (!schemasInScope.has(`${lower(et.database_name)}|${lower(et.schema_name)}`)) continue;
      if (blocked.has(key)) {
        warnings.push(blocked.get(key)!);
        continue;
      }
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
          classificationIds: [],
          mappingIds: mappingIdsOf(ec.id),
        })),
      });
    }
  }

  const cls = indexOf(model);
  const hints = planClassifications(cls, model.dataVault ?? false, tables, warnings, choices.hintsOff);
  const relationships = planRelationships(model, inScope, exByKey, colsOf, tables, warnings, blocked);
  const mappings = planMappings(model, cls, tables, liveMappings, inputsOf);

  let massWarning: ImportPlan["massWarning"] = null;
  if (systemId) {
    const present = existing.reduce((n, t) => n + (colsOf.get(t.id) ?? []).filter((c) => !c.missing_since).length, 0);
    const missing = tables.reduce((n, t) => n + t.columns.filter((c) => c.status === "missing").length, 0);
    if (present && missing > present / 2) massWarning = { missing, present };
  }

  const { raises, settles } = planChanges(model, cls, systemId, tables, mappings, liveMappings, mappingsOfColumn);
  return { target, systemName, errors, warnings, fields, compare: choices.compare, leftOut, tables, relationships, renames, mappings, massWarning, raises, settles, hints };
}

/**
 * The file's classifications matched for every column in the file (slice 7c, P6), the warnings for values that match no
 * column classification (one per value and table, F13), and the suggestions for new columns (P7, F12). Fills each
 * column's `classificationIds` and `fileClassifications`.
 */
function planClassifications(cls: ClassificationIndex, dataVault: boolean, tables: PlanTable[], warnings: string[], hintsOff: ReadonlySet<string> | undefined): ClassificationHint[] {
  const match = matcherOf(cls);
  const order = new Map(cls.list.map((c, i) => [c.id, i]));
  const hints: ClassificationHint[] = [];
  const bk = cls.byCode.get("BK"), lk = cls.byCode.get("LK");
  for (const t of tables) {
    if (!t.file) continue;
    const tableLabel = `${t.file.schema}.${t.file.name}`;
    const odd = new Map<string, { kind: "unknown" | "table"; row: number; value: string; column: string; others: number }>();
    for (const c of t.columns) {
      if (!c.file || !c.file.classifications.length) continue;
      const ids: Uuid[] = [];
      for (const value of c.file.classifications) {
        const k = normClassification(value);
        const hit = match.column.get(k);
        if (hit) {
          if (!ids.includes(hit.id)) ids.push(hit.id);
          continue;
        }
        const kind = match.table.has(k) ? "table" : "unknown";
        const seen = odd.get(`${kind}|${k}`);
        if (seen) seen.others++;
        else odd.set(`${kind}|${k}`, { kind, row: c.file.line, value, column: `${tableLabel}.${c.file.name}`, others: 0 });
      }
      c.classificationIds = ids.sort((a, b) => order.get(a)! - order.get(b)!);
      if (c.existing) c.fileClassifications = fileSays(cls, c.existing.id, c.classificationIds);
    }
    for (const o of odd.values()) warnings.push((o.kind === "table" ? TABLE_CLASSIFICATION_ON_COLUMN : UNKNOWN_CLASSIFICATION)(o.row, o.value, o.column, o.others));

    // suggestions for the new columns the file does not classify
    const candidates = t.columns.filter((c) => c.status === "new" && c.file && !c.classificationIds.length);
    if (!candidates.length) continue;
    const primaryKeys = t.file.columns.filter((c) => c.is_primary_key).length;
    const hasBusinessKey =
      !!bk &&
      t.columns.some(
        (c) => (c.file && c.classificationIds.includes(bk.id)) || (c.existing && c.status !== "missing" && c.status !== "still_missing" && cls.has(c.existing.id, "BK")),
      );
    for (const c of candidates) {
      const fc = c.file!;
      const hint = (code: "BK" | "LK", classification: Classification) => {
        const id = `${t.key}|${fc.name.toLowerCase()}|${code}`;
        hints.push({ id, tableKey: t.key, column: fc.name, code, classificationId: classification.id, label: `${tableLabel}.${fc.name}`, why: HINT_WHY[code], on: !hintsOff?.has(id) });
      };
      if (bk && fc.is_primary_key && primaryKeys === 1 && !hasBusinessKey) hint("BK", bk);
      if (lk && dataVault && fc.is_foreign_key && !fc.is_primary_key) hint("LK", lk);
    }
  }
  return hints;
}

const isOpenChange = (c: SourceChange) => c.deleted_at === null && c.status === "open";

/**
 * What the import raises and settles (slice 7b, items 6–7; prototype `applyPlan`). Raised in an existing system only:
 * a table not in the file (`table_left`, high when one of its columns has an approved mapping); a column not in the file
 * of a table that is (`column_left`, high with an approved mapping on it); a new table (`new_table`); a new column in an
 * existing table (`new_column`); per mapping sent back from approved, its first reason's kind (high, unless only its rule
 * was rewritten); a business key column whose type changed and raised no mapping change (`business_key_changed`, high).
 * Settled: a table's or column's “left” change when it is back; a “new” change when it leaves before a decision.
 */
function planChanges(
  model: ImportModel,
  cls: ClassificationIndex,
  systemId: Uuid | null,
  tables: readonly PlanTable[],
  mappings: readonly MappingImpact[],
  liveMappings: ReadonlyMap<Uuid, ImportMapping>,
  mappingsOfColumn: ReadonlyMap<Uuid, Uuid[]>,
): { raises: PlannedRaise[]; settles: PlannedSettle[] } {
  const raises: PlannedRaise[] = [];
  const settles: PlannedSettle[] = [];
  if (!systemId) return { raises, settles };
  const open = (model.changes ?? []).filter((c) => isOpenChange(c) && c.source_system_id === systemId);
  const settled = new Set<Uuid>();
  const settleWhere = (match: (c: SourceChange) => boolean, why: PlannedSettle["why"]) => {
    for (const c of open) {
      if (!match(c) || settled.has(c.id)) continue;
      settled.add(c.id);
      settles.push({ changeId: c.id, version: c.version, why });
    }
  };
  const mappingsOn = (columnId: Uuid) => (mappingsOfColumn.get(columnId) ?? []).flatMap((id) => liveMappings.get(id) ?? []);
  const approvedOn = (columnId: Uuid) => mappingsOn(columnId).some((m) => m.status === "approved");
  const sentBack = mappings.filter((m) => m.sendsBack);
  const raisedOn = new Set(sentBack.map((m) => m.columnId));
  const placeOf = new Map<Uuid, { tableKey: string; tableId: Uuid; label: string }>();

  for (const t of tables) {
    const tableLabel = `${t.file?.schema ?? t.existing!.schema_name}.${t.file?.name ?? t.existing!.name}`;
    const tableId = t.existing?.id ?? null;
    const base = { tableKey: t.key, tableId, columnId: null, columnName: null, mappingId: null };
    if (t.status === "missing") {
      const gone = t.columns.filter((c) => c.status === "missing");
      raises.push({ ...base, kind: "table_left", severity: gone.some((c) => approvedOn(c.existing!.id)) ? "high" : "normal", objectLabel: tableLabel, detail: DETAIL.tableLeft(gone.length) });
      settleWhere((c) => c.kind === "new_table" && c.source_table_id === tableId, "left_before_decision");
    } else if (t.status === "new") {
      raises.push({ ...base, kind: "new_table", severity: "normal", objectLabel: tableLabel, detail: DETAIL.newTable(t.columns.length) });
      continue;
    } else if (t.status === "back") {
      settleWhere((c) => c.kind === "table_left" && c.source_table_id === tableId, "back");
    }
    for (const c of t.columns) {
      if (c.status === "unchanged" || c.status === "still_missing") continue;
      const columnName = c.file?.name ?? c.existing!.name;
      const label = `${tableLabel}.${columnName}`;
      if (c.existing && raisedOn.has(c.existing.id)) placeOf.set(c.existing.id, { tableKey: t.key, tableId: tableId!, label });
      if (c.status === "missing") {
        const id = c.existing!.id;
        settleWhere((x) => x.kind === "new_column" && x.source_column_id === id, "left_before_decision");
        if (t.status !== "missing") {
          raises.push({ ...base, kind: "column_left", severity: approvedOn(id) ? "high" : "normal", columnId: id, objectLabel: label, detail: DETAIL.columnLeft(formatColumnType(c.existing!), mappingsOn(id).length) });
        }
      } else if (c.status === "new" && t.existing) {
        raises.push({ ...base, kind: "new_column", severity: "normal", columnName, objectLabel: label, detail: DETAIL.newColumn(formatColumnType(c.file!)) });
      } else if (c.status === "back") {
        const id = c.existing!.id;
        settleWhere((x) => x.kind === "column_left" && x.source_column_id === id, "back");
      }
      // a business key column whose type changed and raised no mapping change (the prototype's second `bk`)
      if (c.existing && c.file && cls.has(c.existing.id, "BK") && !raisedOn.has(c.existing.id) && columnTypeKey(c.existing) !== columnTypeKey(c.file)) {
        raises.push({ ...base, kind: "business_key_changed", severity: "high", columnId: c.existing.id, objectLabel: label, detail: DETAIL.businessKeyChanged(formatColumnType(c.existing), formatColumnType(c.file)) });
      }
    }
  }
  for (const m of sentBack) {
    const place = m.columnId ? placeOf.get(m.columnId) : undefined;
    raises.push({
      kind: m.kind!,
      severity: m.kind === "rule_updated" ? "normal" : "high",
      tableKey: place?.tableKey ?? "",
      tableId: place?.tableId ?? null,
      columnId: m.columnId,
      columnName: null,
      mappingId: m.mappingId,
      objectLabel: place?.label ?? m.label,
      detail: DETAIL.mappingSentBack(m.label, m.reasons),
    });
  }
  return { raises, settles };
}

function planRelationships(
  model: ImportModel,
  inScope: readonly StandardTable[],
  exByKey: ReadonlyMap<string, ImportTable>,
  colsOf: ReadonlyMap<Uuid, ImportColumn[]>,
  tables: readonly PlanTable[],
  warnings: string[],
  blocked: ReadonlyMap<string, string>,
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
    const declared: { fk: StandardTable["foreignKeys"][number]; toKey: string; resolved: { from: string; to: string }[] }[] = [];
    for (const fk of ft.foreignKeys) {
      const toKey = tableKey(ft.database, fk.toSchema, fk.toTable);
      if (blocked.has(toKey)) {
        warnings.push(`Foreign key ${fk.name} on ${label(ft)} refers to ${fk.toSchema}.${fk.toTable}, which is left out of this import. Relationship skipped.`);
        continue;
      }
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
      declared.push({ fk, toKey, resolved: pairs.map((p) => ({ from: p.from, to: target.names.get(lower(p.to))! })) });
    }
    // an existing relationship is matched by its key's name, else by what it joins (step 4: SQL Server generates the
    // names of unnamed keys, so a DDL script and a catalog query can name one relationship differently)
    const existingHere = et ? (relsFrom.get(et.id) ?? []) : [];
    const pairsOf = (r: ImportRelationship) =>
      [...r.columns].sort((a, b) => a.sort_order - b.sort_order).map((c) => `${lower(columnName.get(c.from_column_id) ?? "")}→${lower(columnName.get(c.to_column_id) ?? "")}`).join(",");
    const targetOf = (r: ImportRelationship) => {
      const t = tableById.get(r.to_source_table_id);
      return t ? keyOfTable(t) : "";
    };
    const joins = (d: (typeof declared)[number]) => `${d.toKey}|${d.resolved.map((p) => `${lower(p.from)}→${lower(p.to)}`).join(",")}`;
    const match = new Map<(typeof declared)[number], ImportRelationship>();
    for (const d of declared) {
      const er = existingHere.find((r) => !seen.has(r.id) && lower(r.name) === lower(d.fk.name));
      if (er) {
        match.set(d, er);
        seen.add(er.id);
      }
    }
    for (const d of declared) {
      if (match.has(d)) continue;
      const er = existingHere.find((r) => !seen.has(r.id) && `${targetOf(r)}|${pairsOf(r)}` === joins(d));
      if (er) {
        match.set(d, er);
        seen.add(er.id);
      }
    }
    for (const d of declared) {
      const er = match.get(d) ?? null;
      let status: RelationshipStatus = "new";
      let renamedFrom: string | null = null;
      if (er) {
        const sameJoins = `${targetOf(er)}|${pairsOf(er)}` === joins(d);
        if (er.name !== d.fk.name) renamedFrom = er.name;
        status = er.missing_since ? "back" : sameJoins && !renamedFrom ? "unchanged" : "changed";
      }
      out.push({ status, name: d.fk.name, renamedFrom, fromKey: ft.key, toKey: d.toKey, fromLabel: label(ft), toLabel: `${d.fk.toSchema}.${d.fk.toTable}`, pairs: d.resolved, existing: er });
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
      renamedFrom: null,
      existing: r,
    });
  }
  return out;
}

function planMappings(model: ImportModel, cls: ClassificationIndex, tables: readonly PlanTable[], liveMappings: ReadonlyMap<Uuid, ImportMapping>, inputsOf: ReadonlyMap<Uuid, Uuid[]>): MappingImpact[] {
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
    let conflict = false, businessKey = false;
    for (const id of inputs) {
      const a = after.get(id);
      const col = afterCols.find((c) => c.id === id)!;
      const short = `${formatColumnType(col)} into ${formatAttributeType(attribute)}`;
      if (problemAfter.has(id)) conflicts.push({ columnId: id, short });
      if (!a) continue;
      if (problemAfter.has(id) && !problemBefore.has(id)) {
        reasons.push(`type conflict, ${short}`);
        conflict = true;
      }
      if (cls.has(a.before.id, "BK") && columnTypeKey(a.before) !== columnTypeKey(a.type)) {
        reasons.push(`business key column changed type, ${formatColumnType(a.before)} → ${formatColumnType(a.type)}`);
        businessKey = true;
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
      kind: conflict ? "type_conflict" : businessKey ? "business_key_changed" : ruleAfter ? "rule_updated" : null,
      columnId: inputs.find((id) => after.has(id)) ?? null,
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
  /** Changes to resolve it raises, and the high ones among them (slice 7b, item 8). */
  changes_raised: number;
  changes_high: number;
}

export function planCounts(plan: ImportPlan): ImportCounts {
  const counts: ImportCounts = {
    tables_new: 0,
    columns_new: 0,
    columns_changed: 0,
    columns_renamed: 0,
    columns_missing: 0,
    relationships_new: 0,
    changes_raised: plan.raises.length,
    changes_high: plan.raises.filter((r) => r.severity === "high").length,
  };
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

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

/**
 * “2 new tables, 5 new columns, 1 changed column, 1 renamed column, 3 missing from source, 1 new relationship” (item 28),
 * then “4 to resolve (2 high)” (slice 7b, item 8).
 */
export function importSummary(k: ImportCounts): string {
  const parts: string[] = [];
  if (k.tables_new) parts.push(plural(k.tables_new, "new table"));
  if (k.columns_new) parts.push(plural(k.columns_new, "new column"));
  if (k.columns_changed) parts.push(plural(k.columns_changed, "changed column"));
  if (k.columns_renamed) parts.push(plural(k.columns_renamed, "renamed column"));
  if (k.columns_missing) parts.push(`${k.columns_missing.toLocaleString("en-GB")} missing from source`);
  if (k.relationships_new) parts.push(plural(k.relationships_new, "new relationship"));
  if (k.changes_raised) parts.push(`${k.changes_raised.toLocaleString("en-GB")} to resolve${k.changes_high ? ` (${k.changes_high.toLocaleString("en-GB")} high)` : ""}`);
  return parts.join(", ") || "No changes";
}
