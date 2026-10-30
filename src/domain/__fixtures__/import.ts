// Test fixtures for the import engine (slice 7a, step 3). Not used by application code.

import { applyPlan, type ImportChangeset } from "../import/apply";
import { materialize as materializeIn } from "../import/materialize";
import type { ImportColumn, ImportMapping, ImportModel } from "../import/model";
import { buildPlan, type ImportPlan, type ImportTarget, type PlanChoices } from "../import/plan";
import type { StandardRead } from "../import/standard";
import type { Attribute, Entity, MappingInput, MappingStatus } from "../types";
import type { ClassificationCode } from "../model/classifications";
import { builtins, classificationLink, ids, T0 } from "./domain";

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

/** A workspace with no sources and the built-in classification list (slice 7c). */
export const emptyModel = (): ImportModel => ({
  systems: [],
  tables: [],
  columns: [],
  relationships: [],
  mappings: [],
  mappingInputs: [],
  attributes: [],
  entities: [],
  changes: [],
  classifications: builtins(),
  classificationLinks: [],
});

/** Who runs the fixtures' imports. */
export const IMPORTER = ids.someoneElse;

export const allOf = (read: StandardRead, over: Partial<PlanChoices> = {}): PlanChoices => ({
  scope: new Set(read.tables.map((t) => t.key)),
  compare: "schemas",
  renames: new Map(),
  ...over,
});

/** The model after a changeset, as the command will write it (the domain's `materialize`, the fixtures' people and time). */
export const materialize = (model: ImportModel, c: ImportChangeset): ImportModel => materializeIn(model, c, { workspaceId: ids.ws, actorId: ids.someoneElse, now: T0 });

/** Plans and applies an import; throws on errors. */
export function importInto(model: ImportModel, read: StandardRead, target: ImportTarget, choices: PlanChoices = allOf(read)) {
  if (read.errors.length) throw new Error(read.errors.join(" "));
  const plan = buildPlan(model, read, target, choices);
  const applied = applyPlan(model, plan, { actorId: IMPORTER, now: LATER, newId: importId });

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
    copied_from_attribute_id: null,
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

/** A classification set on a column by hand (slice 7c): a new link, the column's version unchanged. */
export const classify = (model: ImportModel, columnId: string, code: ClassificationCode): ImportModel => ({
  ...model,
  classificationLinks: [...(model.classificationLinks ?? []), classificationLink(model.classifications!.find((c) => c.code === code)!, { columnId })],
});

/** A classification cleared on a column by hand (slice 7c). */
export const unclassify = (model: ImportModel, columnId: string, code: ClassificationCode): ImportModel => {
  const c = model.classifications!.find((x) => x.code === code)!;
  return { ...model, classificationLinks: (model.classificationLinks ?? []).filter((l) => !(l.source_column_id === columnId && l.classification_id === c.id)) };
};

/** The codes of a column's classifications. */
export const codesOf = (model: ImportModel, columnId: string): string[] => {
  const byId = new Map((model.classifications ?? []).map((c) => [c.id, c]));
  return (model.classificationLinks ?? []).filter((l) => l.deleted_at === null && l.source_column_id === columnId).map((l) => byId.get(l.classification_id)?.code ?? byId.get(l.classification_id)?.name ?? "?").sort();
};

export const attributeNamed = (model: ImportModel, name: string) => model.attributes.find((a) => a.name === name)!;

export type { ImportPlan };
