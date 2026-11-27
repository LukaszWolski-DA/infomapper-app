// InfoCatalog's items (slice 39, S39-03, Q7 as answered: C2, C3): what a search finds, built from a workspace's snapshot.
// Pure. InfoMapper's kinds are here; a module adds its own through its contribution (`contribution.ts`). Entities,
// attributes and relationships are the logical level only (C2): the dimensional level is InfoCube's. Entities and
// attributes carry no classifications (C3): `classification_link` points to a source table or column only.

import type { Uuid } from "../ids";
import { stereotypeIndex } from "../model/stereotypes";
import { formatAttributeType, formatColumnType } from "../model/type-check";
import type { WorkspaceSnapshot } from "../model/workspace-model";
import type { Entity, ModuleTable, Relationship } from "../types";
import { physicalName, tableLocation } from "./physical";

/** A mark on a result: Personal data, a status, a source object gone from its source. */
export type CatalogMark = { t: "pii" } | { t: "status"; status: string } | { t: "missing" } | { t: "retired" };

/** What a search reads besides the name (A3.1 less the catalog's own fields). */
export interface CatalogFields {
  /** The alias, or a requirement's key: the ranking's second tier. */
  readonly alias: readonly string[];
  /** The definition (or description, comment, note): the fourth tier. */
  readonly definition: readonly string[];
  /** The full physical name, rules, an external reference, classification names, codes: the fifth tier. */
  readonly other: readonly string[];
}

export interface CatalogItem {
  readonly kind: string;
  readonly id: Uuid;
  readonly workspaceId: Uuid;
  /** The name shown (derived where the row has none: a relationship, a mapping, a key). */
  readonly name: string;
  /** The result's Details: a path, a type, a physical name. */
  readonly path: string;
  /** The text under the name, cut to one line where it is drawn. */
  readonly definition: string | null;
  readonly fields: CatalogFields;
  readonly marks: readonly CatalogMark[];
  /** Its place in its kind's model order in its workspace (the ranking's last tie-break). */
  readonly order: number;
  /** The entities and source tables it lives on (canvases, documents' scope). */
  readonly anchors: { readonly entities: readonly Uuid[]; readonly tables: readonly Uuid[] };
}

/** A kind tab: its key in the address, its label, the kinds it holds. */
export interface CatalogTab {
  readonly key: string;
  readonly label: string;
  readonly kinds: readonly string[];
}

/** InfoMapper's tabs in their order (the PRD's; "All" comes first and is the search's own). */
export const CORE_TABS: readonly CatalogTab[] = [
  { key: "entities", label: "Entities", kinds: ["entity"] },
  { key: "attributes", label: "Attributes", kinds: ["attribute"] },
  { key: "relationships", label: "Relationships", kinds: ["relationship"] },
  { key: "concepts", label: "Concepts", kinds: ["concept"] },
  { key: "tables", label: "Source tables", kinds: ["source_table"] },
  { key: "columns", label: "Source columns", kinds: ["source_column"] },
  { key: "mappings", label: "Mappings", kinds: ["mapping"] },
  { key: "requirements", label: "Requirements", kinds: ["requirement"] },
  { key: "classes", label: "Classifications and stereotypes", kinds: ["classification", "stereotype"] },
];

const cardinality = (min: 0 | 1, max: "1" | "n") => `${min}..${max === "n" ? "*" : "1"}`;
const present = (...xs: (string | null | undefined)[]): string[] => xs.filter((x): x is string => !!x && x.trim() !== "");
const none = { entities: [], tables: [] } as const;

/** A relationship's name where it has no label: "From – To". */
export const relationshipName = (r: Pick<Relationship, "label">, from: string, to: string): string => r.label?.trim() || `${from} – ${to}`;

/** InfoMapper's items of one workspace, kind by kind, each kind in the model's order. */
export function coreCatalogItems(snapshot: WorkspaceSnapshot<ModuleTable>): CatalogItem[] {
  const m = snapshot.model;
  const ws = snapshot.workspace.id;
  const out: CatalogItem[] = [];
  const counters = new Map<string, number>();
  const add = (x: Omit<CatalogItem, "workspaceId" | "order">) => {
    const order = counters.get(x.kind) ?? 0;
    counters.set(x.kind, order + 1);
    out.push({ ...x, workspaceId: ws, order });
  };

  const liveEntities = m.entities.filter((e) => e.deleted_at === null);
  const logical = liveEntities.filter((e) => e.model_level === "logical");
  const entityById = new Map<Uuid, Entity>(liveEntities.map((e) => [e.id, e]));
  const isLogical = (id: Uuid) => entityById.get(id)?.model_level === "logical";
  const concepts = new Map(m.concepts.map((c) => [c.id, c]));
  const stereotypes = stereotypeIndex(m.stereotypes);
  const systems = new Map(m.sourceSystems.map((s) => [s.id, s.name]));
  const tables = new Map(m.sourceTables.map((t) => [t.id, t]));
  const columns = new Map(m.sourceColumns.map((c) => [c.id, c]));
  const attributes = new Map(m.attributes.filter((a) => a.deleted_at === null).map((a) => [a.id, a]));
  const liveClasses = m.classifications.filter((c) => c.deleted_at === null);
  const className = new Map(liveClasses.map((c) => [c.id, c.name]));
  const classesOf = new Map<Uuid, string[]>();
  const carriers = new Map<Uuid, number>();
  for (const l of m.classificationLinks) {
    const name = className.get(l.classification_id);
    if (!name) continue;
    const on = (l.source_column_id ?? l.source_table_id)!;
    classesOf.set(on, [...(classesOf.get(on) ?? []), name]);
    carriers.set(l.classification_id, (carriers.get(l.classification_id) ?? 0) + 1);
  }
  const piiCode = new Set(liveClasses.filter((c) => c.code === "PII").map((c) => c.id));
  const piiColumns = new Set(m.classificationLinks.filter((l) => l.source_column_id && piiCode.has(l.classification_id)).map((l) => l.source_column_id!));
  const gone = (x: { missing_since: string | null; retired_since: string | null }): CatalogMark[] =>
    x.retired_since ? [{ t: "retired" }] : x.missing_since ? [{ t: "missing" }] : [];

  for (const c of m.concepts) add({ kind: "concept", id: c.id, name: c.name, path: "", definition: c.description_text, fields: { alias: [], definition: present(c.description_text), other: [] }, marks: [], anchors: { entities: logical.filter((e) => e.concept_id === c.id).map((e) => e.id), tables: [] } });

  for (const e of logical) {
    const stereotype = stereotypes.name(e.stereotype);
    add({
      kind: "entity",
      id: e.id,
      name: e.name,
      path: present(concepts.get(e.concept_id)?.name, stereotype).join(" · "),
      definition: e.definition_text,
      fields: { alias: present(e.alias), definition: present(e.definition_text), other: [] },
      marks: [],
      anchors: { entities: [e.id], tables: [] },
    });
  }

  for (const a of m.attributes) {
    if (a.deleted_at !== null || !isLogical(a.entity_id)) continue;
    add({
      kind: "attribute",
      id: a.id,
      name: a.name,
      path: `${entityById.get(a.entity_id)!.name} · ${formatAttributeType(a)}`,
      definition: a.definition_text,
      fields: { alias: present(a.alias), definition: present(a.definition_text), other: present(a.calc_rule) },
      marks: a.is_pii ? [{ t: "pii" }] : [],
      anchors: { entities: [a.entity_id], tables: [] },
    });
  }

  for (const r of m.relationships) {
    if (r.deleted_at !== null || !isLogical(r.from_entity_id) || !isLogical(r.to_entity_id)) continue;
    const from = entityById.get(r.from_entity_id)!.name;
    const to = entityById.get(r.to_entity_id)!.name;
    add({
      kind: "relationship",
      id: r.id,
      name: relationshipName(r, from, to),
      path: `${from} ${cardinality(r.from_min, r.from_max)} — ${cardinality(r.to_min, r.to_max)} ${to}`,
      definition: r.description,
      fields: { alias: present(r.from_role, r.to_role), definition: present(r.description), other: [] },
      marks: [],
      anchors: { entities: [...new Set([r.from_entity_id, r.to_entity_id])], tables: [] },
    });
  }

  for (const t of m.sourceTables) {
    const system = systems.get(t.source_system_id);
    add({
      kind: "source_table",
      id: t.id,
      name: t.name,
      path: tableLocation(system, t),
      definition: t.comment ?? t.note_text,
      fields: { alias: [], definition: present(t.comment, t.note_text), other: [physicalName(system, t), ...(classesOf.get(t.id) ?? [])] },
      marks: gone(t),
      anchors: { entities: [], tables: [t.id] },
    });
  }

  for (const c of m.sourceColumns) {
    const t = tables.get(c.source_table_id);
    if (!t) continue;
    const system = systems.get(t.source_system_id);
    const pii = piiColumns.has(c.id);
    add({
      kind: "source_column",
      id: c.id,
      name: c.name,
      path: `${physicalName(system, t)} · ${formatColumnType(c)}`,
      definition: c.comment ?? c.note_text,
      fields: { alias: [], definition: present(c.comment, c.note_text), other: [physicalName(system, t, c), ...(classesOf.get(c.id) ?? [])] },
      marks: [...(pii ? [{ t: "pii" } as const] : []), ...gone(c)],
      anchors: { entities: [], tables: [t.id] },
    });
  }

  const inputsOf = new Map<Uuid, Uuid[]>();
  for (const i of m.mappingInputs) inputsOf.set(i.mapping_id, [...(inputsOf.get(i.mapping_id) ?? []), i.source_column_id]);
  for (const x of m.mappings) {
    const a = attributes.get(x.attribute_id);
    if (!a || !isLogical(a.entity_id)) continue;
    const inputs = (inputsOf.get(x.id) ?? []).map((id) => columns.get(id)).filter((c) => !!c);
    const inputTables = [...new Set(inputs.map((c) => c.source_table_id))];
    const source = inputs.map((c) => `${tables.get(c.source_table_id)?.name ?? "?"}.${c.name}`).join(", ") || "?";
    add({
      kind: "mapping",
      id: x.id,
      name: `${source} → ${entityById.get(a.entity_id)!.name}.${a.name}`,
      path: x.kind === "transform" ? "Transform" : "Direct",
      definition: x.note_text,
      fields: { alias: [], definition: present(x.note_text), other: present(x.rule_expression) },
      marks: [{ t: "status", status: x.status }],
      anchors: { entities: [a.entity_id], tables: inputTables },
    });
  }

  for (const r of snapshot.requirements) {
    add({
      kind: "requirement",
      id: r.id,
      name: `${r.key} ${r.name}`,
      path: r.kind,
      definition: r.description_text,
      fields: { alias: [r.key], definition: present(r.description_text), other: present(r.expression, r.external_ref, r.owner_name) },
      marks: [{ t: "status", status: r.status }],
      anchors: none,
    });
  }

  for (const c of liveClasses) {
    add({
      kind: "classification",
      id: c.id,
      name: c.name,
      path: `${c.scope === "table" ? "Tables" : "Columns"} · ${carriers.get(c.id) ?? 0}`,
      definition: c.definition,
      fields: { alias: present(c.code), definition: present(c.definition), other: [] },
      marks: [],
      anchors: none,
    });
  }

  for (const s of stereotypes.live) {
    add({
      kind: "stereotype",
      id: s.id,
      name: s.name,
      path: `${logical.filter((e) => e.stereotype === s.code).length}`,
      definition: s.definition,
      fields: { alias: present(s.code), definition: present(s.definition), other: [] },
      marks: [],
      anchors: none,
    });
  }
  return out;
}
