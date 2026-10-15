// What Focus keeps lit (slice 4p, PRD section 6; slice 4b-1, PRD item 21; prototype `relatedOf`). Pure functions on the
// live model; the canvas maps the result onto its cards and lines and fades the rest. No row is coloured: a selected
// requirement's coverage colours are drawn by themselves, with or without Focus (slice 4b-1, step 6).
//
// - Focus on an entity (prototype relatedOf “entity”): the entity; every mapping of its attributes with the source
//   tables of their inputs; every relationship of the entity with the entities at both ends.
// - Focus on a requirement (prototype relatedOf “req”; slice 4p's lens without its colours): the entities and tables of
//   its scope (D-31); for every attribute in scope its mappings with their tables and entities; for every column in
//   scope its mappings; the mappings in scope.

import type { Uuid } from "../ids";
import type { WorkspaceModel } from "../types";
import type { RequirementScope } from "./requirements";

export type LitRowColour = "covered" | "gap";

export interface Lit {
  entities: Set<Uuid>;
  tables: Set<Uuid>;
  /** Rows (attributes and columns) coloured by the lens. */
  rows: Map<Uuid, LitRowColour>;
  mappings: Set<Uuid>;
  relationships: Set<Uuid>;
}

export type LitModel = Pick<WorkspaceModel, "attributes" | "mappings" | "mappingInputs" | "relationships" | "sourceColumns">;

const live = <T extends { deleted_at: string | null }>(rows: readonly T[]) => rows.filter((r) => r.deleted_at === null);

function lookup(model: LitModel) {
  const entityOf = new Map(live(model.attributes).map((a) => [a.id, a.entity_id]));
  const tableOf = new Map(live(model.sourceColumns).map((c) => [c.id, c.source_table_id]));
  const mappings = live(model.mappings);
  const mappingById = new Map(mappings.map((m) => [m.id, m]));
  const inputsOf = new Map<Uuid, Uuid[]>();
  const mappingsOfColumn = new Map<Uuid, Uuid[]>();
  for (const i of live(model.mappingInputs)) {
    if (!mappingById.has(i.mapping_id)) continue;
    (inputsOf.get(i.mapping_id) ?? inputsOf.set(i.mapping_id, []).get(i.mapping_id)!).push(i.source_column_id);
    (mappingsOfColumn.get(i.source_column_id) ?? mappingsOfColumn.set(i.source_column_id, []).get(i.source_column_id)!).push(i.mapping_id);
  }
  const mappingsOfAttribute = new Map<Uuid, Uuid[]>();
  for (const m of mappings) (mappingsOfAttribute.get(m.attribute_id) ?? mappingsOfAttribute.set(m.attribute_id, []).get(m.attribute_id)!).push(m.id);
  return { entityOf, tableOf, mappingById, inputsOf, mappingsOfColumn, mappingsOfAttribute };
}

const empty = (): Lit => ({ entities: new Set(), tables: new Set(), rows: new Map(), mappings: new Set(), relationships: new Set() });

/** A mapping lit with its ends (prototype `addMap`): its attribute's entity and its inputs' tables. */
function addMapping(lit: Lit, l: ReturnType<typeof lookup>, mappingId: Uuid) {
  const m = l.mappingById.get(mappingId);
  if (!m) return;
  lit.mappings.add(m.id);
  const entity = l.entityOf.get(m.attribute_id);
  if (entity) lit.entities.add(entity);
  for (const c of l.inputsOf.get(m.id) ?? []) {
    const table = l.tableOf.get(c);
    if (table) lit.tables.add(table);
  }
}

/** Focus on an entity (prototype relatedOf “entity”). */
export function focusLit(model: LitModel, entityId: Uuid): Lit {
  const l = lookup(model);
  const lit = empty();
  lit.entities.add(entityId);
  for (const a of live(model.attributes)) if (a.entity_id === entityId) for (const m of l.mappingsOfAttribute.get(a.id) ?? []) addMapping(lit, l, m);
  for (const r of live(model.relationships)) {
    if (r.from_entity_id !== entityId && r.to_entity_id !== entityId) continue;
    lit.relationships.add(r.id);
    lit.entities.add(r.from_entity_id);
    lit.entities.add(r.to_entity_id);
  }
  return lit;
}

/** Focus on a requirement (prototype relatedOf “req”): its scope's cards and the mappings around it; no row coloured. */
export function requirementFocusLit(model: LitModel, scope: RequirementScope): Lit {
  const l = lookup(model);
  const lit = empty();
  for (const e of scope.entities) lit.entities.add(e);
  for (const t of scope.tables) lit.tables.add(t);
  for (const a of scope.attributes) for (const m of l.mappingsOfAttribute.get(a) ?? []) addMapping(lit, l, m);
  for (const c of scope.columns) for (const m of l.mappingsOfColumn.get(c) ?? []) addMapping(lit, l, m);
  for (const m of scope.mappings) addMapping(lit, l, m);
  return lit;
}
