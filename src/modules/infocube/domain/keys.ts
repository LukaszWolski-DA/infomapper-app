// What InfoCube derives from InfoMapper's relationships and its own key links (slice 15b, role-playing RP-B, R-2 to R-6,
// R-9; B-5 with R-4): a fact's dimensions, one row per relationship, with the role at the dimension's end and the key
// that carries it; its hints; a dimension's "Used by"; a foreign key's "Carries"; an attribute's rows in its delete
// preview; and Add key's name. Nothing here is stored: it is read from the model and InfoCube's rows (D-68).
//
// A key link is **active** while its relationship and its attribute are live, the attribute is a foreign key and belongs
// to the relationship's fact. A link whose attribute is no foreign key is **inactive** (R3, Łukasz, 4 November 2026):
// every read here ignores it, nothing deletes it, and it is active again when the flag is back. No key is ever matched
// by name (RP-C).

import type { Uuid } from "@/domain/ids";
import type { Attribute, Entity, Relationship } from "@/domain/types";
import { aggregateIndex, type AggregateIndex } from "./aggregates";
import { outriggers, type Outriggers } from "./outriggers";
import type { CubeEntity, CubeKey, CubeMeasure } from "./types";

/** The model and InfoCube's rows a read needs (deleted rows are ignored). */
export interface CubeModel {
  entities: readonly Pick<Entity, "id" | "name" | "deleted_at">[];
  attributes: readonly Attribute[];
  relationships: readonly Relationship[];
  cubeEntities: readonly CubeEntity[];
  cubeMeasures: readonly CubeMeasure[];
  cubeKeys: readonly CubeKey[];
}

const isLive = <T extends { deleted_at: string | null }>(r: T | undefined | null): r is T => !!r && r.deleted_at === null;
const byOrder = (a: Attribute, b: Attribute) => a.sort_order - b.sort_order || a.name.localeCompare(b.name);

/** The two ends of a relationship between a fact and a dimension; null for any other relationship. */
export function factEnds(r: Pick<Relationship, "from_entity_id" | "to_entity_id">, roleOf: (id: Uuid) => CubeEntity["role"] | undefined): { fact: Uuid; dimension: Uuid } | null {
  const [from, to] = [roleOf(r.from_entity_id), roleOf(r.to_entity_id)];
  if (from === "fact" && to === "dimension") return { fact: r.from_entity_id, dimension: r.to_entity_id };
  if (from === "dimension" && to === "fact") return { fact: r.to_entity_id, dimension: r.from_entity_id };
  return null;
}

/** The role at an entity's end of a relationship (RP-A), or null. */
export const roleAt = (r: Pick<Relationship, "from_entity_id" | "from_role" | "to_role">, entityId: Uuid): string | null =>
  (r.from_entity_id === entityId ? r.from_role : r.to_role)?.trim() || null;

/** " as {role}", or nothing (the spec's `asRole`). */
export const asRole = (role: string | null): string => (role ? ` as ${role}` : "");

/** A fact's relationship to a dimension (R-2): its role at the dimension's end and the key that carries it. */
export interface FactKey {
  relationshipId: Uuid;
  factId: Uuid;
  dimensionId: Uuid;
  role: string | null;
  /** The active key, or null ("no key"). */
  key: Attribute | null;
  /** The dimension's primary key, which Add key needs; null while it has none. */
  pk: Attribute | null;
}

/** One read of the model for InfoCube's derived rows, built once per page or command. */
export interface CubeIndex {
  roleOf(entityId: Uuid): CubeEntity["role"] | undefined;
  cubeOf(entityId: Uuid): CubeEntity | undefined;
  nameOf(entityId: Uuid): string;
  attribute(id: Uuid): Attribute | undefined;
  /** The live attributes of an entity, in their order. */
  attributesOf(entityId: Uuid): readonly Attribute[];
  relationship(id: Uuid): Relationship | undefined;
  /** The entity's first primary key in its order. */
  pkOf(entityId: Uuid): Attribute | null;
  /** The relationship's live link, active or not (for the commands: one live link per relationship). */
  linkOfRelationship(relationshipId: Uuid): CubeKey | undefined;
  /** The attribute's live link, active or not. */
  linkOfAttribute(attributeId: Uuid): CubeKey | undefined;
  /** The relationship's active key. */
  keyOf(relationshipId: Uuid): Attribute | null;
  /** The relationship an attribute carries, while its link is active. */
  carriedBy(attributeId: Uuid): Relationship | null;
  measureOf(attributeId: Uuid): CubeMeasure | undefined;
  /** The fact's relationships to dimensions, in the model's order (R-2). */
  factKeys(factId: Uuid): FactKey[];
  /** Slice 19: aggregate facts (`aggregates.ts`), built on first use. */
  aggregates(): AggregateIndex;
  /** Slice 19: outriggers, derived from the live relationships (`outriggers.ts`), built on first use. */
  outriggers(): Outriggers;
  /** Slice 19: the dimensions a fact is related to, each once, in the order of its relationships. */
  dimensionsOf(factId: Uuid): Uuid[];
}

export function cubeIndex(model: CubeModel): CubeIndex {
  const cubes = new Map(model.cubeEntities.filter(isLive).map((c) => [c.entity_id, c]));
  const names = new Map(model.entities.filter(isLive).map((e) => [e.id, e.name]));
  const attributes = new Map(model.attributes.filter(isLive).map((a) => [a.id, a]));
  const attributesOf = new Map<Uuid, Attribute[]>();
  for (const a of attributes.values()) (attributesOf.get(a.entity_id) ?? attributesOf.set(a.entity_id, []).get(a.entity_id)!).push(a);
  for (const list of attributesOf.values()) list.sort(byOrder);
  const relationships = model.relationships.filter(isLive);
  const relationshipById = new Map(relationships.map((r) => [r.id, r]));
  const roleOf = (id: Uuid) => cubes.get(id)?.role;
  const linkOfRelationship = new Map<Uuid, CubeKey>();
  const linkOfAttribute = new Map<Uuid, CubeKey>();
  for (const k of model.cubeKeys.filter(isLive)) {
    linkOfRelationship.set(k.relationship_id, k);
    linkOfAttribute.set(k.attribute_id, k);
  }
  const measures = new Map(model.cubeMeasures.filter(isLive).map((m) => [m.attribute_id, m]));

  const keyOf = (relationshipId: Uuid): Attribute | null => {
    const r = relationshipById.get(relationshipId);
    const link = linkOfRelationship.get(relationshipId);
    const ends = r && factEnds(r, roleOf);
    const key = link && attributes.get(link.attribute_id);
    return ends && key && key.is_foreign_key && key.entity_id === ends.fact ? key : null;
  };
  const pkOf = (entityId: Uuid) => attributesOf.get(entityId)?.find((a) => a.is_primary_key) ?? null;
  let byFact: Map<Uuid, { r: Relationship; dimension: Uuid }[]> | undefined;
  let aggregates: AggregateIndex | undefined;
  let outs: Outriggers | undefined;
  const groupByFact = () => {
    const out = new Map<Uuid, { r: Relationship; dimension: Uuid }[]>();
    for (const r of relationships) {
      const ends = factEnds(r, roleOf);
      if (ends) (out.get(ends.fact) ?? out.set(ends.fact, []).get(ends.fact)!).push({ r, dimension: ends.dimension });
    }
    return out;
  };

  return {
    roleOf,
    cubeOf: (id) => cubes.get(id),
    nameOf: (id) => names.get(id) ?? "?",
    attribute: (id) => attributes.get(id),
    attributesOf: (id) => attributesOf.get(id) ?? [],
    relationship: (id) => relationshipById.get(id),
    pkOf,
    linkOfRelationship: (id) => linkOfRelationship.get(id),
    linkOfAttribute: (id) => linkOfAttribute.get(id),
    keyOf,
    carriedBy(attributeId) {
      const link = linkOfAttribute.get(attributeId);
      return link && keyOf(link.relationship_id)?.id === attributeId ? relationshipById.get(link.relationship_id)! : null;
    },
    measureOf: (id) => measures.get(id),
    factKeys(factId) {
      if (roleOf(factId) !== "fact") return [];
      // the relationships grouped by fact once (slice 15d, D12: the bus matrix asks for every fact)
      byFact ??= groupByFact();
      return (byFact.get(factId) ?? []).map(({ r, dimension }) => ({ relationshipId: r.id, factId, dimensionId: dimension, role: roleAt(r, dimension), key: keyOf(r.id), pk: pkOf(dimension) }));
    },
    aggregates: () => (aggregates ??= aggregateIndex(model.cubeEntities)),
    outriggers: () => (outs ??= outriggers(relationships, roleOf)),
    dimensionsOf(factId) {
      if (roleOf(factId) !== "fact") return [];
      byFact ??= groupByFact();
      return [...new Set((byFact.get(factId) ?? []).map((x) => x.dimension))];
    },
  };
}

// ---- Add key's name (R-3) ----

/** The spec's `snake`: "Ship date" → "ship_date", "BillTo" → "bill_to". */
export const snakeCase = (text: string): string =>
  text
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toLowerCase()
    .replace(/^_|_$/g, "");

/**
 * Add key's name (R-3): `{role}_{pk}` with the role in snake case, without repeating the word both share (the primary
 * key's name before `_key`, `_id` or `_sk`): Ship date + `date_key` → `ship_date_key`; Bill to + `customer_key` →
 * `bill_to_customer_key`. Without a role, the primary key's name. A taken name (case ignored) is numbered as default
 * names are: `ship_date_key_2`, `_3`…
 */
export function keyName(role: string | null, pkName: string, taken: readonly string[]): string {
  const rs = snakeCase(role ?? "");
  const m = /^(.*?)(_key|_id|_sk)$/i.exec(pkName);
  const shared = m?.[1]?.toLowerCase();
  const base = !rs ? pkName : m && shared && (rs === shared || rs.endsWith(`_${shared}`)) ? rs + m[2]!.toLowerCase() : `${rs}_${pkName}`;
  const used = new Set(taken.map((t) => t.toLowerCase()));
  let name = base;
  for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base}_${n}`;
  return name;
}

// ---- the fact's hints (B-5 with R-4) ----

export type HintTarget = { t: "grain" } | { t: "entity"; id: Uuid } | { t: "relationship"; id: Uuid } | { t: "attribute"; id: Uuid };
export interface Hint {
  text: string;
  go: HintTarget;
}

/** "Nothing to check" when a fact has no hint (B-5). */
export const NO_HINTS = "Nothing to check: grain, keys and measures look complete.";

const NUMERIC = new Set<Attribute["data_type"]>(["integer", "decimal"]);
const TYPE_WORDS: Record<Attribute["data_type"], string> = {
  string: "String",
  integer: "Integer",
  decimal: "Decimal",
  boolean: "Boolean",
  date: "Date",
  datetime: "Datetime",
  json: "JSON",
  custom: "Custom",
};
/** The type's word in a hint: "String"; a custom type's own name. */
export const typeWord = (a: Pick<Attribute, "data_type" | "custom_type">): string => (a.data_type === "custom" && a.custom_type ? a.custom_type : TYPE_WORDS[a.data_type]);

/**
 * A fact's hints, read only (B-5's grain and measure hints, R-4's key hints in place of B-5's), in the prototype's order:
 * the grain, no dimension at all, a dimension related more than once without a role for each, a role played twice, a
 * relationship no key carries, a foreign key that carries no relationship, a measure that is not numeric.
 */
export function factHints(index: CubeIndex, factId: Uuid): Hint[] {
  const cube = index.cubeOf(factId);
  if (cube?.role !== "fact") return [];
  const keys = index.factKeys(factId);
  const out: Hint[] = [];
  if (!cube.grain?.trim()) out.push({ text: "No grain yet. Write what one row of this fact stands for.", go: { t: "grain" } });
  if (!keys.length) out.push({ text: "No dimension keys. Relate this fact to a dimension and add its key.", go: { t: "entity", id: factId } });
  const byDimension = new Map<Uuid, FactKey[]>();
  for (const k of keys) (byDimension.get(k.dimensionId) ?? byDimension.set(k.dimensionId, []).get(k.dimensionId)!).push(k);
  for (const [dimension, list] of byDimension) {
    const name = index.nameOf(dimension);
    const unnamed = list.find((k) => !k.role);
    if (list.length > 1 && unnamed) out.push({ text: `${name} is related ${list.length} times. Name each role.`, go: { t: "relationship", id: unnamed.relationshipId } });
    const seen = new Map<string, number>();
    for (const k of list.filter((k) => k.role)) {
      const role = k.role!.toLowerCase();
      if (seen.get(role) === 1) out.push({ text: `${name} plays ${k.role} twice.`, go: { t: "relationship", id: k.relationshipId } });
      seen.set(role, (seen.get(role) ?? 0) + 1);
    }
  }
  for (const k of keys.filter((k) => !k.key)) out.push({ text: `${index.nameOf(k.dimensionId)}${asRole(k.role)} is related, but no key carries it.`, go: { t: "relationship", id: k.relationshipId } });
  const attributes = index.attributesOf(factId);
  for (const a of attributes.filter((a) => a.is_foreign_key && !index.carriedBy(a.id))) out.push({ text: `${a.name} is a foreign key but carries no dimension.`, go: { t: "attribute", id: a.id } });
  for (const a of attributes.filter((a) => index.measureOf(a.id) && !NUMERIC.has(a.data_type))) {
    out.push({ text: `${a.name} is a measure but its type is ${typeWord(a)}. Measures are usually Integer or Decimal.`, go: { t: "attribute", id: a.id } });
  }
  // slice 19 (D-74): the fact's type, factless and base (prototype `factHints`)
  const measures = attributes.filter((a) => index.measureOf(a.id));
  if (cube.is_factless && measures.length) out.push({ text: TYPE_HINTS.factless(measures.map((a) => a.name)), go: { t: "attribute", id: measures[0]!.id } });
  if (cube.fact_type === "periodic") {
    for (const a of measures.filter((a) => index.measureOf(a.id)!.additivity === "additive")) out.push({ text: TYPE_HINTS.periodic(a.name), go: { t: "attribute", id: a.id } });
  }
  if (cube.fact_type === "accumulating" && Math.max(0, ...[...byDimension.values()].map((l) => l.length)) < 2) out.push({ text: TYPE_HINTS.accumulating, go: { t: "entity", id: factId } });
  const base = index.aggregates().baseOf(factId);
  if (base) {
    const ofBase = new Set(index.dimensionsOf(base));
    for (const d of index.dimensionsOf(factId).filter((d) => !ofBase.has(d))) out.push({ text: TYPE_HINTS.base(index.nameOf(d), index.nameOf(base)), go: { t: "entity", id: d } });
  }
  return out;
}

/** Slice 19's hints (approved in step 1, the prototype's texts). */
export const TYPE_HINTS = {
  factless: (names: readonly string[]) => `It is marked factless but has measures: ${names.join(", ")}. Turn off one or the other.`,
  periodic: (name: string) => `${name} is additive. In a periodic snapshot, balances and levels are usually semi-additive across the date.`,
  accumulating: "An accumulating snapshot usually carries several dates of its process: a date dimension in several roles.",
  base: (dimension: string, base: string) => `${dimension} is not a dimension of ${base}, its base. An aggregate has the base's dimensions or fewer.`,
} as const;

// ---- the dimension's "Used by" (R-5), a foreign key's "Carries" (R-6) ----

/** One row per relationship of a fact to this dimension (R-5): the facts in the order they first relate, each with its relationships. */
export function usedBy(index: CubeIndex, dimensionId: Uuid, relationships: readonly Relationship[]): FactKey[] {
  if (index.roleOf(dimensionId) !== "dimension") return [];
  const facts: Uuid[] = [];
  for (const r of relationships) {
    if (r.deleted_at !== null) continue;
    const ends = factEnds(r, index.roleOf);
    if (ends?.dimension === dimensionId && !facts.includes(ends.fact)) facts.push(ends.fact);
  }
  return facts.flatMap((f) => index.factKeys(f).filter((k) => k.dimensionId === dimensionId));
}

/** What a fact's foreign key carries (R-6): the relationship, its dimension and role; null while it carries nothing. */
export function carries(index: CubeIndex, attributeId: Uuid): { relationshipId: Uuid; dimensionId: Uuid; role: string | null } | null {
  const r = index.carriedBy(attributeId);
  const ends = r && factEnds(r, index.roleOf);
  return r && ends ? { relationshipId: r.id, dimensionId: ends.dimension, role: roleAt(r, ends.dimension) } : null;
}

/** "Dim Date as Ship date" (R-2, R-5, R-6). */
export const dimensionAs = (index: CubeIndex, k: { dimensionId: Uuid; role: string | null }): string => `${index.nameOf(k.dimensionId)}${asRole(k.role)}`;

// ---- an attribute's delete preview (R-9, X-4) ----

/**
 * What deleting an attribute takes with it in InfoCube (R-9, prototype `cubeDependents` for an attribute): the key link
 * it carries (active only, R3) and its measure. Empty: InfoMapper's delete is as before (R4: the second click only when
 * InfoCube has rows).
 */
export function attributeDependents(index: CubeIndex, attributeId: Uuid): [string, string][] {
  const rows: [string, string][] = [];
  const carried = carries(index, attributeId);
  if (carried) rows.push([`Carries ${dimensionAs(index, carried)}`, "the link is deleted; the relationship stays"]);
  if (index.measureOf(attributeId)) rows.push(["1 measure", "deleted"]);
  return rows;
}
