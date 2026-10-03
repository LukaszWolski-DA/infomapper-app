// What the left panel lists (prototype renderSide), as plain serialisable data: built on the server from the model
// and the cards of every canvas, filtered in the browser by the search and “Only on this canvas”.

import type { Uuid } from "@/domain/ids";
import type { CanvasItem, WorkspaceModel } from "@/domain/types";

/** Where an element has cards: on this canvas (filled dot), only on other canvases (ring), or nowhere. */
export type Presence = "here" | "elsewhere" | "none";

export interface TreeEntity {
  id: Uuid;
  version: number;
  name: string;
  /** `Object`, `Link`, … */
  stereotype: string;
  /** Attribute names, for the search (prototype: search includes fields). */
  fields: string[];
  presence: Presence;
  /** The card on this canvas, when there is one. */
  cardId: Uuid | null;
}

export interface TreeConcept {
  id: Uuid;
  version: number;
  name: string;
  color: string;
  entities: TreeEntity[];
}

export interface TreeTable {
  id: Uuid;
  name: string;
  /** Column names, for the search and the `n cols` count. */
  fields: string[];
  presence: Presence;
  cardId: Uuid | null;
}

export interface TreeSchema {
  /** `database.schema` */
  name: string;
  tables: TreeTable[];
}

export interface TreeSystem {
  id: Uuid;
  name: string;
  schemas: TreeSchema[];
}

export interface TreeData {
  concepts: TreeConcept[];
  systems: TreeSystem[];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The model in panel order: concepts with their entities; source systems with their `database.schema` groups and
 * tables. `items` are the live cards of every live canvas of the workspace.
 */
export function buildTree(model: WorkspaceModel, items: readonly CanvasItem[], canvasId: Uuid): TreeData {
  const here = new Map<Uuid, Uuid>(), elsewhere = new Set<Uuid>();
  for (const i of items) {
    const target = i.entity_id ?? i.source_table_id;
    if (!target) continue;
    if (i.canvas_id === canvasId) here.set(target, i.id);
    else elsewhere.add(target);
  }
  const presence = (id: Uuid): Presence => (here.has(id) ? "here" : elsewhere.has(id) ? "elsewhere" : "none");

  const fieldsOf = new Map<Uuid, string[]>();
  for (const a of model.attributes) fieldsOf.set(a.entity_id, [...(fieldsOf.get(a.entity_id) ?? []), a.name]);
  for (const c of model.sourceColumns) fieldsOf.set(c.source_table_id, [...(fieldsOf.get(c.source_table_id) ?? []), c.name]);

  const concepts = model.concepts.map<TreeConcept>((c) => ({
    id: c.id,
    version: c.version,
    name: c.name,
    color: c.color,
    entities: model.entities
      .filter((e) => e.concept_id === c.id)
      .map((e) => ({
        id: e.id,
        version: e.version,
        name: e.name,
        stereotype: cap(e.stereotype),
        fields: fieldsOf.get(e.id) ?? [],
        presence: presence(e.id),
        cardId: here.get(e.id) ?? null,
      })),
  }));

  const systems = model.sourceSystems.map<TreeSystem>((s) => {
    const schemas = new Map<string, TreeTable[]>();
    for (const t of model.sourceTables) {
      if (t.source_system_id !== s.id) continue;
      const key = `${t.database_name}.${t.schema_name}`;
      schemas.set(key, [
        ...(schemas.get(key) ?? []),
        { id: t.id, name: t.name, fields: fieldsOf.get(t.id) ?? [], presence: presence(t.id), cardId: here.get(t.id) ?? null },
      ]);
    }
    return { id: s.id, name: s.name, schemas: [...schemas].map(([name, tables]) => ({ name, tables })) };
  });

  return { concepts, systems };
}

// ---- filtering (search, “Only on this canvas”) ----

export interface TreeFilter {
  q: string;
  canvasOnly: boolean;
}

/** An item that passes the filter; `hint` names the field that matched when the name did not (`attribute email`). */
export interface Shown<T> {
  item: T;
  hint: string | null;
}

export interface ShownConcept {
  concept: TreeConcept;
  items: Shown<TreeEntity>[];
}

export interface ShownSystem {
  system: TreeSystem;
  total: number;
  schemas: { name: string; items: Shown<TreeTable>[] }[];
}

const isFiltering = (f: TreeFilter) => !!f.q.trim() || f.canvasOnly;

function show<T extends { name: string; fields: string[]; presence: Presence }>(item: T, f: TreeFilter, field: string): Shown<T> | null {
  if (f.canvasOnly && item.presence !== "here") return null;
  const q = f.q.trim().toLowerCase();
  if (!q || item.name.toLowerCase().includes(q)) return { item, hint: null };
  const hit = item.fields.find((n) => n.toLowerCase().includes(q));
  return hit ? { item, hint: `${field} ${hit}` } : null;
}

/** Concepts and their matching entities. While filtering, concepts with nothing to show are left out. */
export function filterConcepts(concepts: readonly TreeConcept[], f: TreeFilter): ShownConcept[] {
  return concepts
    .map((concept) => ({
      concept,
      items: concept.entities.map((e) => show(e, f, "attribute")).filter((s): s is Shown<TreeEntity> => !!s),
    }))
    .filter((g) => g.items.length > 0 || !isFiltering(f));
}

/** Systems, their `database.schema` groups and the matching tables. Empty groups are always left out. */
export function filterSystems(systems: readonly TreeSystem[], f: TreeFilter): ShownSystem[] {
  return systems
    .map((system) => {
      const schemas = system.schemas
        .map((s) => ({ name: s.name, items: s.tables.map((t) => show(t, f, "column")).filter((x): x is Shown<TreeTable> => !!x) }))
        .filter((s) => s.items.length > 0);
      return { system, schemas, total: schemas.reduce((n, s) => n + s.items.length, 0) };
    })
    .filter((s) => s.total > 0);
}

// ---- folding groups ----

export const conceptGroup = (conceptId: Uuid) => `model:${conceptId}`;
export const systemGroup = (systemId: Uuid) => `src:${systemId}`;
export const schemaGroup = (systemId: Uuid, schema: string) => `src:${systemId}/${schema}`;

/** Groups fold and the panel remembers it; while searching, every group is open without changing what is remembered. */
export const isOpen = (shut: ReadonlySet<string>, key: string, q: string) => !!q.trim() || !shut.has(key);
