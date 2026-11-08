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
//
// Marks apart from texts (Łukasz, step 2's second round): a rule gives items, each with what it opens, the panels that
// list it, the marks it puts on cards and the entities it names, and a `text()` that builds its name and detail only
// when the item is shown (the home's section, the panels, a card's title). After a write a page needs only the marks
// and the counts (`checkIndex`); the lines are built where they are shown (`lineOf`).
//
// The rules read the requirement index's lookup (its live attributes, per entity in the model's order, its mappings,
// feeds and calculations) and build no map of their own beyond the entities'.

import type { Uuid } from "../ids";
import type { Attribute, CanvasItem, Entity, Relationship, WorkspaceModel } from "../types";
import type { ModelLookup } from "./requirements";

// ---- the shapes the pages read ----

/** What a check line opens or a panel lists it under. `ext` is a module's object (a dimensional mapping). */
export type CheckRef = { t: "entity"; id: Uuid } | { t: "attribute"; id: Uuid } | { t: "relationship"; id: Uuid } | { t: "ext"; kind: string; id: Uuid };
/** A card mark: an entity's header or an attribute's row. */
export type CheckMark = { t: "entity"; id: Uuid } | { t: "attribute"; id: Uuid };

/** A line's words: the prototype's `n` and `m`. */
export interface CheckText {
  name: string;
  detail: string;
}

/** What a rule finds: references only; its words are built by `text()` when it is shown. */
export interface CheckItem {
  /** What a click opens (the prototype's `go`). */
  go: CheckRef;
  /** The panels that list it (the prototype's `refs`). */
  panels: readonly CheckRef[];
  /** The marks it puts on cards. */
  marks: readonly CheckMark[];
  /** The entities it names: the canvas's count and the home's choice of canvas, the first one first. */
  entities: readonly Uuid[];
  /** A fact's hint (a module's): its fact; the fact's panel counts it and lists it in its own section. */
  hintOf?: Uuid;
  /** Its name and detail, built when it is shown. */
  text: () => CheckText;
}

/** An item with its words, where it is shown. */
export type CheckLine = Omit<CheckItem, "text"> & CheckText;
export const lineOf = (item: CheckItem): CheckLine => {
  const { text, ...rest } = item;
  return { ...rest, ...text() };
};

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
  items: CheckItem[];
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
  /** The requirement index's lookup (`RequirementIndex.lookup`): attributes, mappings, feeds, calculations, coverage. */
  lookup: ModelLookup;
  /** The entities in scope (the project home); null: the whole model (a canvas, the panels). */
  scope: ReadonlySet<Uuid> | null;
}

export interface ModelChecks {
  /** Groups with items only, High first. */
  groups: CheckGroup[];
  /** Items in all groups. */
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
const NONE: readonly Attribute[] = [];

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
 * first, InfoMapper's before the modules' within a severity; groups without items are dropped.
 */
export function modelChecks(input: CheckInput, modules: readonly ModuleChecks[] = []): ModelChecks {
  const all = [...infoMapperGroups(input), ...modules.flatMap((m) => m.groups)].filter((g) => g.items.length);
  const groups = [...all.filter((g) => g.high), ...all.filter((g) => !g.high)];
  return {
    groups,
    count: groups.reduce((n, g) => n + g.items.length, 0),
    high: groups.some((g) => g.high),
    topics: modules.map((m) => m.topic),
    allWell: modules.map((m) => m.allWell),
  };
}

/** A relationship's "one" and "many" ends; null for 1:1 and many-to-many. `from_max` is the multiplicity at the from end. */
export function oneAndMany(r: Pick<Relationship, "from_entity_id" | "to_entity_id" | "from_max" | "to_max">): { one: Uuid; many: Uuid } | null {
  const fromOne = r.from_max === "1", toOne = r.to_max === "1";
  if (fromOne === toOne) return null;
  return fromOne ? { one: r.from_entity_id, many: r.to_entity_id } : { one: r.to_entity_id, many: r.from_entity_id };
}

/** InfoMapper's six groups, in their order (wrong, dup, calc, lost, norel, nokey); empty ones included. */
export function infoMapperGroups({ model, lookup, scope }: CheckInput): CheckGroup[] {
  const entities = live(model.entities);
  const entityById = new Map<Uuid, Entity>();
  for (const e of entities) entityById.set(e.id, e);
  const attributeById = lookup.attribute;
  const attributesOf = (entityId: Uuid) => lookup.attributesOf.get(entityId) ?? NONE;
  const inScope = (entityId: Uuid) => entityById.has(entityId) && (!scope || scope.has(entityId));
  const logical = (entityId: Uuid) => entityById.get(entityId)?.model_level === "logical";
  const entityName = (id: Uuid) => entityById.get(id)?.name ?? "?";
  const path = (a: Attribute) => `${entityName(a.entity_id)}.${a.name}`;
  const at = (a: Attribute): CheckRef => ({ t: "attribute", id: a.id });
  // each name normalised once, each copy's key once (several rules read them)
  const nameKeys = new Map<Uuid, string>();
  const keyName = (a: Attribute) => {
    let k = nameKeys.get(a.id);
    if (k === undefined) nameKeys.set(a.id, (k = nameKey(a.name)));
    return k;
  };
  const copyKeys = new Map<Uuid, Attribute | null>();
  const keyOf = (a: Attribute) => {
    if (!a.copied_from_attribute_id) return null;
    let k = copyKeys.get(a.id);
    if (k === undefined) copyKeys.set(a.id, (k = keyOfCopy(a.id, (id) => attributeById.get(id))));
    return k;
  };

  const wrong: CheckItem[] = [], dup: CheckItem[] = [], calc: CheckItem[] = [], lost: CheckItem[] = [], norel: CheckItem[] = [], nokey: CheckItem[] = [];

  // logical relationships between two entities, by pair
  const relationships = live(model.relationships).filter((r) => r.from_entity_id !== r.to_entity_id && logical(r.from_entity_id) && logical(r.to_entity_id));
  const pair = (x: Uuid, y: Uuid) => (x < y ? `${x}|${y}` : `${y}|${x}`);
  const related = new Set<string>();
  for (const r of relationships) related.add(pair(r.from_entity_id, r.to_entity_id));
  const lostName = new Map(model.lostOriginals.map((o) => [o.id, `${o.entityName}.${o.name}`]));

  // one pass over the attributes of the entities in scope: dup, calc, lost and norel
  for (const e of entities) {
    if (!inScope(e.id)) continue;
    const list = attributesOf(e.id);
    const isLogical = e.model_level === "logical";
    let byName: Map<string, Attribute[]> | null = null;
    const seen = new Map<string, Attribute>();
    for (const a of list) {
      // duplicate names, both levels: a second attribute of a name opens the set
      const k = keyName(a);
      const first = seen.get(k);
      if (first) {
        byName ??= new Map();
        const set = byName.get(k);
        if (set) set.push(a);
        else byName.set(k, [first, a]);
      } else seen.set(k, a);
      // calculated and mapped (logical) or fed (dimensional), any status
      if (a.is_calculated) {
        const n = isLogical ? (lookup.mappingsOfAttribute.get(a.id)?.length ?? 0) : lookup.feedsOf(a.id).length;
        if (n) calc.push({ go: at(a), panels: [at(a)], marks: [at(a)] as CheckMark[], entities: [e.id], text: () => ({ name: path(a), detail: CHECK_TEXTS.calculatedToo(lookup.calculationInputs(a.id).length, n, !isLogical) }) });
      }
      const original = a.copied_from_attribute_id;
      if (!original) continue;
      // copies whose original was deleted, both levels
      if (!attributeById.has(original)) {
        lost.push({ go: at(a), panels: [at(a)], marks: [at(a)] as CheckMark[], entities: [e.id], text: () => ({ name: path(a), detail: CHECK_TEXTS.copyDeleted(lostName.get(original) ?? "an attribute") }) });
        continue;
      }
      // keys copied without a relationship (logical)
      if (!isLogical) continue;
      const key = keyOf(a);
      if (!key?.is_primary_key || key.entity_id === e.id || related.has(pair(e.id, key.entity_id))) continue;
      norel.push({ go: at(a), panels: [at(a)], marks: [at(a)] as CheckMark[], entities: [e.id], text: () => ({ name: path(a), detail: CHECK_TEXTS.notRelated(path(key), e.name, entityName(key.entity_id)) }) });
    }
    if (byName) {
      for (const set of byName.values()) {
        const refs = set.map(at);
        dup.push({ go: refs[1]!, panels: refs, marks: refs as CheckMark[], entities: [e.id], text: () => ({ name: `${e.name}: ${set.map((a) => a.name).join(", ")}`, detail: CHECK_TEXTS.sameName(set.length) }) });
      }
    }
  }

  // what an entity holds of other entities' keys, once per entity: its copies' keys and its foreign keys' names
  const held = new Map<Uuid, { keys: Set<Uuid>; names: Set<string> }>();
  const carriedBy = (entityId: Uuid) => {
    let h = held.get(entityId);
    if (!h) {
      h = { keys: new Set(), names: new Set() };
      for (const a of attributesOf(entityId)) {
        const key = keyOf(a);
        if (key) h.keys.add(key.id);
        if (a.is_foreign_key) h.names.add(keyName(a));
      }
      held.set(entityId, h);
    }
    return h;
  };

  // one-to-many relationships: the wrong way, and no copied key (1:1, M:N and self relationships are not checked)
  const wrongSeen = new Set<Uuid>();
  for (const r of relationships) {
    if (!inScope(r.from_entity_id) && !inScope(r.to_entity_id)) continue;
    const ends = oneAndMany(r);
    if (!ends) continue;
    const { one, many } = ends;
    const rel: CheckRef = { t: "relationship", id: r.id };
    const verb = r.label?.trim() || null;
    const oneList = attributesOf(one);
    const h = carriedBy(many);
    let missing: Attribute[] | null = null;
    for (const a of oneList) if (a.is_primary_key && !h.keys.has(a.id) && !h.names.has(keyName(a))) (missing ??= []).push(a);
    if (missing) {
      const keys = missing;
      const manyRef: CheckMark = { t: "entity", id: many };
      nokey.push({ go: rel, panels: [rel, manyRef], marks: [manyRef], entities: [one, many], text: () => ({ name: `${entityName(one)} – ${entityName(many)}${verb ? ` (${verb})` : ""}`, detail: CHECK_TEXTS.noCopy(entityName(many), keys.map((k) => k.name)) }) });
    }
    for (const a of oneList) {
      const key = keyOf(a);
      if (!key?.is_primary_key || key.entity_id !== many || wrongSeen.has(a.id)) continue;
      wrongSeen.add(a.id);
      wrong.push({ go: at(a), panels: [at(a), rel], marks: [at(a)] as CheckMark[], entities: [one, many], text: () => ({ name: path(a), detail: CHECK_TEXTS.copyOneSide(path(key), entityName(one), verb) }) });
    }
  }

  const group = (id: "wrong" | "dup" | "calc" | "lost" | "norel" | "nokey", items: CheckItem[], high = false): CheckGroup => ({ id, ...CHECK_TEXTS[id], high, items });
  return [group("wrong", wrong, true), group("dup", dup), group("calc", calc), group("lost", lost), group("norel", norel), group("nokey", nokey)];
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

// ---- the index: marks and counts at once, lists when they are shown ----

export interface IndexedItem {
  group: Pick<CheckGroup, "id" | "title" | "short" | "high" | "module">;
  item: CheckItem;
}

/** A card mark: its severity and its groups (ids, in the groups' order). Its title is built where the card is drawn. */
export interface CheckMarkInfo {
  high: boolean;
  groups: readonly string[];
}

export interface CheckIndex {
  count: number;
  high: boolean;
  /** An entity card header's mark: its own items and its attributes' rows' items. */
  entityMark(entityId: Uuid): CheckMarkInfo | undefined;
  /** An attribute row's mark. */
  rowMark(attributeId: Uuid): CheckMarkInfo | undefined;
  /** How many items name an entity with a card on a canvas, and whether one is High (the status bar, the panel's group). */
  countOn(entityIds: Iterable<Uuid>): { count: number; high: boolean };
  // the lists below are built on their first call
  /** Every item, High first, in the groups' order. */
  all(): readonly IndexedItem[];
  /** The items a panel lists for its object, High first. An entity's also has its attributes' items. */
  panel(ref: CheckRef): IndexedItem[];
  /** How many fact hints an entity has (its panel counts them; the Fact section lists them). */
  hintsOf(entityId: Uuid): number;
  /** The items behind a header's or a row's mark, for its title (`markTitle`). */
  entityItems(entityId: Uuid): readonly IndexedItem[];
  rowItems(attributeId: Uuid): readonly IndexedItem[];
  /** The items that name an entity with a card on a canvas, High first. */
  onCanvas(entityIds: Iterable<Uuid>): IndexedItem[];
}

export const refKey = (r: CheckRef): string => (r.t === "ext" ? `ext:${r.kind}:${r.id}` : `${r.t}:${r.id}`);

/** The marks' title (prototype `chkTitle`): "Model checks: {n}" and up to six "{group}: {name or hint}", then "…". */
export function markTitle(items: readonly IndexedItem[]): string {
  const parts = [...new Set(items.slice(0, 64).map((l) => { const t = l.item.text(); return `${l.group.title}: ${l.item.hintOf ? t.detail : t.name}`; }))];
  return [`${CHECK_TEXTS.title}: ${items.length}`, ...parts.slice(0, 6), ...(items.length > 6 ? ["…"] : [])].join("\n");
}

/**
 * The index of a model's checks, built once per data version. `entityOf` gives an attribute's entity (a row's mark also
 * marks its card's header; an entity's panel lists its attributes' items). The marks and the counts are worked out at
 * once; every list on its first call.
 */
export function checkIndex(checks: Pick<ModelChecks, "groups" | "count" | "high">, entityOf: (attributeId: Uuid) => Uuid | undefined): CheckIndex {
  const entityMarks = new Map<Uuid, { high: boolean; groups: string[] }>();
  const rowMarks = new Map<Uuid, { high: boolean; groups: string[] }>();
  const note = (map: Map<Uuid, { high: boolean; groups: string[] }>, id: Uuid, g: CheckGroup) => {
    const m = map.get(id);
    if (!m) map.set(id, { high: g.high, groups: [g.id] });
    else {
      m.high ||= g.high;
      if (m.groups[m.groups.length - 1] !== g.id) m.groups.push(g.id);
    }
  };
  for (const g of checks.groups) {
    for (const item of g.items) {
      for (const k of item.marks) {
        if (k.t === "attribute") {
          note(rowMarks, k.id, g);
          const e = entityOf(k.id);
          if (e) note(entityMarks, e, g);
        } else note(entityMarks, k.id, g);
      }
    }
  }

  let lists: ReturnType<typeof buildLists> | null = null;
  const built = () => (lists ??= buildLists(checks.groups, entityOf));
  return {
    count: checks.count,
    high: checks.high,
    entityMark: (id) => entityMarks.get(id),
    rowMark: (id) => rowMarks.get(id),
    countOn(entityIds) {
      const on = entityIds instanceof Set ? (entityIds as ReadonlySet<Uuid>) : new Set(entityIds);
      let count = 0, high = false;
      for (const g of checks.groups) for (const item of g.items) if (item.entities.some((e) => on.has(e))) {
        count++;
        high ||= g.high;
      }
      return { count, high };
    },
    all: () => built().all,
    panel(ref) {
      const l = built();
      const own = l.byPanel.get(refKey(ref)) ?? [];
      if (ref.t !== "entity") return own;
      const set = new Set([...own, ...(l.byEntityPanel.get(ref.id) ?? [])]);
      return l.all.filter((x) => set.has(x));
    },
    hintsOf: (id) => built().hints.get(id) ?? 0,
    entityItems: (id) => built().byEntity.get(id) ?? [],
    rowItems: (id) => built().byRow.get(id) ?? [],
    onCanvas(entityIds) {
      const on = new Set(entityIds);
      return built().all.filter((x) => x.item.entities.some((e) => on.has(e)));
    },
  };
}

function buildLists(groups: readonly CheckGroup[], entityOf: (attributeId: Uuid) => Uuid | undefined) {
  const all: IndexedItem[] = groups.flatMap((g) => {
    const group = { id: g.id, title: g.title, short: g.short, high: g.high, ...(g.module ? { module: g.module } : {}) };
    return g.items.map((item) => ({ group, item }));
  });
  const put = <K>(map: Map<K, IndexedItem[]>, key: K, l: IndexedItem) => {
    const list = map.get(key);
    if (!list) map.set(key, [l]);
    else if (list[list.length - 1] !== l) list.push(l);
  };
  const byPanel = new Map<string, IndexedItem[]>();
  const byEntityPanel = new Map<Uuid, IndexedItem[]>();
  const byEntity = new Map<Uuid, IndexedItem[]>();
  const byRow = new Map<Uuid, IndexedItem[]>();
  const hints = new Map<Uuid, number>();
  for (const l of all) {
    for (const r of l.item.panels) {
      put(byPanel, refKey(r), l);
      const entity = r.t === "attribute" ? entityOf(r.id) : undefined;
      if (entity) put(byEntityPanel, entity, l);
    }
    for (const m of l.item.marks) {
      if (m.t === "attribute") {
        put(byRow, m.id, l);
        const entity = entityOf(m.id);
        if (entity) put(byEntity, entity, l);
      } else put(byEntity, m.id, l);
    }
    if (l.item.hintOf) hints.set(l.item.hintOf, (hints.get(l.item.hintOf) ?? 0) + 1);
  }
  return { all, byPanel, byEntityPanel, byEntity, byRow, hints };
}
