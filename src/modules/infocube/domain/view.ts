// What InfoCube shows in InfoMapper's pages (slice 15a, B-1, B-3, X-4), as plain data: each fact's and dimension's
// role, the Cube tab's groups and a dimensional entity's rows in its delete preview. Pure; the composition root reads
// the rows and hands the result to InfoMapper's pages.

import type { Uuid } from "@/domain/ids";
import type { Entity, Relationship, StandardColumns } from "@/domain/types";
import { carries, dimensionAs, type CubeIndex } from "./keys";
import { mappingAttributeDeletes, mappingDependents, type MappingIndex } from "./mappings";
import type { Additivity, CubeEntity, CubeKey, CubeMapping, CubeMappingInput, CubeMeasure, CubeRole } from "./types";

export const ROLE_NAMES: Record<CubeRole, string> = { fact: "Fact", dimension: "Dimension" };

/** The card's tooltip on the role (prototype `entCard`, without "is off here": a role exists only while on, C-7). */
export const ROLE_TITLES: Record<CubeRole, string> = { fact: "A fact: one row per its grain (InfoCube)", dimension: "A dimension (InfoCube)" };

type Live<T> = T & { deleted_at: null };
const live = <T extends { deleted_at: string | null }>(rows: readonly T[]) => rows.filter((r): r is Live<T> => r.deleted_at === null);

/** Each live dimensional entity's InfoCube row, by entity id (an entity without one has no role). */
export function rolesOf(cubeEntities: readonly CubeEntity[]): Map<Uuid, CubeEntity> {
  return new Map(live(cubeEntities).map((c) => [c.entity_id, c]));
}

/** The right side of an item in the Cube tab (prototype `cubeTree`): a fact's grain, a dimension's SCD type. */
export const tabMeta = (c: CubeEntity): string => (c.role === "fact" ? (c.grain?.trim() ? "grain set" : "no grain") : `SCD ${c.scd_type ?? 1}`);

/** The Cube tab's two groups (B-1): facts, then dimensions, each in the model's order of entities. */
export function cubeSections(entities: readonly Entity[], cubeEntities: readonly CubeEntity[]): { role: CubeRole; entities: { id: Uuid; meta: string }[] }[] {
  const roles = rolesOf(cubeEntities);
  return (["fact", "dimension"] as const).map((role) => ({
    role,
    entities: entities.flatMap((e) => {
      const c = roles.get(e.id);
      return e.deleted_at === null && c?.role === role ? [{ id: e.id, meta: tabMeta(c) }] : [];
    }),
  }));
}

const counted = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * What deleting a fact or a dimension takes with it (X-4, prototype `cubeDependents`), as rows of its delete preview:
 * its role with a fact's grain or a dimension's SCD type; for a dimension, the facts that lose it, each once however
 * many relationships join them (PRD section 2); its measures. Slice 15c: with `mappings`, the dimensional mappings that
 * go with it (X-4), and for a logical entity the mappings that read its attributes and the facts and dimensions that
 * lose their feed (X-2).
 */
export function entityDependents(
  entityId: Uuid,
  model: { entities: readonly Entity[]; relationships: readonly Relationship[]; attributes: readonly { id: Uuid; entity_id: Uuid; deleted_at: string | null }[] },
  cubeEntities: readonly CubeEntity[],
  cubeMeasures: readonly CubeMeasure[],
  mappings?: MappingIndex,
): [string, string][] {
  const roles = rolesOf(cubeEntities);
  const own = roles.get(entityId);
  if (!own) return mappings ? mappingDependents(mappings, { entityId }) : [];
  const rows: [string, string][] = [];
  if (own.role === "fact") rows.push([ROLE_NAMES.fact, own.grain?.trim() ? `its grain (“${own.grain.trim()}”) deleted` : "deleted"]);
  else {
    rows.push([ROLE_NAMES.dimension, `SCD type ${own.scd_type ?? 1} deleted`]);
    const name = new Map(model.entities.map((e) => [e.id, e.name]));
    const facts = [
      ...new Set(
        model.relationships
          .filter((r) => r.deleted_at === null && (r.from_entity_id === entityId || r.to_entity_id === entityId))
          .map((r) => (r.from_entity_id === entityId ? r.to_entity_id : r.from_entity_id))
          .filter((id) => roles.get(id)?.role === "fact"),
      ),
    ];
    if (facts.length) rows.push([counted(facts.length, "fact"), `lose this dimension: ${facts.map((id) => name.get(id) ?? "?").join(", ")}`]);
  }
  const attributes = new Set(model.attributes.filter((a) => a.entity_id === entityId && a.deleted_at === null).map((a) => a.id));
  const measures = live(cubeMeasures).filter((m) => attributes.has(m.attribute_id)).length;
  if (measures) rows.push([counted(measures, "measure"), "deleted"]);
  if (mappings) rows.push(...mappingDependents(mappings, { entityId }));
  return rows;
}

// ---- slice 15b: what the page gets for the panels' sections, the Σ marks and an attribute's delete ----

/** InfoCube's rows as a page gets them: without `created_*` and `updated_*` (O8). */
export type PageRow<T> = Omit<T, "created_at" | "created_by" | "updated_at" | "updated_by">;
export function pageRow<T extends StandardColumns>(row: T): PageRow<T> {
  const rest: Partial<T> = { ...row };
  delete rest.created_at;
  delete rest.created_by;
  delete rest.updated_at;
  delete rest.updated_by;
  return rest as PageRow<T>;
}

/** The module's rows on a page (`ModuleView.data.infocube`): the live ones only. */
export interface CubePageRows {
  cubeEntities: PageRow<CubeEntity>[];
  cubeMeasures: PageRow<CubeMeasure>[];
  cubeKeys: PageRow<CubeKey>[];
  /** Slice 15c: the dimensional mappings and their inputs (the drag's plan, the line's menu, the panels). */
  cubeMappings: PageRow<CubeMapping>[];
  cubeMappingInputs: PageRow<CubeMappingInput>[];
  /** Each mapping's last content editor while four-eyes is on (O9; `moduleView`): the panel's note before approving. */
  contentAuthors?: Record<Uuid, Uuid>;
}

export function cubePageRows(
  cubeEntities: readonly CubeEntity[],
  cubeMeasures: readonly CubeMeasure[],
  cubeKeys: readonly CubeKey[],
  cubeMappings: readonly CubeMapping[] = [],
  cubeMappingInputs: readonly CubeMappingInput[] = [],
): CubePageRows {
  return {
    cubeEntities: live(cubeEntities).map(pageRow),
    cubeMeasures: live(cubeMeasures).map(pageRow),
    cubeKeys: live(cubeKeys).map(pageRow),
    cubeMappings: live(cubeMappings).map(pageRow),
    cubeMappingInputs: live(cubeMappingInputs).map(pageRow),
  };
}

/** The coverage bar's word on a fact's or a dimension's card (slice 15c, P17; prototype `entCard`). */
export const FED_COVERAGE = "fed from the logical model";
/** A dimensional row's dot without a feed (prototype `attrRow`). */
export const NOT_FED = "Not fed from the logical model";
/** The Overview's and the entity panel's words for a fact's or a dimension's feeds (prototype l. 2276, `insEntity`). */
export const FEED_WORDS = { word: "fed", title: "Attributes fed from the logical model", list: "Attributes and their logical feed", none: "no feed" } as const;

/**
 * Every dimensional attribute's state on cards (C12; prototype `attrRow`): how many dimensional mappings feed it (any
 * status) and the dot's tooltip, one "from {inputs}" line per mapping, or "Not fed from the logical model".
 */
export function cubeRowFeeds(index: MappingIndex, attributes: readonly { id: Uuid; deleted_at: string | null }[]): Record<Uuid, { n: number; title: string; list: string }> {
  const out: Record<Uuid, { n: number; title: string; list: string }> = {};
  for (const a of attributes) {
    if (a.deleted_at !== null || index.levelOf(a.id) !== "dimensional") continue;
    const ms = index.mappingsTo(a.id);
    const inputs = ms.map((m) => index.inputsOf(m.id));
    out[a.id] = {
      n: ms.length,
      title: ms.length ? inputs.map((list) => `from ${list.map((i) => index.label(i.attribute_id)).join(" + ")}`).join("\n") : NOT_FED,
      // the entity panel's list (prototype `insEntity`): one input's label, or "ƒ {n} attributes"
      list: inputs.map((list) => (list.length > 1 ? `ƒ ${list.length} attributes` : index.label(list[0]?.attribute_id ?? ""))).join(", "),
    };
  }
  return out;
}

/** A measure row's classes on a card (R5): the glyph is the module's CSS, `::after` on the row's type. */
export const MEASURE_CLASS: Record<Additivity, string> = { additive: "meas add", semi: "meas semi", non: "meas non" };

/** The Σ marks (B-3): each measure of a fact, by attribute id. */
export function measureMarks(index: CubeIndex, attributes: readonly { id: Uuid; entity_id: Uuid; deleted_at: string | null }[]): Record<Uuid, string> {
  const marks: Record<Uuid, string> = {};
  for (const a of attributes) {
    if (a.deleted_at !== null || index.roleOf(a.entity_id) !== "fact") continue;
    const m = index.measureOf(a.id);
    if (m) marks[a.id] = MEASURE_CLASS[m.additivity];
  }
  return marks;
}

/** The link's part of an attribute's second click (R4): what deleting a key changes elsewhere. */
export const linkGoes = (what: string) => `the link to ${what} is deleted, the relationship stays`;

/**
 * What an attribute's delete takes along (R4, R-9), for its second click: its measure, and the link of the key it
 * carries while that link is active. Only attributes with one of them. Slice 15c: with `mappings`, its dimensional
 * mappings and, for a logical attribute, the facts and dimensions that lose their feed (X-3).
 */
export function attributeDeletes(
  index: CubeIndex,
  attributes: readonly { id: Uuid; deleted_at: string | null }[],
  mappings?: MappingIndex,
): Record<Uuid, { also: string[]; then: string[]; toast?: string[] }> {
  const out: Record<Uuid, { also: string[]; then: string[]; toast?: string[] }> = mappings ? mappingAttributeDeletes(mappings, attributes) : {};
  for (const a of attributes) {
    if (a.deleted_at !== null) continue;
    const carried = carries(index, a.id);
    const measure = index.measureOf(a.id);
    if (!carried && !measure) continue;
    const fed = out[a.id];
    out[a.id] = {
      also: [...(measure ? ["1 measure"] : []), ...(fed?.also ?? [])],
      then: [...(carried ? [linkGoes(dimensionAs(index, carried))] : []), ...(fed?.then ?? [])],
      ...(fed?.toast ? { toast: fed.toast } : {}),
    };
  }
  return out;
}
