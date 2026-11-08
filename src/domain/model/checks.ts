// Model checks (slice 20, PRD items 1–6; prototype `modelChecks`, `chkIndex`): what the model itself says that is
// probably wrong, read from the model as it stands. Read only: nothing is stored, dismissed or changed by a check.
//
// InfoMapper's groups are here (copies and keys, names, calculations); a module adds its own groups through the
// composition root (`ModuleChecks`, `src/compose/checks.ts`), and this file never names a module. A group is High or
// Normal; groups are shown High first, InfoMapper's before the modules' within a severity, each in its fixed order.
//
// Levels (step 1, answer 6): duplicate names, calculated and mapped, and lost originals at both levels; keys copied the
// wrong way, keys copied without a relationship and relationships without a copied key at the logical level only (a
// fact's keys are InfoCube's hints).
//
// A copy's key (answer 5): a copy of a copy is read at the end of its chain, the first attribute that is not a copy;
// a lost link on the way gives no key (that copy is a "lost" line). A foreign key on a relationship's many side whose
// name is the one side's primary key's (`nameKey`) also counts as its copy for "no copied key" (answer 1).

import type { Uuid } from "../ids";
import type { Attribute, CanvasItem, Entity, Relationship, WorkspaceModel } from "../types";
import type { ModelLookup } from "./requirements";

// ---- the shapes the pages read ----

/** What a check line opens or a panel lists it under. `ext` is a module's object (a dimensional mapping). */
export type CheckRef = { t: "entity"; id: Uuid } | { t: "attribute"; id: Uuid } | { t: "relationship"; id: Uuid } | { t: "ext"; kind: string; id: Uuid };
/** A card mark: an entity's header or an attribute's row. */
export type CheckMark = { t: "entity"; id: Uuid } | { t: "attribute"; id: Uuid };

export interface CheckLine {
  /** What a click opens (the prototype's `go`). */
  go: CheckRef;
  /** The prototype's `n`. */
  name: string;
  /** The prototype's `m`. */
  detail: string;
  /** The panels that list it (the prototype's `refs`). */
  panels: CheckRef[];
  /** The marks it puts on cards. */
  marks: CheckMark[];
  /** The entities it names: the canvas's count and the home's choice of canvas, the first one first. */
  entities: Uuid[];
  /** A fact's hint (InfoCube): its fact; the fact's panel counts it and lists it in its own section. */
  hintOf?: Uuid;
}

export interface CheckGroup {
  id: string;
  title: string;
  /** The panel group's label ("wrong way"). */
  short: string;
  /** The sentence under the title on the project home. */
  hint: string;
  high: boolean;
  /** A module's groups carry its tag ("InfoCube"); InfoMapper's have none. */
  module?: string;
  lines: CheckLine[];
}

/** What a module adds (the extension point): its groups, and its words for the home's sentences. */
export interface ModuleChecks {
  /** Joined to "names, calculations, copied keys" ("InfoCube"). */
  topic: string;
  /** Joined to the empty text's "Names, calculations and keys agree" ("so do facts and their feeds"). */
  allWell: string;
  groups: CheckGroup[];
}

export type CheckModel = Pick<WorkspaceModel, "entities" | "attributes" | "relationships" | "attributeInputs" | "lostOriginals">;

export interface CheckInput {
  model: CheckModel;
  /** The requirement index's lookup (`RequirementIndex.lookup`): mappings, feeds, calculations, coverage. */
  lookup: ModelLookup;
  /** The entities in scope (the project home); null: the whole model (a canvas, the panels). */
  scope: ReadonlySet<Uuid> | null;
}

export interface ModelChecks {
  /** Groups with lines only, High first. */
  groups: CheckGroup[];
  /** Lines in all groups. */
  count: number;
  high: boolean;
  /** The modules' topics and empty-text parts, for the home's sentences. */
  topics: string[];
  allWell: string[];
}

// ---- texts (approved in step 1) ----

export const CHECK_TEXTS = {
  title: "Model checks",
  wrong: {
    title: "Keys copied the wrong way",
    short: "wrong way",
    hint: "A foreign key belongs on the many side of its relationship. Copy the key of the one side instead.",
  },
  dup: {
    title: "Duplicate attribute names",
    short: "duplicate name",
    hint: "Two attributes of one entity share a name, ignoring case and extra spaces. Rename or delete one.",
  },
  calc: {
    title: "Calculated and mapped",
    short: "calculated and mapped",
    hint: "A calculated attribute takes its value from its inputs. Keep the calculation or the mapping, or say in the rule why both.",
  },
  lost: {
    title: "Copies whose original was deleted",
    short: "original deleted",
    hint: "The copy keeps its type, but nothing updates it any more. Stop following, or undo the delete.",
  },
  norel: {
    title: "Keys copied without a relationship",
    short: "no relationship",
    hint: "A copied key stands for a relationship. Relate the two entities, or delete the copy.",
  },
  nokey: {
    title: "Relationships without a copied key",
    short: "no copied key",
    hint: "The many side should hold a copy of the one side's primary key. Copy it, or check the cardinality.",
  },
  /** The home's sentence, with the modules' topics ("and InfoCube"). */
  intro: (topics: readonly string[]) =>
    `What the model itself says, for the entities on this project's canvases: names, calculations, copied keys${topics.map((t) => ` and ${t}`).join("")}. Computed when this page opens; nothing is stored or changed.`,
  /** The home's text with no line. */
  allWell: (parts: readonly string[]) => `Names, calculations and keys agree${parts.map((p) => `, and ${p}`).join("")}. Nothing to look at.`,
  /** The home's stats link. */
  stat: (n: number) => `${n} model check${n === 1 ? "" : "s"}`,
  statTitle: "Go to Model checks",
  status: "Model checks",
  statusTitle: "Show the model checks for the cards on this canvas",
  canvasHint: "For the cards on this canvas. Click one to select it.",
  showAll: (n: number) => `Show all ${n}`,
  showFirst: "Show the first 20",
  high: "High",
  normal: "Normal",
  hints: (n: number) => `${n === 1 ? "1 hint" : `${n} hints`} in the Fact section below.`,
  // the details
  copyOneSide: (key: string, one: string, verb: string | null) => `copy of ${key}, but ${one} is the one side of “${verb || "the relationship"}”`,
  sameName: (n: number) => `${n} attributes, one name`,
  calculatedToo: (inputs: number, n: number, dimensional: boolean) => `calculated from ${inputs}, also ${n} ${dimensional ? "feed" : "mapping"}${n === 1 ? "" : "s"}`,
  copyDeleted: (original: string) => `copy of ${original}, which was deleted`,
  notRelated: (key: string, entity: string, other: string) => `copy of ${key}; ${entity} and ${other} are not related`,
  noCopy: (many: string, keys: readonly string[]) => `${many} has no copy of ${keys.join(", ")}`,
  // "not yet covered", one per input (F12, answer 8), in this order
  leftSource: (a: string) => `${a} reads a column that left the source`,
  approvedConflict: (a: string) => `${a}'s approved source mapping has a type conflict`,
  calculationGap: (a: string) => `an input of ${a}'s calculation is not covered`,
  notApproved: (a: string) => `${a} has no approved source mapping`,
  notMapped: (a: string) => `${a} is not mapped`,
} as const;

// ---- helpers ----

/** A name compared for duplicates (D-46's spirit, step 1 answer 2): trimmed, runs of white space as one, case ignored. */
export const nameKey = (name: string): string => name.trim().replace(/\s+/g, " ").toLocaleLowerCase();

const live = <T extends { deleted_at: string | null }>(rows: readonly T[]): T[] => rows.filter((r) => r.deleted_at === null);
const byOrder = (a: Attribute, b: Attribute) => a.sort_order - b.sort_order || a.name.localeCompare(b.name);

/** The key a copy stands for: the end of its chain of copies; null for an attribute that is no copy, or a lost link. */
export function keyOfCopy(attributeId: Uuid, attribute: (id: Uuid) => Attribute | undefined): Attribute | null {
  const start = attribute(attributeId);
  if (!start?.copied_from_attribute_id) return null;
  const seen = new Set<Uuid>([start.id]);
  let at = start;
  while (at.copied_from_attribute_id) {
    const next = attribute(at.copied_from_attribute_id);
    if (!next || seen.has(next.id)) return null; // a lost link, or a cycle (never written by the commands)
    seen.add(next.id);
    at = next;
  }
  return at;
}

/** The entities with a live card on the project's canvases (the home's scope, Q1): as model consistency's loop. */
export function projectScope(items: readonly Pick<CanvasItem, "canvas_id" | "entity_id" | "deleted_at">[], canvasIds: readonly Uuid[]): Set<Uuid> {
  const canvases = new Set(canvasIds);
  const out = new Set<Uuid>();
  for (const i of items) if (i.deleted_at === null && i.entity_id && canvases.has(i.canvas_id)) out.add(i.entity_id);
  return out;
}

// ---- the rules ----

/**
 * The model's checks: InfoMapper's groups and the modules' (each module's already built for the same input), High
 * first, InfoMapper's before the modules' within a severity; groups without lines are dropped.
 */
export function modelChecks(input: CheckInput, modules: readonly ModuleChecks[] = []): ModelChecks {
  const own = infoMapperGroups(input);
  const theirs = modules.flatMap((m) => m.groups);
  const all = [...own, ...theirs].filter((g) => g.lines.length);
  const groups = [...all.filter((g) => g.high), ...all.filter((g) => !g.high)];
  return {
    groups,
    count: groups.reduce((n, g) => n + g.lines.length, 0),
    high: groups.some((g) => g.high),
    topics: modules.map((m) => m.topic),
    allWell: modules.map((m) => m.allWell),
  };
}

/** InfoMapper's six groups, in their order (wrong, dup, calc, lost, norel, nokey); empty ones included. */
export function infoMapperGroups({ model, lookup, scope }: CheckInput): CheckGroup[] {
  const entities = live(model.entities);
  const entityById = new Map<Uuid, Entity>(entities.map((e) => [e.id, e]));
  const attributes = live(model.attributes).filter((a) => entityById.has(a.entity_id));
  const attributeById = new Map(attributes.map((a) => [a.id, a]));
  const attributesOf = new Map<Uuid, Attribute[]>();
  for (const a of attributes) (attributesOf.get(a.entity_id) ?? attributesOf.set(a.entity_id, []).get(a.entity_id)!).push(a);
  for (const list of attributesOf.values()) list.sort(byOrder);
  const inScope = (entityId: Uuid) => entityById.has(entityId) && (!scope || scope.has(entityId));
  const logical = (entityId: Uuid) => entityById.get(entityId)?.model_level === "logical";
  const entityName = (id: Uuid) => entityById.get(id)?.name ?? "?";
  const path = (a: Attribute) => `${entityName(a.entity_id)}.${a.name}`;
  const scoped = entities.filter((e) => inScope(e.id));
  const attributesInScope = scoped.flatMap((e) => attributesOf.get(e.id) ?? []);
  const attributeRef = (a: Attribute): CheckRef => ({ t: "attribute", id: a.id });
  const rowMark = (a: Attribute): CheckMark => ({ t: "attribute", id: a.id });
  const keyOf = (a: Attribute) => keyOfCopy(a.id, (id) => attributeById.get(id));

  // duplicate names, per entity, both levels
  const dup: CheckLine[] = [];
  for (const e of scoped) {
    const byName = new Map<string, Attribute[]>();
    for (const a of attributesOf.get(e.id) ?? []) (byName.get(nameKey(a.name)) ?? byName.set(nameKey(a.name), []).get(nameKey(a.name))!).push(a);
    for (const list of byName.values()) {
      if (list.length < 2) continue;
      dup.push({
        go: attributeRef(list[1]!),
        name: `${e.name}: ${list.map((a) => a.name).join(", ")}`,
        detail: CHECK_TEXTS.sameName(list.length),
        panels: list.map(attributeRef),
        marks: list.map(rowMark),
        entities: [e.id],
      });
    }
  }

  // calculated and mapped (logical) or fed (dimensional), any status
  const calc: CheckLine[] = [];
  for (const a of attributesInScope) {
    if (!a.is_calculated) continue;
    const dimensional = !logical(a.entity_id);
    const n = dimensional ? lookup.feedsOf(a.id).length : (lookup.mappingsOfAttribute.get(a.id) ?? []).length;
    if (!n) continue;
    calc.push({ go: attributeRef(a), name: path(a), detail: CHECK_TEXTS.calculatedToo(lookup.calculationInputs(a.id).length, n, dimensional), panels: [attributeRef(a)], marks: [rowMark(a)], entities: [a.entity_id] });
  }

  // copies whose original was deleted, both levels
  const lostName = new Map(model.lostOriginals.map((o) => [o.id, `${o.entityName}.${o.name}`]));
  const lost: CheckLine[] = [];
  for (const a of attributesInScope) {
    const original = a.copied_from_attribute_id;
    if (!original || attributeById.has(original)) continue;
    lost.push({ go: attributeRef(a), name: path(a), detail: CHECK_TEXTS.copyDeleted(lostName.get(original) ?? "an attribute"), panels: [attributeRef(a)], marks: [rowMark(a)], entities: [a.entity_id] });
  }

  // logical relationships between two entities, by pair
  const relationships = live(model.relationships).filter((r) => r.from_entity_id !== r.to_entity_id && logical(r.from_entity_id) && logical(r.to_entity_id));
  const pair = (x: Uuid, y: Uuid) => (x < y ? `${x}|${y}` : `${y}|${x}`);
  const related = new Set(relationships.map((r) => pair(r.from_entity_id, r.to_entity_id)));

  // keys copied without a relationship (logical)
  const norel: CheckLine[] = [];
  for (const a of attributesInScope) {
    if (!logical(a.entity_id)) continue;
    const key = keyOf(a);
    if (!key?.is_primary_key || key.entity_id === a.entity_id || related.has(pair(a.entity_id, key.entity_id))) continue;
    norel.push({
      go: attributeRef(a),
      name: path(a),
      detail: CHECK_TEXTS.notRelated(path(key), entityName(a.entity_id), entityName(key.entity_id)),
      panels: [attributeRef(a)],
      marks: [rowMark(a)],
      entities: [a.entity_id],
    });
  }

  // one-to-many relationships: the wrong way, and no copied key (1:1, M:N and self relationships are not checked)
  const wrong: CheckLine[] = [];
  const nokey: CheckLine[] = [];
  const wrongSeen = new Set<Uuid>();
  for (const r of relationships) {
    if (!inScope(r.from_entity_id) && !inScope(r.to_entity_id)) continue;
    const ends = oneAndMany(r);
    if (!ends) continue;
    const { one, many } = ends;
    const relationshipRef: CheckRef = { t: "relationship", id: r.id };
    const manyAttributes = attributesOf.get(many) ?? [];
    const keys = (attributesOf.get(one) ?? []).filter((a) => a.is_primary_key);
    const carries = (a: Attribute, pk: Attribute) => keyOf(a)?.id === pk.id || (a.is_foreign_key && nameKey(a.name) === nameKey(pk.name));
    const missing = keys.filter((pk) => !manyAttributes.some((a) => carries(a, pk)));
    if (missing.length) {
      nokey.push({
        go: relationshipRef,
        name: `${entityName(one)} – ${entityName(many)}${r.label?.trim() ? ` (${r.label.trim()})` : ""}`,
        detail: CHECK_TEXTS.noCopy(entityName(many), missing.map((k) => k.name)),
        panels: [relationshipRef, { t: "entity", id: many }],
        marks: [{ t: "entity", id: many }],
        entities: [one, many],
      });
    }
    for (const a of attributesOf.get(one) ?? []) {
      const key = keyOf(a);
      if (!key?.is_primary_key || key.entity_id !== many || wrongSeen.has(a.id)) continue;
      wrongSeen.add(a.id);
      wrong.push({
        go: attributeRef(a),
        name: path(a),
        detail: CHECK_TEXTS.copyOneSide(path(key), entityName(one), r.label?.trim() || null),
        panels: [attributeRef(a), relationshipRef],
        marks: [rowMark(a)],
        entities: [one, many],
      });
    }
  }

  const group = (id: "wrong" | "dup" | "calc" | "lost" | "norel" | "nokey", lines: CheckLine[], high = false): CheckGroup => ({ id, ...CHECK_TEXTS[id], high, lines });
  return [group("wrong", wrong, true), group("dup", dup), group("calc", calc), group("lost", lost), group("norel", norel), group("nokey", nokey)];
}

/** A relationship's "one" and "many" ends; null for 1:1 and many-to-many. `from_max` is the multiplicity at the from end. */
export function oneAndMany(r: Pick<Relationship, "from_entity_id" | "to_entity_id" | "from_max" | "to_max">): { one: Uuid; many: Uuid } | null {
  const fromOne = r.from_max === "1", toOne = r.to_max === "1";
  if (fromOne === toOne) return null;
  return fromOne ? { one: r.from_entity_id, many: r.to_entity_id } : { one: r.to_entity_id, many: r.from_entity_id };
}

/**
 * Why a logical attribute is not covered by D-31's rule, as a check's words (F12, step 1 answer 8), in this order: a
 * column that left the source, an approved mapping with a type conflict, a calculation's input, no approved mapping, not
 * mapped. Null when it is covered. For a module's "not yet covered" lines.
 */
export function coverageGapText(lookup: ModelLookup, attributeId: Uuid): string | null {
  if (lookup.coverageOf(attributeId) === "covered") return null;
  const name = lookup.attribute.get(attributeId)?.name ?? "?";
  const mappings = lookup.mappingsOfAttribute.get(attributeId) ?? [];
  if (mappings.some((m) => (lookup.inputsOf.get(m.id) ?? []).some((c) => c.missing_since !== null))) return CHECK_TEXTS.leftSource(name);
  if (lookup.gapReason(attributeId) === "type_conflict") return CHECK_TEXTS.approvedConflict(name);
  if (lookup.calculationInputs(attributeId).length) return CHECK_TEXTS.calculationGap(name);
  return mappings.length ? CHECK_TEXTS.notApproved(name) : CHECK_TEXTS.notMapped(name);
}

// ---- the index (by element: marks, panels, a canvas's lines) ----

export interface IndexedLine {
  group: Pick<CheckGroup, "id" | "title" | "short" | "high" | "module">;
  line: CheckLine;
}

export interface CheckMarkInfo {
  high: boolean;
  /** "Model checks: {n}" and up to six "{group}: {name or hint}", then "…". */
  title: string;
}

export interface CheckIndex {
  /** Every line, High first, in the groups' order. */
  lines: readonly IndexedLine[];
  /** The lines a panel lists for its object, High first. An entity's also has its attributes' lines. */
  panel(ref: CheckRef): IndexedLine[];
  /** How many fact hints an entity has (its panel counts them; the Fact section lists them). */
  hintsOf(entityId: Uuid): number;
  /** An entity card header's mark: its own lines and its attributes' rows' lines. */
  entityMark(entityId: Uuid): CheckMarkInfo | undefined;
  /** An attribute row's mark. */
  rowMark(attributeId: Uuid): CheckMarkInfo | undefined;
  /** The lines that name an entity with a card on a canvas, High first. */
  onCanvas(entityIds: Iterable<Uuid>): IndexedLine[];
}

export const refKey = (r: CheckRef): string => (r.t === "ext" ? `ext:${r.kind}:${r.id}` : `${r.t}:${r.id}`);

/** The marks' title (prototype `chkTitle`). */
export function markTitle(lines: readonly IndexedLine[]): string {
  const parts = [...new Set(lines.map((l) => `${l.group.title}: ${l.line.hintOf ? l.line.detail : l.line.name}`))];
  return [`${CHECK_TEXTS.title}: ${lines.length}`, ...parts.slice(0, 6), ...(lines.length > 6 ? ["…"] : [])].join("\n");
}

/**
 * The index of a model's checks, built once per page; `attributes` gives each attribute's entity (a row's mark also
 * marks its card's header, and an entity's panel lists its attributes' lines).
 */
export function checkIndex(checks: Pick<ModelChecks, "groups">, attributes: readonly Pick<Attribute, "id" | "entity_id">[]): CheckIndex {
  const entityOf = new Map(attributes.map((a) => [a.id, a.entity_id]));
  const lines: IndexedLine[] = checks.groups.flatMap((g) => {
    const group = { id: g.id, title: g.title, short: g.short, high: g.high, ...(g.module ? { module: g.module } : {}) };
    return g.lines.map((line) => ({ group, line }));
  });
  const put = <K>(map: Map<K, IndexedLine[]>, key: K, l: IndexedLine) => {
    const list = map.get(key);
    if (!list) map.set(key, [l]);
    else if (list[list.length - 1] !== l) list.push(l);
  };
  const byPanel = new Map<string, IndexedLine[]>();
  const byEntityPanel = new Map<Uuid, IndexedLine[]>();
  const byEntity = new Map<Uuid, IndexedLine[]>();
  const byRow = new Map<Uuid, IndexedLine[]>();
  const hints = new Map<Uuid, number>();
  const byName = new Map<Uuid, IndexedLine[]>();
  for (const l of lines) {
    for (const r of l.line.panels) {
      put(byPanel, refKey(r), l);
      const entity = r.t === "attribute" ? entityOf.get(r.id) : undefined;
      if (entity) put(byEntityPanel, entity, l);
    }
    for (const m of l.line.marks) {
      if (m.t === "attribute") {
        put(byRow, m.id, l);
        const entity = entityOf.get(m.id);
        if (entity) put(byEntity, entity, l);
      } else put(byEntity, m.id, l);
    }
    if (l.line.hintOf) hints.set(l.line.hintOf, (hints.get(l.line.hintOf) ?? 0) + 1);
    for (const e of new Set(l.line.entities)) put(byName, e, l);
  }
  const ordered = (set: Set<IndexedLine>) => lines.filter((l) => set.has(l));
  const mark = (list: IndexedLine[] | undefined): CheckMarkInfo | undefined => (list?.length ? { high: list.some((l) => l.group.high), title: markTitle(list) } : undefined);
  return {
    lines,
    panel(ref) {
      const own = byPanel.get(refKey(ref)) ?? [];
      if (ref.t !== "entity") return own;
      return ordered(new Set([...own, ...(byEntityPanel.get(ref.id) ?? [])]));
    },
    hintsOf: (id) => hints.get(id) ?? 0,
    entityMark: (id) => mark(byEntity.get(id)),
    rowMark: (id) => mark(byRow.get(id)),
    onCanvas(entityIds) {
      const set = new Set<IndexedLine>();
      for (const e of entityIds) for (const l of byName.get(e) ?? []) set.add(l);
      return ordered(set);
    },
  };
}
