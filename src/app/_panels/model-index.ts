// Lookups the right panel needs over the live model (prototype idx()): rows by id, an attribute's mappings, a mapping's
// inputs in order, labels, the type check of a mapping (D-01), the BK suggestion (AD-28) and an entity's feeding
// sources. Pure TypeScript, built once per model in the browser.

import type { Uuid } from "@/domain/ids";
import { suggestsBusinessKey } from "@/domain/model/mapping-rules";
import { checkMappingTypes, formatAttributeType, formatColumnType, type MappingTypeCheck } from "@/domain/model/type-check";
import type { Attribute, Entity, Mapping, MappingInput, SourceColumn, SourceTable, WorkspaceModel } from "@/domain/types";

export interface ModelIndex {
  model: WorkspaceModel;
  entity: Map<Uuid, Entity>;
  attribute: Map<Uuid, Attribute>;
  mapping: Map<Uuid, Mapping>;
  column: Map<Uuid, SourceColumn>;
  table: Map<Uuid, SourceTable>;
  systemName: Map<Uuid, string>;
  conceptName: Map<Uuid, string>;
  attributesOf: Map<Uuid, Attribute[]>;
  columnsOf: Map<Uuid, SourceColumn[]>;
  mappingsOf: Map<Uuid, Mapping[]>;
  inputsOf: Map<Uuid, MappingInput[]>;
}

const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => m.set(k, [...(m.get(k) ?? []), v]);

export function indexModel(model: WorkspaceModel): ModelIndex {
  const attributesOf = new Map<Uuid, Attribute[]>(), columnsOf = new Map<Uuid, SourceColumn[]>();
  const mappingsOf = new Map<Uuid, Mapping[]>(), inputsOf = new Map<Uuid, MappingInput[]>();
  for (const a of model.attributes) push(attributesOf, a.entity_id, a);
  for (const c of model.sourceColumns) push(columnsOf, c.source_table_id, c);
  for (const m of model.mappings) push(mappingsOf, m.attribute_id, m);
  for (const i of [...model.mappingInputs].sort((a, b) => a.sort_order - b.sort_order)) push(inputsOf, i.mapping_id, i);
  return {
    model,
    entity: new Map(model.entities.map((e) => [e.id, e])),
    attribute: new Map(model.attributes.map((a) => [a.id, a])),
    mapping: new Map(model.mappings.map((m) => [m.id, m])),
    column: new Map(model.sourceColumns.map((c) => [c.id, c])),
    table: new Map(model.sourceTables.map((t) => [t.id, t])),
    systemName: new Map(model.sourceSystems.map((s) => [s.id, s.name])),
    conceptName: new Map(model.concepts.map((c) => [c.id, c.name])),
    attributesOf,
    columnsOf,
    mappingsOf,
    inputsOf,
  };
}

/** `customers.cust_id` */
export function columnLabel(ix: ModelIndex, columnId: Uuid): string {
  const c = ix.column.get(columnId);
  if (!c) return "deleted column";
  return `${ix.table.get(c.source_table_id)?.name ?? "?"}.${c.name}`;
}

/** `Customer.customer_id` */
export function attributeLabel(ix: ModelIndex, attributeId: Uuid): string {
  const a = ix.attribute.get(attributeId);
  if (!a) return "deleted attribute";
  return `${ix.entity.get(a.entity_id)?.name ?? "?"}.${a.name}`;
}

/** `CRM / crmprod.dbo` */
export function tablePath(ix: ModelIndex, t: SourceTable): string {
  return `${ix.systemName.get(t.source_system_id) ?? "?"} / ${t.database_name}.${t.schema_name}`;
}

export const inputColumns = (ix: ModelIndex, mappingId: Uuid): SourceColumn[] =>
  (ix.inputsOf.get(mappingId) ?? []).map((i) => ix.column.get(i.source_column_id)).filter((c): c is SourceColumn => !!c);

/** The mapping's inputs as one label: `customers.first_name, customers.last_name`. */
export const inputsLabel = (ix: ModelIndex, mappingId: Uuid): string =>
  (ix.inputsOf.get(mappingId) ?? []).map((i) => columnLabel(ix, i.source_column_id)).join(", ");

export function typeCheckOf(ix: ModelIndex, m: Mapping): MappingTypeCheck {
  const a = ix.attribute.get(m.attribute_id);
  if (!a) return { ok: true, message: "", problems: [] };
  return checkMappingTypes(m, a, inputColumns(ix, m.id));
}

/** The input columns marked BK that make the panel suggest the business-key flag (AD-28); empty when not. */
export function businessKeyHint(ix: ModelIndex, a: Attribute): SourceColumn[] {
  const columns = (ix.mappingsOf.get(a.id) ?? []).flatMap((m) => inputColumns(ix, m.id));
  return suggestsBusinessKey(a, columns) ? columns.filter((c) => c.is_business_key) : [];
}

/** Source tables that feed an entity, with the number of mappings that read from each (prototype feeds). */
export function feedingSources(ix: ModelIndex, entityId: Uuid): { table: SourceTable; mappings: number }[] {
  const counts = new Map<Uuid, number>();
  for (const a of ix.attributesOf.get(entityId) ?? []) {
    for (const m of ix.mappingsOf.get(a.id) ?? []) {
      const tables = new Set(inputColumns(ix, m.id).map((c) => c.source_table_id));
      for (const t of tables) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([id, mappings]) => ({ table: ix.table.get(id)!, mappings }))
    .filter((f) => !!f.table)
    .sort((a, b) => b.mappings - a.mappings || a.table.name.localeCompare(b.table.name));
}

export interface ColumnGroup {
  label: string;
  columns: { id: Uuid; label: string }[];
}

/** Columns to pick from (“Add a source column”, inputs): tables on this canvas first, the others marked (prototype colOptions). */
export function columnOptions(ix: ModelIndex, tablesHere: ReadonlySet<Uuid>, exclude: ReadonlySet<Uuid> = new Set()): ColumnGroup[] {
  const tables = [...ix.model.sourceTables].sort((a, b) => Number(tablesHere.has(b.id)) - Number(tablesHere.has(a.id)));
  return tables
    .map((t) => ({
      label: `${ix.systemName.get(t.source_system_id) ?? "?"} / ${t.name}${tablesHere.has(t.id) ? "" : " (not on canvas)"}`,
      columns: (ix.columnsOf.get(t.id) ?? []).filter((c) => !exclude.has(c.id)).map((c) => ({ id: c.id, label: `${c.name}  ${formatColumnType(c)}` })),
    }))
    .filter((g) => g.columns.length > 0);
}

/** Attributes to pick from (“Map to an attribute” in the column panel): grouped by entity, entities on this canvas first (prototype attrOptions). */
export function attributeOptions(ix: ModelIndex, entitiesHere: ReadonlySet<Uuid>): ColumnGroup[] {
  const entities = [...ix.model.entities].sort((a, b) => Number(entitiesHere.has(b.id)) - Number(entitiesHere.has(a.id)));
  return entities
    .map((e) => ({
      label: `${e.name}${entitiesHere.has(e.id) ? "" : " (not on canvas)"}`,
      columns: (ix.attributesOf.get(e.id) ?? []).map((a) => ({ id: a.id, label: `${a.name}  ${formatAttributeType(a)}` })),
    }))
    .filter((g) => g.columns.length > 0);
}

/** Mappings that read a column (one of their inputs), in model order. */
export function mappingsOfColumn(ix: ModelIndex, columnId: Uuid): Mapping[] {
  return ix.model.mappings.filter((m) => (ix.inputsOf.get(m.id) ?? []).some((i) => i.source_column_id === columnId));
}

/** Entities a source table feeds, with the number of mappings that read from it (prototype feeds for a source). */
export function fedEntities(ix: ModelIndex, tableId: Uuid): { entity: Entity; mappings: number }[] {
  const columns = new Set((ix.columnsOf.get(tableId) ?? []).map((c) => c.id));
  const counts = new Map<Uuid, number>();
  for (const m of ix.model.mappings) {
    if (!(ix.inputsOf.get(m.id) ?? []).some((i) => columns.has(i.source_column_id))) continue;
    const entityId = ix.attribute.get(m.attribute_id)?.entity_id;
    if (entityId) counts.set(entityId, (counts.get(entityId) ?? 0) + 1);
  }
  return [...counts]
    .map(([id, mappings]) => ({ entity: ix.entity.get(id)!, mappings }))
    .filter((f) => !!f.entity)
    .sort((a, b) => b.mappings - a.mappings || a.entity.name.localeCompare(b.entity.name));
}
