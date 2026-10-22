// Test fixtures for the import engine (slice 7a, step 3). Not used by application code.

import { applyPlan, type ImportChangeset } from "../import/apply";
import type { ImportColumn, ImportMapping, ImportModel, ImportRelationship, ImportTable } from "../import/model";
import { buildPlan, type ImportPlan, type ImportTarget, type PlanChoices } from "../import/plan";
import type { StandardRead } from "../import/standard";
import type { Attribute, Entity, MappingInput, MappingStatus, SourceSystem } from "../types";
import { ids, T0 } from "./domain";

let next = 0;
/** Ids that count up: 01900000-0000-7000-8000-a000000000NN. */
export const importId = () => `01900000-0000-7000-8000-a${String(++next).padStart(11, "0")}`;
export const LATER = "2026-10-05T09:00:00.000Z";

const standard = (id: string) => ({
  id,
  workspace_id: ids.ws,
  version: 1,
  created_at: T0,
  created_by: ids.someoneElse,
  updated_at: T0,
  updated_by: ids.someoneElse,
  deleted_at: null,
});

export const emptyModel = (): ImportModel => ({ systems: [], tables: [], columns: [], relationships: [], mappings: [], mappingInputs: [], attributes: [], entities: [] });

export const allOf = (read: StandardRead, over: Partial<PlanChoices> = {}): PlanChoices => ({
  scope: new Set(read.tables.map((t) => t.key)),
  compare: "schemas",
  renames: new Map(),
  ...over,
});

/** The model after a changeset, as the command will write it: new rows at version 1, patched rows one version up. */
export function materialize(model: ImportModel, c: ImportChangeset): ImportModel {
  const patch = <R extends { id: string; version: number }>(rows: readonly R[], patches: readonly { id: string; patch: Partial<R> }[]): R[] => {
    const byId = new Map(patches.map((p) => [p.id, p.patch]));
    return rows.map((r) => (byId.has(r.id) ? { ...r, ...byId.get(r.id), version: r.version + 1 } : r));
  };
  const systems: SourceSystem[] = c.system.isNew ? [...model.systems, { ...standard(c.system.id), name: c.system.name, description: null }] : [...model.systems];
  const tables: ImportTable[] = [
    ...patch(model.tables, c.tables.update),
    ...c.tables.insert.map((t) => ({ ...standard(t.id), ...t, missing_since: null })),
  ];
  const columns: ImportColumn[] = [
    ...patch(model.columns, c.columns.update),
    ...c.columns.insert.map((x) => ({ ...standard(x.id), ...x, default_value: null, missing_since: null })),
  ];
  const removed = new Set(c.relationshipColumns.remove);
  const pairsOf = (relationshipId: string) =>
    c.relationshipColumns.insert.filter((p) => p.source_relationship_id === relationshipId).map((p) => ({ id: p.id, from_column_id: p.from_column_id, to_column_id: p.to_column_id, sort_order: p.sort_order }));
  const relationships: ImportRelationship[] = [
    ...patch<ImportRelationship>(model.relationships, c.relationships.update as { id: string; patch: Partial<ImportRelationship> }[]).map((r) => ({ ...r, columns: [...r.columns.filter((p) => !removed.has(p.id)), ...pairsOf(r.id)] })),
    ...c.relationships.insert.map((r) => ({ id: r.id, version: 1, deleted_at: null, source_table_id: r.source_table_id, to_source_table_id: r.to_source_table_id, name: r.name, missing_since: null, columns: pairsOf(r.id) })),
  ];
  return { ...model, systems, tables, columns, relationships, mappings: patch(model.mappings, c.mappings) };
}

/** Plans and applies an import; throws on errors. */
export function importInto(model: ImportModel, read: StandardRead, target: ImportTarget, choices: PlanChoices = allOf(read)) {
  if (read.errors.length) throw new Error(read.errors.join(" "));
  const plan = buildPlan(model, read, target, choices);
  const applied = applyPlan(model, plan, { now: LATER, newId: importId });
  if (!applied.ok) throw new Error(applied.errors.join(" "));
  return { plan, changes: applied.changes, model: materialize(model, applied.changes) };
}

export const systemNamed = (model: ImportModel, name: string) => model.systems.find((s) => s.name === name)!;
export const tableNamed = (model: ImportModel, name: string) => model.tables.find((t) => t.name === name)!;
export const columnNamed = (model: ImportModel, table: string, name: string) => {
  const t = tableNamed(model, table);
  return model.columns.find((c) => c.source_table_id === t.id && c.name === name)!;
};

/** An entity with attributes, added to the model. */
export function withEntity(model: ImportModel, name: string, attributes: (Partial<Attribute> & { name: string })[]): ImportModel {
  const entity: Entity = { ...standard(importId()), concept_id: ids.conceptCustomer, name, stereotype: "object", definition_html: null, definition_text: null };
  const rows: Attribute[] = attributes.map((a, i) => ({
    ...standard(importId()),
    entity_id: entity.id,
    sort_order: i,
    data_type: "string",
    custom_type: null,
    type_length: null,
    type_precision: null,
    type_scale: null,
    is_primary_key: false,
    is_foreign_key: false,
    is_business_key: false,
    is_pii: false,
    is_nullable: true,
    definition_html: null,
    definition_text: null,
    ...a,
  }));
  return { ...model, entities: [...model.entities, entity], attributes: [...model.attributes, ...rows] };
}

/** A mapping from columns to an attribute, added to the model; returns the model and the mapping's id. */
export function withMapping(
  model: ImportModel,
  attributeId: string,
  columnIds: readonly string[],
  over: { status?: MappingStatus; rule?: string } = {},
): { model: ImportModel; mappingId: string } {
  const status = over.status ?? "approved";
  const m: ImportMapping = {
    ...standard(importId()),
    attribute_id: attributeId,
    kind: over.rule ? "transform" : "direct",
    rule_expression: over.rule ?? null,
    status,
    note_html: null,
    note_text: null,
    approved_by: status === "approved" ? ids.someoneElse : null,
    approved_at: status === "approved" ? T0 : null,
    review_reason: null,
  };
  const inputs: MappingInput[] = columnIds.map((c, i) => ({ ...standard(importId()), mapping_id: m.id, source_column_id: c, sort_order: i }));
  return { model: { ...model, mappings: [...model.mappings, m], mappingInputs: [...model.mappingInputs, ...inputs] }, mappingId: m.id };
}

/** A column changed by hand (a person's edit between review and import): one version up. */
export function editColumn(model: ImportModel, id: string, patch: Partial<ImportColumn>): ImportModel {
  return { ...model, columns: model.columns.map((c) => (c.id === id ? { ...c, ...patch, version: c.version + 1 } : c)) };
}

export const attributeNamed = (model: ImportModel, name: string) => model.attributes.find((a) => a.name === name)!;

export type { ImportPlan };
