// What InfoCube shows in InfoMapper's pages (slice 15a, B-1, B-3, X-4), as plain data: each fact's and dimension's
// role, the Cube tab's groups and a dimensional entity's rows in its delete preview. Pure; the composition root reads
// the rows and hands the result to InfoMapper's pages.

import type { Uuid } from "@/domain/ids";
import type { Entity, Relationship, StandardColumns } from "@/domain/types";
import { carries, dimensionAs, type CubeIndex } from "./keys";
import { lookupDependents, mappingAttributeDeletes, mappingDependents, type MappingIndex } from "./mappings";
import { aggregateIndex, type AggregateIndex } from "./aggregates";
import { outriggers, type Outriggers } from "./outriggers";
import { SCD_NUMBER, type Additivity, type CubeEntity, type CubeKey, type CubeMapping, type CubeMappingInput, type CubeMeasure, type CubeRole, type DimKind, type FactType } from "./types";

export const ROLE_NAMES: Record<CubeRole, string> = { fact: "Fact", dimension: "Dimension" };

/**
 * Slice 19 (D-74, prototype `FTYPE_L`, `FTYPE_S`, `cubeTitle`): a fact type's full name and its word in the chip
 * (a transaction adds none).
 */
export const FACT_TYPE_NAMES: Record<FactType, string> = { transaction: "Transaction", periodic: "Periodic snapshot", accumulating: "Accumulating snapshot" };
export const FACT_TYPE_CHIP: Record<FactType, string> = { transaction: "", periodic: "Snapshot", accumulating: "Accumulating" };
export const DIM_KIND_NAMES: Record<DimKind, string> = { standard: "Standard", junk: "Junk" };

type Live<T> = T & { deleted_at: null };
const live = <T extends { deleted_at: string | null }>(rows: readonly T[]) => rows.filter((r): r is Live<T> => r.deleted_at === null);

/** Each live dimensional entity's InfoCube row, by entity id (an entity without one has no role). */
export function rolesOf(cubeEntities: readonly CubeEntity[]): Map<Uuid, CubeEntity> {
  return new Map(live(cubeEntities).map((c) => [c.entity_id, c]));
}

/** A dimension's history as shown (prototype `scdLabel`): "SCD 0", "SCD 1", "SCD 2", "Snapshot · {period}" or "Snapshot". */
export function historyLabel(c: Pick<CubeEntity, "history" | "snapshot_period"> | undefined): string {
  if (c?.history === "snapshot") return c.snapshot_period?.trim() ? `Snapshot · ${c.snapshot_period.trim()}` : "Snapshot";
  return `SCD ${SCD_NUMBER[c?.history ?? "overwrite"]}`;
}

/** What the slice-19 texts read besides the row: the aggregates, the outriggers and the entities' names. */
export interface TypeContext {
  aggregates: AggregateIndex;
  outriggers: Outriggers;
  nameOf(entityId: Uuid): string;
}

/** The context from the rows and the model (the page's and the composition root's reads). */
export function typeContext(
  cubeEntities: readonly CubeEntity[],
  relationships: readonly Relationship[],
  entities: readonly Pick<Entity, "id" | "name" | "deleted_at">[],
): TypeContext {
  const roles = rolesOf(cubeEntities);
  const names = new Map(entities.filter((e) => e.deleted_at === null).map((e) => [e.id, e.name]));
  return { aggregates: aggregateIndex(cubeEntities), outriggers: outriggers(relationships, (id) => roles.get(id)?.role), nameOf: (id) => names.get(id) ?? "?" };
}

/**
 * The right side of an item in the Cube tab (prototype `cubeTree`): a fact's type, factless, aggregate and grain; a
 * dimension's history, junk and outrigger; each part only when it applies, joined with " · ".
 */
export function tabMeta(c: CubeEntity, x?: TypeContext): string {
  if (c.role === "fact") {
    return [
      FACT_TYPE_CHIP[c.fact_type ?? "transaction"],
      c.is_factless ? "factless" : "",
      x?.aggregates.baseOf(c.entity_id) ? "aggregate" : "",
      c.grain?.trim() ? "grain set" : "no grain",
    ].filter(Boolean).join(" · ");
  }
  return [historyLabel(c), c.dim_kind === "junk" ? "junk" : "", x?.outriggers.outOf(c.entity_id).length ? "outrigger" : ""].filter(Boolean).join(" · ");
}

/**
 * The card's and the panel's role (prototype `cubeTitle`): the short text ("Fact · Snapshot · Aggregate", "Dimension ·
 * Junk") and the long one for the title ("Periodic snapshot fact, factless, aggregate of Fact Sales").
 */
export function cubeTitle(c: CubeEntity, x: TypeContext): { short: string; long: string } {
  if (c.role === "fact") {
    const base = x.aggregates.baseOf(c.entity_id);
    const type = c.fact_type ?? "transaction";
    return {
      short: [ROLE_NAMES.fact, FACT_TYPE_CHIP[type], c.is_factless ? "Factless" : "", base ? "Aggregate" : ""].filter(Boolean).join(" · "),
      long: [`${FACT_TYPE_NAMES[type]} fact`, c.is_factless ? "factless" : "", base ? `aggregate of ${x.nameOf(base)}` : ""].filter(Boolean).join(", "),
    };
  }
  const outOf = x.outriggers.outOf(c.entity_id);
  const snapshot = c.history === "snapshot";
  const period = c.snapshot_period?.trim();
  return {
    short: [ROLE_NAMES.dimension, c.dim_kind === "junk" ? "Junk" : "", snapshot ? "Snapshot" : "", outOf.length ? "Outrigger" : ""].filter(Boolean).join(" · "),
    long: [
      c.dim_kind === "junk" ? "Junk dimension" : "Dimension",
      snapshot ? `snapshot${period ? ` (${period})` : ""}` : "",
      outOf.length ? `outrigger of ${outOf.map((d) => x.nameOf(d)).join(", ")}` : "",
    ].filter(Boolean).join(", "),
  };
}

/** The card's and the panel's tooltip on the role: the long text and " (InfoCube)" (step 1, P2). */
export const roleTitle = (c: CubeEntity, x: TypeContext): string => `${cubeTitle(c, x).long} (InfoCube)`;

/** The Cube tab's two groups (B-1): facts, then dimensions, each in the model's order of entities. */
export function cubeSections(
  entities: readonly Entity[],
  cubeEntities: readonly CubeEntity[],
  /** Slice 19: for the aggregates and outriggers in the items' text. */
  relationships: readonly Relationship[] = [],
): { role: CubeRole; entities: { id: Uuid; meta: string }[] }[] {
  const roles = rolesOf(cubeEntities);
  const x = typeContext(cubeEntities, relationships, entities);
  return (["fact", "dimension"] as const).map((role) => ({
    role,
    entities: entities.flatMap((e) => {
      const c = roles.get(e.id);
      return e.deleted_at === null && c?.role === role ? [{ id: e.id, meta: tabMeta(c, x) }] : [];
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
  /** Slice 18 (F14): InfoCube's mapping rows, for the lookups through the relationships the entity takes along. */
  cubeMappings: readonly CubeMapping[] = [],
): [string, string][] {
  const roles = rolesOf(cubeEntities);
  const own = roles.get(entityId);
  if (!own) return mappings ? [...mappingDependents(mappings, { entityId }), ...lookupDependents(mappings, cubeMappings, model.relationships, entityId)] : [];
  const rows: [string, string][] = [];
  if (own.role === "fact") {
    rows.push([ROLE_NAMES.fact, own.grain?.trim() ? `its grain (“${own.grain.trim()}”) deleted` : "deleted"]);
    // slice 19: the aggregates lose their base (the cascade's `follows` clears it)
    const name = new Map(model.entities.map((e) => [e.id, e.name]));
    const aggregates = aggregateIndex(cubeEntities).aggregatesOf(entityId);
    if (aggregates.length) rows.push([aggregates.map((id) => name.get(id) ?? "?").join(", "), aggregates.length > 1 ? "lose their base fact" : "loses its base fact"]);
  } else {
    rows.push([ROLE_NAMES.dimension, own.history === "snapshot" ? `its history (${historyLabel(own)}) deleted` : `SCD type ${SCD_NUMBER[own.history ?? "overwrite"]} deleted`]);
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
      // slice 18: "lookup of {input}" for a lookup (prototype `attrRow`)
      title: ms.length ? ms.map((m, k) => `${m.kind === "lookup" ? "lookup of" : "from"} ${inputs[k]!.map((i) => index.label(i.attribute_id)).join(" + ")}`).join("\n") : NOT_FED,
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
