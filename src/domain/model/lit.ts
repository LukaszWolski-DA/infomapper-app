// What Focus keeps lit (slice 4p, PRD section 6; slice 4b-1, PRD item 21; prototype `relatedOf`). Pure functions on the
// live model; the canvas maps the result onto its cards and lines and fades the rest. No row is coloured: a selected
// requirement's coverage colours are drawn by themselves, with or without Focus (slice 4b-1, step 6).
//
// - Focus on an entity (prototype relatedOf “entity”): the entity; every mapping of its attributes with the source
//   tables of their inputs; every relationship of the entity with the entities at both ends.
// - Focus on a requirement (prototype relatedOf “req”; slice 4p's lens without its colours): the entities and tables of
//   its scope (D-31); for every attribute in scope its mappings with their tables and entities; for every column in
//   scope its mappings; the mappings in scope.
// - Slice 4b-1, step 7 (PRD item 21), the rest of the prototype's relatedOf: a table (“source”: the table and its
//   columns' mappings with their ends), an attribute (its mappings with their ends, and its entity), a column (its
//   mappings with their ends, and its table), a mapping (with its ends), a relationship (with both entities), and
//   several entities and tables at once (a frame's cards or a multi-selection: what each of them lights).
// - Slice 4b-2, step 6 (PRD items 20–21, answer C; prototype reqActive): which requirement cards stay lit. A card is lit
//   when its requirement is the Focus target, or when its requirement's scope contains the focused element itself; for
//   several items any of them, a requirement among them (its card in a multi-selection) included. A multi-selection's
//   requirements light their own scopes too (prototype relatedOf “multi”, the union of each item's).

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
  /** Requirements whose cards stay lit (slice 4b-2, PRD item 21); absent: none. */
  requirements?: ReadonlySet<Uuid>;
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
  return targetLit(model, { t: "entity", id: entityId });
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

/** What Focus can be on besides a requirement (slice 4b-1, PRD item 21). A frame or several items: their cards. */
export type LitTarget =
  | { t: "entity" | "table" | "attribute" | "column" | "mapping" | "relationship"; id: Uuid }
  | { t: "several"; entities: readonly Uuid[]; tables: readonly Uuid[]; requirements?: readonly Uuid[] };

/** Focus on a table (prototype relatedOf “source”): the table, its columns' mappings with their ends. */
function tableLit(model: LitModel, l: ReturnType<typeof lookup>, lit: Lit, tableId: Uuid) {
  lit.tables.add(tableId);
  for (const c of live(model.sourceColumns)) if (c.source_table_id === tableId) for (const m of l.mappingsOfColumn.get(c.id) ?? []) addMapping(lit, l, m);
}

function entityLit(model: LitModel, l: ReturnType<typeof lookup>, lit: Lit, entityId: Uuid) {
  lit.entities.add(entityId);
  for (const a of live(model.attributes)) if (a.entity_id === entityId) for (const m of l.mappingsOfAttribute.get(a.id) ?? []) addMapping(lit, l, m);
  for (const r of live(model.relationships)) {
    if (r.from_entity_id !== entityId && r.to_entity_id !== entityId) continue;
    lit.relationships.add(r.id);
    lit.entities.add(r.from_entity_id);
    lit.entities.add(r.to_entity_id);
  }
}

/** What Focus lights for a selection other than a requirement (prototype relatedOf); nothing for an unknown id. */
export function targetLit(model: LitModel, target: LitTarget): Lit {
  const l = lookup(model);
  const lit = empty();
  switch (target.t) {
    case "entity":
      entityLit(model, l, lit, target.id);
      break;
    case "table":
      tableLit(model, l, lit, target.id);
      break;
    case "attribute": {
      const entity = l.entityOf.get(target.id);
      if (!entity) break;
      lit.entities.add(entity);
      for (const m of l.mappingsOfAttribute.get(target.id) ?? []) addMapping(lit, l, m);
      break;
    }
    case "column": {
      const table = l.tableOf.get(target.id);
      if (!table) break;
      lit.tables.add(table);
      for (const m of l.mappingsOfColumn.get(target.id) ?? []) addMapping(lit, l, m);
      break;
    }
    case "mapping":
      addMapping(lit, l, target.id);
      break;
    case "relationship": {
      const r = live(model.relationships).find((x) => x.id === target.id);
      if (!r) break;
      lit.relationships.add(r.id);
      lit.entities.add(r.from_entity_id);
      lit.entities.add(r.to_entity_id);
      break;
    }
    case "several":
      for (const e of target.entities) entityLit(model, l, lit, e);
      for (const t of target.tables) tableLit(model, l, lit, t);
      break;
  }
  return lit;
}

/** Everything `b` lights added to `a` (a multi-selection's items, slice 4b-2). */
export function mergeLit(a: Lit, b: Lit): Lit {
  for (const e of b.entities) a.entities.add(e);
  for (const t of b.tables) a.tables.add(t);
  for (const [r, c] of b.rows) if (!a.rows.has(r)) a.rows.set(r, c);
  for (const m of b.mappings) a.mappings.add(m);
  for (const r of b.relationships) a.relationships.add(r);
  return a;
}

/**
 * Whether a requirement's scope contains the focused element itself (slice 4b-2, PRD item 21, answer C; prototype
 * reqActive): an entity, table, attribute or column in it; a mapping in it, or its attribute; a relationship with either
 * entity in it; for several items, any of their entities or tables.
 */
export function scopeContains(model: LitModel, scope: RequirementScope, target: LitTarget): boolean {
  return containsTest(model, target)(scope);
}

/** `scopeContains` for one target, with its mapping or relationship looked up once (for many requirements). */
function containsTest(model: LitModel, target: LitTarget): (scope: RequirementScope) => boolean {
  switch (target.t) {
    case "entity":
      return (s) => s.entities.has(target.id);
    case "table":
      return (s) => s.tables.has(target.id);
    case "attribute":
      return (s) => s.attributes.has(target.id);
    case "column":
      return (s) => s.columns.has(target.id);
    case "mapping": {
      const m = live(model.mappings).find((x) => x.id === target.id);
      return (s) => s.mappings.has(target.id) || (!!m && s.attributes.has(m.attribute_id));
    }
    case "relationship": {
      const r = live(model.relationships).find((x) => x.id === target.id);
      return (s) => !!r && (s.entities.has(r.from_entity_id) || s.entities.has(r.to_entity_id));
    }
    case "several":
      return (s) => target.entities.some((e) => s.entities.has(e)) || target.tables.some((t) => s.tables.has(t));
  }
}

/**
 * The requirements among `requirementIds` whose cards stay lit under Focus (slice 4b-2, PRD item 21): the focused
 * requirement itself; for any other target, those whose scope contains it (`scopeContains`); for several items also the
 * requirements among them.
 */
export function litRequirements(
  model: LitModel,
  target: LitTarget | { t: "requirement"; id: Uuid },
  requirementIds: Iterable<Uuid>,
  scopeOf: (requirementId: Uuid) => RequirementScope,
): Set<Uuid> {
  const out = new Set<Uuid>();
  if (target.t === "requirement") {
    for (const id of requirementIds) if (id === target.id) out.add(id);
    return out;
  }
  const chosen = new Set(target.t === "several" ? (target.requirements ?? []) : []);
  const contains = containsTest(model, target);
  for (const id of requirementIds) if (chosen.has(id) || contains(scopeOf(id))) out.add(id);
  return out;
}
