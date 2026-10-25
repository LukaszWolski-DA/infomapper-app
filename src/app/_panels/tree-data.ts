// What the left panel lists (prototype renderSide), as plain serialisable data: built on the server from the model
// and the cards of every canvas, filtered in the browser by the search and “Only on this canvas”.

import type { Uuid } from "@/domain/ids";
import type { RequirementIndex } from "@/domain/model/requirement-index";
import { coverageParts } from "@/domain/model/requirements";
import { REQUIREMENT_KINDS, type CanvasItem, type RequirementKind, type SourceChange, type WorkspaceModel } from "@/domain/types";

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
  /** It has a card on a canvas of this project (“Only what this project uses”). */
  inProject: boolean;
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
  /** Column names, for the search and the card's rows. */
  fields: string[];
  /** The right side (slice 7a, item 33): “{format} file”, “view” or “{n} cols”. */
  meta: string;
  /** Missing from source (slice 7a): the table, or some of its columns; a retired one is not missing but historical (7b). */
  missing: boolean;
  columnsMissing: boolean;
  /** Retired, historical (slice 7b, item 22): struck through in grey. */
  retired: boolean;
  presence: Presence;
  inProject: boolean;
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
  /** Its open changes to resolve (slice 7b, item 22). */
  openChanges: number;
  schemas: TreeSchema[];
}

/** A requirement in the Requirements tab (slice 4a); its card's presence since slice 4b-2. */
export interface TreeRequirement {
  id: Uuid;
  key: string;
  name: string;
  kind: RequirementKind;
  /** Attributes in scope covered, and in scope (the coverage bar). */
  covered: number;
  total: number;
  /** The coverage items by kind, for the tooltip (“1 entity, 3 attributes”; slice 4b-1). */
  parts: string;
  /** Its scope has an entity or table on one of this project's canvases (PRD item 30's rule), or its card is on one (slice 4b-2, K). */
  inProject: boolean;
  /** Its card: on this canvas, on another one, or on none (slice 4b-2, J). */
  presence: Presence;
}

export interface TreeData {
  concepts: TreeConcept[];
  systems: TreeSystem[];
  /** In the index's order: by kind, then by key. */
  requirements: TreeRequirement[];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The model in panel order: concepts with their entities; source systems with their `database.schema` groups and
 * tables. `items` are the live cards of every live canvas of the workspace; `projectCanvasIds` the canvases of the
 * open project.
 */
export function buildTree(
  model: WorkspaceModel,
  items: readonly CanvasItem[],
  canvasId: Uuid,
  projectCanvasIds: readonly Uuid[],
  requirements?: RequirementIndex,
  /** The workspace's changes to resolve (slice 7b): each system's open count. */
  changes: readonly SourceChange[] = [],
): TreeData {
  const here = new Map<Uuid, Uuid>(), elsewhere = new Set<Uuid>(), inProject = new Set<Uuid>();
  const projectCanvases = new Set(projectCanvasIds);
  // requirement cards (slice 4b-2): by requirement, apart from the elements
  const reqHere = new Set<Uuid>(), reqElsewhere = new Set<Uuid>(), reqInProject = new Set<Uuid>();
  for (const i of items) {
    if (i.requirement_id) {
      (i.canvas_id === canvasId ? reqHere : reqElsewhere).add(i.requirement_id);
      if (projectCanvases.has(i.canvas_id)) reqInProject.add(i.requirement_id);
      continue;
    }
    const target = i.entity_id ?? i.source_table_id;
    if (!target) continue;
    if (i.canvas_id === canvasId) here.set(target, i.id);
    else elsewhere.add(target);
    if (projectCanvases.has(i.canvas_id)) inProject.add(target);
  }
  const presence = (id: Uuid): Presence => (here.has(id) ? "here" : elsewhere.has(id) ? "elsewhere" : "none");

  const fieldsOf = new Map<Uuid, string[]>();
  const columnsMissing = new Set<Uuid>();
  for (const a of model.attributes) fieldsOf.set(a.entity_id, [...(fieldsOf.get(a.entity_id) ?? []), a.name]);
  for (const c of model.sourceColumns) {
    fieldsOf.set(c.source_table_id, [...(fieldsOf.get(c.source_table_id) ?? []), c.name]);
    if (c.missing_since && !c.retired_since) columnsMissing.add(c.source_table_id);
  }

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
        inProject: inProject.has(e.id),
        cardId: here.get(e.id) ?? null,
      })),
  }));

  const openBySystem = new Map<Uuid, number>();
  for (const c of changes) if (c.status === "open" && c.deleted_at === null) openBySystem.set(c.source_system_id, (openBySystem.get(c.source_system_id) ?? 0) + 1);
  const systems = model.sourceSystems.map<TreeSystem>((s) => {
    const schemas = new Map<string, TreeTable[]>();
    for (const t of model.sourceTables) {
      if (t.source_system_id !== s.id) continue;
      const key = `${t.database_name}.${t.schema_name}`;
      const fields = fieldsOf.get(t.id) ?? [];
      const meta = t.object_type === "file" ? `${t.file_format ? `${t.file_format} ` : ""}file` : t.object_type === "view" ? "view" : `${fields.length} cols`;
      schemas.set(key, [
        ...(schemas.get(key) ?? []),
        {
          id: t.id,
          name: t.name,
          fields,
          meta,
          missing: !!t.missing_since && !t.retired_since,
          columnsMissing: columnsMissing.has(t.id),
          retired: !!t.retired_since,
          presence: presence(t.id),
          inProject: inProject.has(t.id),
          cardId: here.get(t.id) ?? null,
        },
      ]);
    }
    return { id: s.id, name: s.name, openChanges: openBySystem.get(s.id) ?? 0, schemas: [...schemas].map(([name, tables]) => ({ name, tables })) };
  });

  const reqs = (requirements?.requirements ?? []).map<TreeRequirement>((r) => {
    const scope = requirements!.scope(r.id);
    const coverage = requirements!.coverage(r.id);
    return {
      id: r.id,
      key: r.key,
      name: r.name,
      kind: r.kind,
      covered: coverage.covered.length,
      total: coverage.total,
      parts: coverageParts(coverage.parts),
      inProject: reqInProject.has(r.id) || [...scope.entities, ...scope.tables].some((id) => inProject.has(id)),
      presence: reqHere.has(r.id) ? "here" : reqElsewhere.has(r.id) ? "elsewhere" : "none",
    };
  });

  return { concepts, systems, requirements: reqs };
}

// ---- filtering (search, “Only on this canvas”) ----

export interface TreeFilter {
  q: string;
  canvasOnly: boolean;
  /** “Only what this project uses”: elements with a card on a canvas of this project. */
  projectOnly?: boolean;
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

const isFiltering = (f: TreeFilter) => !!f.q.trim() || f.canvasOnly || !!f.projectOnly;

function show<T extends { name: string; fields: string[]; presence: Presence; inProject: boolean }>(
  item: T,
  f: TreeFilter,
  field: string,
): Shown<T> | null {
  if (f.canvasOnly && item.presence !== "here") return null;
  if (f.projectOnly && !item.inProject) return null;
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

/**
 * The Requirements tab's groups, by kind in REQUIREMENT_KINDS order; a group with nothing to show is left out.
 * “Only on this canvas” keeps the requirements with a card here (slice 4b-2, J); “Only what this project uses” those
 * whose scope has an entity or table on the project's canvases, or whose card is on one. The search matches key and name.
 */
export function filterRequirements(requirements: readonly TreeRequirement[], f: TreeFilter): { kind: RequirementKind; items: TreeRequirement[] }[] {
  const q = f.q.trim().toLowerCase();
  const shown = requirements.filter(
    (r) => (!f.canvasOnly || r.presence === "here") && (!f.projectOnly || r.inProject) && (!q || `${r.key} ${r.name}`.toLowerCase().includes(q)),
  );
  return REQUIREMENT_KINDS.map((kind) => ({ kind, items: shown.filter((r) => r.kind === kind) })).filter((g) => g.items.length > 0);
}

// ---- folding groups ----

export const conceptGroup = (conceptId: Uuid) => `model:${conceptId}`;
export const systemGroup = (systemId: Uuid) => `src:${systemId}`;
export const schemaGroup = (systemId: Uuid, schema: string) => `src:${systemId}/${schema}`;
export const requirementGroup = (kind: RequirementKind) => `req:${kind}`;

/** Every group key of a tab, for collapse all and expand all. */
export function allGroups(tree: TreeData, tab: "model" | "sources" | "requirements"): string[] {
  if (tab === "model") return tree.concepts.map((c) => conceptGroup(c.id));
  if (tab === "requirements") return REQUIREMENT_KINDS.map(requirementGroup);
  return tree.systems.flatMap((s) => [systemGroup(s.id), ...s.schemas.map((sc) => schemaGroup(s.id, sc.name))]);
}

/** Groups fold and the panel remembers it; while searching, every group is open without changing what is remembered. */
export const isOpen = (shut: ReadonlySet<string>, key: string, q: string) => !!q.trim() || !shut.has(key);
