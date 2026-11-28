// InfoCube's part of InfoCatalog (slice 39, C2 as answered): facts, dimensions, measures, keys and dimensional mappings,
// each a tab of its own after InfoMapper's, searched only where InfoCube is on. Pure; joined by `src/compose/catalog.ts`.

import type { CatalogContribution } from "@/domain/catalog/contribution";
import type { CatalogItem, CatalogTab } from "@/domain/catalog/items";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceSnapshot } from "@/domain/model/workspace-model";
import type { ModuleTable } from "@/domain/types";
import type { CubeEntity, CubeKey, CubeMapping, CubeMappingInput, CubeMeasure, InfoCubeTable } from "./types";
import { FACT_TYPE_NAMES, historyLabel } from "./view";

export const CUBE_CATALOG_TABLES = ["cube_entity", "cube_measure", "cube_key", "cube_mapping", "cube_mapping_input"] as const satisfies readonly InfoCubeTable[];

export const CUBE_CATALOG_TABS: readonly CatalogTab[] = [
  { key: "facts", label: "Facts", kinds: ["fact"] },
  { key: "dimensions", label: "Dimensions", kinds: ["dimension"] },
  { key: "measures", label: "Measures", kinds: ["measure"] },
  { key: "keys", label: "Keys", kinds: ["key"] },
  { key: "cube-mappings", label: "Dimensional mappings", kinds: ["cube_mapping"] },
];

const ADDITIVITY: Readonly<Record<string, string>> = { additive: "Additive", semi: "Semi-additive", non: "Non-additive" };
const present = (...xs: (string | null | undefined)[]): string[] => xs.filter((x): x is string => !!x && x.trim() !== "");

type CubeRows = {
  cube_entity: readonly CubeEntity[];
  cube_measure: readonly CubeMeasure[];
  cube_key: readonly CubeKey[];
  cube_mapping: readonly CubeMapping[];
  cube_mapping_input: readonly CubeMappingInput[];
};

export function cubeCatalogItems(snapshot: WorkspaceSnapshot<ModuleTable>): CatalogItem[] {
  if (!snapshot.workspace.infocube) return [];
  const rows = snapshot.modules as unknown as Partial<CubeRows>;
  const m = snapshot.model;
  const ws = snapshot.workspace.id;
  const entities = new Map(m.entities.filter((e) => e.deleted_at === null).map((e) => [e.id, e]));
  const attributes = new Map(m.attributes.filter((a) => a.deleted_at === null).map((a) => [a.id, a]));
  const relationships = new Map(m.relationships.filter((r) => r.deleted_at === null).map((r) => [r.id, r]));
  const concepts = new Map(m.concepts.map((c) => [c.id, c.name]));
  const cubeOf = new Map((rows.cube_entity ?? []).filter((c) => c.deleted_at === null).map((c) => [c.entity_id, c]));
  const out: CatalogItem[] = [];
  const counters = new Map<string, number>();
  const add = (x: Omit<CatalogItem, "workspaceId" | "order">) => {
    const order = counters.get(x.kind) ?? 0;
    counters.set(x.kind, order + 1);
    out.push({ ...x, workspaceId: ws, order });
  };
  const attrName = (id: Uuid) => {
    const a = attributes.get(id);
    return a ? `${entities.get(a.entity_id)?.name ?? "?"}.${a.name}` : "?";
  };

  for (const e of m.entities) {
    const c = cubeOf.get(e.id);
    if (!c || e.deleted_at !== null || e.model_level !== "dimensional") continue;
    const fact = c.role === "fact";
    add({
      kind: fact ? "fact" : "dimension",
      kindLabel: fact ? "Fact" : "Dimension",
      id: e.id,
      name: e.name,
      path: present(concepts.get(e.concept_id), fact ? (c.fact_type ? FACT_TYPE_NAMES[c.fact_type] : null) : historyLabel(c)).join(" · "),
      definition: e.definition_text,
      fields: { alias: present(e.alias), definition: present(e.definition_text), other: present(c.grain) },
      marks: [],
      anchors: { entities: [e.id], tables: [] },
    });
  }

  for (const x of rows.cube_measure ?? []) {
    const a = attributes.get(x.attribute_id);
    const owner = a ? entities.get(a.entity_id) : undefined;
    if (x.deleted_at !== null || !a || !owner) continue;
    add({
      kind: "measure",
      kindLabel: "Measure",
      id: x.id,
      name: a.name,
      path: `${owner.name} · ${ADDITIVITY[x.additivity] ?? x.additivity}`,
      definition: a.definition_text,
      fields: { alias: present(a.alias), definition: present(a.definition_text), other: present(x.semi_note) },
      marks: [],
      anchors: { entities: [owner.id], tables: [] },
    });
  }

  for (const k of rows.cube_key ?? []) {
    const a = attributes.get(k.attribute_id);
    const r = relationships.get(k.relationship_id);
    // a key whose attribute is no foreign key reads as absent (slice 15b)
    if (k.deleted_at !== null || !a || !r || !a.is_foreign_key) continue;
    const from = entities.get(a.entity_id)?.name ?? "?";
    const otherId = r.from_entity_id === a.entity_id ? r.to_entity_id : r.from_entity_id;
    const to = entities.get(otherId)?.name ?? "?";
    add({
      kind: "key",
      kindLabel: "Key",
      id: k.id,
      name: `${a.name} (${from} → ${to})`,
      path: `${from} → ${to}`,
      definition: a.definition_text,
      fields: { alias: present(a.alias), definition: present(a.definition_text), other: [] },
      marks: [],
      anchors: { entities: [...new Set([a.entity_id, otherId])], tables: [] },
    });
  }

  const inputsOf = new Map<Uuid, Uuid[]>();
  for (const i of [...(rows.cube_mapping_input ?? [])].sort((x, y) => x.sort_order - y.sort_order)) {
    if (i.deleted_at === null) inputsOf.set(i.mapping_id, [...(inputsOf.get(i.mapping_id) ?? []), i.attribute_id]);
  }
  for (const x of rows.cube_mapping ?? []) {
    const a = attributes.get(x.attribute_id);
    if (x.deleted_at !== null || !a) continue;
    const inputs = inputsOf.get(x.id) ?? [];
    const inputEntities = inputs.map((id) => attributes.get(id)?.entity_id).filter((id): id is Uuid => !!id);
    add({
      kind: "cube_mapping",
      kindLabel: "Dimensional mapping",
      id: x.id,
      name: `${inputs.map(attrName).join(", ") || "?"} → ${attrName(a.id)}`,
      path: x.kind === "lookup" ? "Lookup" : x.kind === "transform" ? "Transform" : "Direct",
      definition: x.note,
      fields: { alias: [], definition: present(x.note), other: present(x.rule_expression) },
      marks: [{ t: "status", status: x.status }],
      anchors: { entities: [...new Set([a.entity_id, ...inputEntities])], tables: [] },
    });
  }
  return out;
}

export const CUBE_CATALOG: CatalogContribution = {
  module: "infocube",
  tables: CUBE_CATALOG_TABLES,
  tabs: CUBE_CATALOG_TABS,
  on: (w) => w.infocube,
  items: cubeCatalogItems,
};
