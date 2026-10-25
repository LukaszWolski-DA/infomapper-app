// Open changes derived from what slice 7a's imports stored (slice 7b, P2; step 1 answers Q1, Q3, F1, F2): run once by
// the local data file's upgrade to format 7 (step 3), over every workspace. An import writes everything with one clock
// (`importSources`, one `ctx`), so a change finds the import that caused it exactly:
//   - a table or column with `missing_since`: the system's import created at that moment (`table_left`; `column_left`
//     unless the column left with its table);
//   - a mapping in review with a `review_reason`: the import in whose change group the mapping went from approved to
//     review; the kind from the reason's words (type conflict before business key before rule, as the prototype);
//   - a table or column created by an import into a table or system that existed before it, with no mapping yet (Q3):
//     `new_table`, `new_column`.
// Each change is dated and signed as its import, and its detail ends “Raised when slice 7b was installed.”. What 7a
// did not store cannot be derived (a draft's conflict, a business key change with no mapping).

import type { Uuid } from "../ids";
import { formatColumnType } from "../model/type-check";
import type { Attribute, ChangeEvent, Entity, Mapping, MappingInput, SourceChange, SourceColumn, SourceImport, SourceSystem, SourceTable } from "../types";
import { DETAIL } from "./texts";
import type { RaisedChange } from "./rules";

export interface DeriveRows {
  systems: readonly SourceSystem[];
  tables: readonly SourceTable[];
  columns: readonly SourceColumn[];
  imports: readonly SourceImport[];
  mappings: readonly Mapping[];
  mappingInputs: readonly MappingInput[];
  attributes: readonly Attribute[];
  entities: readonly Entity[];
  events: readonly ChangeEvent[];
}

const live = <R extends { deleted_at: string | null }>(rows: readonly R[]): R[] => rows.filter((r) => r.deleted_at === null);

/** The kind of a stored `review_reason` (its reasons joined with “; ”; a rewritten rule may hold “; ” itself). */
export function kindOfReason(reason: string): "type_conflict" | "business_key_changed" | "rule_updated" | null {
  if (/(^|; )type conflict, /.test(reason)) return "type_conflict";
  if (/(^|; )business key column changed type, /.test(reason)) return "business_key_changed";
  if (/(^|; )its rule now reads /.test(reason)) return "rule_updated";
  return null;
}

export function deriveSourceChanges(rows: DeriveRows, newId: () => Uuid): SourceChange[] {
  const imports = live(rows.imports).sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (!imports.length) return [];
  const tables = live(rows.tables);
  const columns = live(rows.columns);
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const systemById = new Map(rows.systems.map((s) => [s.id, s]));
  const importAt = new Map(imports.map((i) => [`${i.source_system_id}|${i.created_at}`, i]));
  const importsOf = (systemId: Uuid) => imports.filter((i) => i.source_system_id === systemId);
  /** The import that wrote at `at`, else the system's last import before it. */
  const importFor = (systemId: Uuid, at: string): SourceImport | undefined =>
    importAt.get(`${systemId}|${at}`) ?? importsOf(systemId).filter((i) => i.created_at <= at).at(-1);

  const mappings = live(rows.mappings);
  const mappingById = new Map(mappings.map((m) => [m.id, m]));
  const inputsOf = new Map<Uuid, SourceColumn[]>();
  const columnById = new Map(columns.map((c) => [c.id, c]));
  const mapped = new Set<Uuid>();
  for (const i of live(rows.mappingInputs)) {
    if (!mappingById.has(i.mapping_id)) continue;
    const c = columnById.get(i.source_column_id);
    if (!c) continue;
    mapped.add(c.id);
    (inputsOf.get(i.mapping_id) ?? inputsOf.set(i.mapping_id, []).get(i.mapping_id)!).push(c);
  }
  const approvedOn = (columnId: Uuid) => mappings.some((m) => m.status === "approved" && (inputsOf.get(m.id) ?? []).some((c) => c.id === columnId));
  const mappingsOn = (columnId: Uuid) => mappings.filter((m) => (inputsOf.get(m.id) ?? []).some((c) => c.id === columnId)).length;
  const attributeLabel = (id: Uuid) => {
    const a = rows.attributes.find((x) => x.id === id);
    return a ? `${rows.entities.find((e) => e.id === a.entity_id)?.name ?? "?"}.${a.name}` : "?";
  };
  const tableLabel = (t: SourceTable) => `${t.schema_name}.${t.name}`;

  const out: SourceChange[] = [];
  const raise = (imp: SourceImport, c: RaisedChange) =>
    out.push({
      id: newId(),
      workspace_id: imp.workspace_id,
      version: 1,
      created_at: imp.created_at,
      created_by: imp.created_by,
      updated_at: imp.created_at,
      updated_by: imp.created_by,
      deleted_at: null,
      source_system_id: imp.source_system_id,
      source_import_id: imp.id,
      status: "open",
      resolution: null,
      resolved_by: null,
      resolved_at: null,
      ...c,
      detail: `${c.detail} ${DETAIL.derived}`,
    });

  // what left the source
  for (const t of tables) {
    if (!t.missing_since || t.retired_since) continue;
    const imp = importFor(t.source_system_id, t.missing_since);
    if (!imp) continue;
    const gone = columns.filter((c) => c.source_table_id === t.id && c.missing_since === t.missing_since);
    raise(imp, {
      kind: "table_left",
      severity: gone.some((c) => approvedOn(c.id)) ? "high" : "normal",
      source_table_id: t.id,
      source_column_id: null,
      mapping_id: null,
      object_label: tableLabel(t),
      detail: DETAIL.tableLeft(gone.length),
    });
  }
  for (const c of columns) {
    const t = tableById.get(c.source_table_id);
    if (!t || !c.missing_since || c.retired_since || c.missing_since === t.missing_since) continue;
    const imp = importFor(t.source_system_id, c.missing_since);
    if (!imp) continue;
    raise(imp, {
      kind: "column_left",
      severity: approvedOn(c.id) ? "high" : "normal",
      source_table_id: t.id,
      source_column_id: c.id,
      mapping_id: null,
      object_label: `${tableLabel(t)}.${c.name}`,
      detail: DETAIL.columnLeft(formatColumnType(c), mappingsOn(c.id)),
    });
  }

  // mappings an import sent back from approved
  const importOfGroup = new Map<Uuid, Uuid>();
  for (const e of rows.events) if (e.object_type === "source_import" && e.operation === "create") importOfGroup.set(e.change_group_id, e.object_id);
  const sentBackIn = new Map<Uuid, Uuid>(); // mapping → change group of its last send-back
  for (const e of rows.events) {
    if (e.object_type !== "mapping" || !e.before_image || !e.after_image) continue;
    if (e.before_image.status === "approved" && e.after_image.status === "review" && typeof e.after_image.review_reason === "string") sentBackIn.set(e.object_id, e.change_group_id);
  }
  const importById = new Map(imports.map((i) => [i.id, i]));
  for (const m of mappings) {
    if (m.status !== "review" || !m.review_reason) continue;
    const kind = kindOfReason(m.review_reason);
    const group = sentBackIn.get(m.id);
    const imp = group ? importById.get(importOfGroup.get(group) ?? "") : undefined;
    if (!kind || !imp) continue;
    const column = (inputsOf.get(m.id) ?? []).find((c) => tableById.get(c.source_table_id)?.source_system_id === imp.source_system_id);
    const t = column ? tableById.get(column.source_table_id) : undefined;
    raise(imp, {
      kind,
      severity: kind === "rule_updated" ? "normal" : "high",
      source_table_id: t?.id ?? null,
      source_column_id: column?.id ?? null,
      mapping_id: m.id,
      object_label: t && column ? `${tableLabel(t)}.${column.name}` : attributeLabel(m.attribute_id),
      detail: DETAIL.mappingSentBack(attributeLabel(m.attribute_id), [m.review_reason]),
    });
  }

  // what an import added to a system or table that existed before it, with no mapping yet (Q3)
  for (const t of tables) {
    if (t.missing_since) continue;
    const imp = importAt.get(`${t.source_system_id}|${t.created_at}`);
    const system = systemById.get(t.source_system_id);
    if (!imp || !system || system.created_at >= imp.created_at) continue;
    const own = columns.filter((c) => c.source_table_id === t.id);
    if (own.some((c) => mapped.has(c.id))) continue;
    raise(imp, { kind: "new_table", severity: "normal", source_table_id: t.id, source_column_id: null, mapping_id: null, object_label: tableLabel(t), detail: DETAIL.newTable(own.length) });
  }
  for (const c of columns) {
    const t = tableById.get(c.source_table_id);
    if (!t || c.missing_since || mapped.has(c.id) || t.created_at >= c.created_at) continue;
    const imp = importAt.get(`${t.source_system_id}|${c.created_at}`);
    if (!imp) continue;
    raise(imp, { kind: "new_column", severity: "normal", source_table_id: t.id, source_column_id: c.id, mapping_id: null, object_label: `${tableLabel(t)}.${c.name}`, detail: DETAIL.newColumn(formatColumnType(c)) });
  }
  return out;
}
