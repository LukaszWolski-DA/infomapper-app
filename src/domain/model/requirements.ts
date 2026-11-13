// Requirements (D-30, D-31; slice 4a, PRD items 1–8, 13): names shown for kinds, statuses and priorities, the key
// counter, parent cycles, scope and coverage (computed on read, never stored), the direct and indirect requirements of
// an element (prototype `reqsFor`), and who last changed a requirement's content (four-eyes, AD-06).

import type { Uuid } from "../ids";
import type {
  Attribute,
  AttributeInput,
  ChangeEvent,
  Mapping,
  Requirement,
  RequirementKind,
  RequirementLink,
  RequirementPriority,
  RequirementStatus,
  SourceColumn,
  WorkspaceModel,
} from "../types";
import { targetOf, type LabelTarget, type LabelTargetKind } from "./labels";
import { derivationIndex } from "./derivations";
import { checkMappingTypes } from "./type-check";

export const KIND_NAMES: Record<RequirementKind, string> = {
  need: "Business need",
  data: "Data requirement",
  business_rule: "Business rule",
  dq_rule: "Data quality rule",
  non_functional: "Non-functional",
};
export const STATUS_NAMES: Record<RequirementStatus, string> = { draft: "Draft", agreed: "Agreed", implemented: "Implemented", verified: "Verified" };
export const PRIORITY_NAMES: Record<RequirementPriority, string> = { must: "Must", should: "Should", could: "Could", wont: "Won't" };

/** A requirement traces to the same five kinds of element a label marks (AD-15). */
export type TraceTarget = LabelTarget;
export type TraceTargetKind = LabelTargetKind;

/** The kinds that use `expression` (Rule, Check) and `severity` (“When it fails”). */
export const usesExpression = (kind: RequirementKind): boolean => kind === "business_rule" || kind === "dq_rule";
export const usesSeverity = (kind: RequirementKind): boolean => kind === "dq_rule";

// ---- messages ----

export const keyTakenMessage = (key: string): string => `${key} is already used by another requirement.`;
/** Choosing `parentKey` as the parent of `requirementKey`, which `parentKey` is already part of (at any depth). */
export const cycleMessage = (requirementKey: string, parentKey: string): string =>
  `${parentKey} is already part of ${requirementKey}, so ${requirementKey} cannot be part of it.`;
export const OWN_PARENT_MESSAGE = "A requirement cannot be part of itself.";
export const restoreKeyTakenMessage = (key: string): string => `${key} is used by another requirement now, so the deleted one cannot come back.`;
export const fourEyesRequirementMessage = (key: string): string => `You changed ${key} last, so someone else has to agree it.`;
export const DELETED_REQUIREMENT_MESSAGE = (key: string): string => `Deleted ${key}. The model elements it traced to are untouched.`;

// ---- key ----

const live = <R extends { deleted_at: string | null }>(rows: readonly R[]): R[] => rows.filter((r) => r.deleted_at === null);

/** Keys are compared case-insensitively and without surrounding spaces (Łukasz, step 0). */
export const requirementKey = (key: string): string => key.trim().toLowerCase();

/** The live requirement other than `exceptId` that has this key in any case, if any. */
export function requirementWithKey(requirements: readonly Requirement[], key: string, exceptId?: Uuid): Requirement | null {
  const k = requirementKey(key);
  return live(requirements).find((r) => r.id !== exceptId && requirementKey(r.key) === k) ?? null;
}

/**
 * The key for a new requirement: `REQ-{counter}`, skipping numbers whose key is taken (someone typed it), and the
 * counter's next value.
 */
export function nextRequirementKey(counter: number, requirements: readonly Requirement[]): { key: string; next: number } {
  let n = counter;
  while (requirementWithKey(requirements, `REQ-${n}`)) n++;
  return { key: `REQ-${n}`, next: n + 1 };
}

// ---- parent ----

/** The requirement and everything below it (its children, their children, …), as ids. */
export function withDescendants(requirements: readonly Requirement[], id: Uuid): Set<Uuid> {
  const out = new Set<Uuid>([id]);
  const children = new Map<Uuid, Uuid[]>();
  for (const r of live(requirements)) if (r.parent_id) children.set(r.parent_id, [...(children.get(r.parent_id) ?? []), r.id]);
  const queue = [id];
  while (queue.length) {
    for (const c of children.get(queue.shift()!) ?? []) {
      if (!out.has(c)) {
        out.add(c);
        queue.push(c);
      }
    }
  }
  return out;
}

/** Whether `parentId` may become the parent of `id`: not itself and not anything below it, at any depth. */
export const canBeParent = (requirements: readonly Requirement[], id: Uuid, parentId: Uuid): boolean => !withDescendants(requirements, id).has(parentId);

// ---- scope and coverage (D-31) ----

/** Slice 18: `attributeInputs`, the calculations' inputs; absent, nothing is calculated (callers without calculations). */
export type ScopeModel = Pick<WorkspaceModel, "entities" | "attributes" | "mappings" | "mappingInputs" | "sourceTables" | "sourceColumns"> & {
  attributeInputs?: readonly AttributeInput[];
};

/**
 * One mapping that feeds an attribute from other attributes (slice 15d, D-70): a module's own mapping (InfoCube's
 * dimensional mapping, AD-36), as InfoMapper reads it without knowing the module. `typeConflict` is the module's own
 * type check by D-31's rule (Y1): a transformation with a rule passes; otherwise every input's type must fit the target.
 */
export interface AttributeFeed {
  id: Uuid;
  approved: boolean;
  typeConflict: boolean;
  /** The attributes it reads, in their order. */
  inputs: readonly Uuid[];
  /** Slice 26: its status, for a document's mapping filter and status pill; absent from a module that has none. */
  status?: "draft" | "review" | "approved";
}

/** What feeds each dimensional attribute (slice 15d), by the target attribute's id; absent or empty: nothing. */
export type AttributeFeeds = Readonly<Record<Uuid, readonly AttributeFeed[]>>;

/**
 * Why an attribute item with approved mappings does not count (slice 15d, D5, Y1, option A): a fact's or a dimension's
 * attribute whose approved feed reads uncovered attributes, or an attribute at either level whose approved mappings all
 * have a type conflict. Slice 21 (R6, D-76): a logical attribute with an approved mapping that reads a column that left
 * the source (missing or retired), named before a type conflict.
 */
export type GapReason = "logical_feed" | "type_conflict" | "calculation" | "column_left";

/**
 * A requirement's scope (D-31; slice 4b-1, PRD item 9). The five sets say what it touches on a canvas (cards, rows and
 * lines for Focus and the coverage colours); the two item sets say what its coverage counts.
 */
export interface RequirementScope {
  entities: Set<Uuid>;
  attributes: Set<Uuid>;
  mappings: Set<Uuid>;
  tables: Set<Uuid>;
  columns: Set<Uuid>;
  /** Linked entities: one coverage item each. */
  entityItems: Set<Uuid>;
  /** Linked attributes and the attributes of linked mappings: one coverage item each. */
  attributeItems: Set<Uuid>;
  /**
   * Slice 15d (D-70): the logical attributes that feed a dimensional attribute in scope and are not items themselves (the
   * prototype's `sc.up`); also in `attributes`. Present only when there are any.
   */
  feeding?: Set<Uuid>;
  /** Slice 15d: the feeds (a module's mappings) of the dimensional attributes in scope; present only when there are any. */
  feeds?: Set<Uuid>;
  /**
   * Slice 18 (F11): the inputs of calculated attributes in scope, at any depth, that are not items themselves; also in
   * `attributes`. Present only when there are any.
   */
  inputs?: Set<Uuid>;
}

/** An attribute's state for coverage (D-31). */
export type AttributeCoverage = "covered" | "not_approved" | "not_mapped";

/**
 * The live model looked up once (slice 4a, step 3): what scopes and coverage need, so a whole index is built in one
 * pass instead of searching the model per requirement. Each attribute's coverage state is worked out once.
 */
export interface ModelLookup {
  attribute: Map<Uuid, Attribute>;
  /** Live attributes per entity, in model order. */
  attributesOf: Map<Uuid, Attribute[]>;
  /** Live attributes in model order (coverage lists follow it). */
  attributeOrder: Map<Uuid, number>;
  column: Map<Uuid, SourceColumn>;
  mapping: Map<Uuid, Mapping>;
  /** Input columns per mapping (live inputs of live columns). */
  inputsOf: Map<Uuid, SourceColumn[]>;
  /** Live mappings per attribute (slice 4b-1). */
  mappingsOfAttribute: Map<Uuid, Mapping[]>;
  /** Live mappings reading each column (slice 4b-1). */
  mappingsOfColumn: Map<Uuid, Mapping[]>;
  /** Live columns per table (slice 4b-1). */
  columnsOf: Map<Uuid, SourceColumn[]>;
  entities: Set<Uuid>;
  tables: Set<Uuid>;
  coverageOf: (attributeId: Uuid) => AttributeCoverage;
  /** Slice 15d: a live attribute of a dimensional entity. */
  isDimensional: (attributeId: Uuid) => boolean;
  /** Slice 15d: the feeds of a dimensional attribute (none for a logical one). */
  feedsOf: (attributeId: Uuid) => readonly AttributeFeed[];
  /** Slice 15d: why an attribute with approved mappings or feeds is not covered (both levels); null otherwise. */
  gapReason: (attributeId: Uuid) => GapReason | null;
  /** Slice 18: a calculated attribute's live inputs, in order; empty for any other. */
  calculationInputs: (attributeId: Uuid) => readonly Uuid[];
}

const NO_FEEDS: readonly AttributeFeed[] = [];

/**
 * `feeds` (slice 15d): the modules' mappings onto dimensional attributes. A dimensional attribute is covered by D-31's
 * rule one level up (D-70): one of its feeds approved, without a type conflict, and every attribute it reads a live
 * logical attribute covered itself. A feed reads logical attributes only (AD-36); an input that is not one counts as not
 * covered.
 *
 * Slice 18 (D-73, acceptance F2): an attribute at either level is also covered when it is calculated, has at least one
 * input, and every input is covered, recursively; a cycle counts as not covered. A calculated attribute that is not
 * covered by either way and has inputs is a gap with the reason "calculation" (its own mappings' reasons first).
 */
export function lookupModel(model: ScopeModel, feeds: AttributeFeeds = {}): ModelLookup {
  const attribute = new Map<Uuid, Attribute>();
  const attributesOf = new Map<Uuid, Attribute[]>();
  const attributeOrder = new Map<Uuid, number>();
  for (const a of live(model.attributes)) {
    attribute.set(a.id, a);
    attributeOrder.set(a.id, attributeOrder.size);
    const list = attributesOf.get(a.entity_id);
    if (list) list.push(a);
    else attributesOf.set(a.entity_id, [a]);
  }
  const column = new Map(live(model.sourceColumns).map((c) => [c.id, c]));
  const mapping = new Map(live(model.mappings).map((m) => [m.id, m]));
  const inputsOf = new Map<Uuid, SourceColumn[]>();
  const mappingsOfColumn = new Map<Uuid, Mapping[]>();
  for (const i of live(model.mappingInputs)) {
    const c = column.get(i.source_column_id);
    const m = mapping.get(i.mapping_id);
    if (!c || !m) continue;
    const list = inputsOf.get(i.mapping_id);
    if (list) list.push(c);
    else inputsOf.set(i.mapping_id, [c]);
    const reads = mappingsOfColumn.get(c.id);
    if (!reads) mappingsOfColumn.set(c.id, [m]);
    else if (!reads.includes(m)) reads.push(m);
  }
  const columnsOf = new Map<Uuid, SourceColumn[]>();
  for (const c of column.values()) {
    const list = columnsOf.get(c.source_table_id);
    if (list) list.push(c);
    else columnsOf.set(c.source_table_id, [c]);
  }
  const mappingsOf = new Map<Uuid, Mapping[]>();
  for (const m of mapping.values()) {
    const list = mappingsOf.get(m.attribute_id);
    if (list) list.push(m);
    else mappingsOf.set(m.attribute_id, [m]);
  }
  const counts = (m: Mapping): boolean => {
    if (m.status !== "approved") return false;
    const a = attribute.get(m.attribute_id);
    const inputs = inputsOf.get(m.id) ?? [];
    // slice 7a (step 1, answer 9): a mapping from a column missing from source covers nothing
    return !!a && !inputs.some((c) => c.missing_since !== null) && checkMappingTypes(m, a, inputs).ok;
  };
  const level = new Map(live(model.entities).map((e) => [e.id, e.model_level]));
  const levelOf = (attributeId: Uuid) => {
    const a = attribute.get(attributeId);
    return a && level.get(a.entity_id);
  };
  const isDimensional = (attributeId: Uuid) => levelOf(attributeId) === "dimensional";
  const derivation = derivationIndex([...attribute.values()], model.attributeInputs ?? []);
  const visiting = new Set<Uuid>();
  const feedsOf = (attributeId: Uuid) => (isDimensional(attributeId) ? (feeds[attributeId] ?? NO_FEEDS) : NO_FEEDS);
  const states = new Map<Uuid, AttributeCoverage>();
  const inputsCovered = (f: AttributeFeed) => f.inputs.length > 0 && f.inputs.every((i) => levelOf(i) === "logical" && coverageOf(i) === "covered");
  const coverageOf = (attributeId: Uuid): AttributeCoverage => {
    let state = states.get(attributeId);
    if (!state) {
      // a cycle (never written by the commands) counts as not covered, and is not remembered half-way
      if (visiting.has(attributeId)) return "not_mapped";
      visiting.add(attributeId);
      if (isDimensional(attributeId)) {
        const fs = feedsOf(attributeId);
        state = !fs.length ? "not_mapped" : fs.some((f) => f.approved && !f.typeConflict && inputsCovered(f)) ? "covered" : "not_approved";
      } else {
        const ms = mappingsOf.get(attributeId) ?? [];
        state = !ms.length ? "not_mapped" : ms.some(counts) ? "covered" : "not_approved";
      }
      if (state !== "covered" && derivation.isCalculated(attributeId)) {
        const ins = derivation.inputsOf(attributeId);
        if (ins.length) state = ins.every((i) => coverageOf(i) === "covered") ? "covered" : "not_approved";
      }
      visiting.delete(attributeId);
      states.set(attributeId, state);
    }
    return state;
  };
  const gapReason = (attributeId: Uuid): GapReason | null => {
    if (coverageOf(attributeId) !== "not_approved") return null;
    // slice 18: a calculated attribute without approved mappings or feeds of its own: its calculation's input
    const own = isDimensional(attributeId) ? feedsOf(attributeId) : (mappingsOf.get(attributeId) ?? []);
    if (derivation.inputsOf(attributeId).length && !own.some((m) => ("approved" in m ? m.approved : m.status === "approved"))) return "calculation";
    if (!isDimensional(attributeId)) {
      const approved = (mappingsOf.get(attributeId) ?? []).filter((m) => m.status === "approved");
      // slice 21 (R6): an approved mapping that reads a column that left the source (missing or retired)
      if (approved.some((m) => (inputsOf.get(m.id) ?? []).some((c) => c.missing_since !== null || c.retired_since !== null))) return "column_left";
      // slice 15d (option A): a logical attribute whose approved mappings all have a type conflict
      const a = attribute.get(attributeId);
      return !!a && approved.length > 0 && approved.every((m) => !checkMappingTypes(m, a, inputsOf.get(m.id) ?? []).ok) ? "type_conflict" : null;
    }
    const approved = feedsOf(attributeId).filter((f) => f.approved);
    if (approved.some((f) => !f.typeConflict)) return "logical_feed";
    return approved.length ? "type_conflict" : null;
  };
  return {
    attribute,
    attributesOf,
    attributeOrder,
    column,
    mapping,
    inputsOf,
    mappingsOfAttribute: mappingsOf,
    mappingsOfColumn,
    columnsOf,
    entities: new Set(live(model.entities).map((e) => e.id)),
    tables: new Set(live(model.sourceTables).map((t) => t.id)),
    coverageOf,
    isDimensional,
    feedsOf,
    gapReason,
    calculationInputs: derivation.inputsOf,
  };
}

/** The scope of the given links (one requirement's live links). */
export function scopeOfLinks(lookup: ModelLookup, links: readonly RequirementLink[]): RequirementScope {
  const scope: RequirementScope = { entities: new Set(), attributes: new Set(), mappings: new Set(), tables: new Set(), columns: new Set(), entityItems: new Set(), attributeItems: new Set() };
  const addColumn = (id: Uuid) => {
    const c = lookup.column.get(id);
    if (!c) return;
    scope.columns.add(c.id);
    scope.tables.add(c.source_table_id);
  };
  for (const link of links) {
    if (link.deleted_at !== null) continue;
    const t = targetOf(link);
    if (!t) continue;
    // slice 4b-1 (PRD item 9): nothing is pulled in implicitly; an entity link does not bring its attributes
    if (t.kind === "entity" && lookup.entities.has(t.id)) {
      scope.entities.add(t.id);
      scope.entityItems.add(t.id);
    } else if (t.kind === "attribute" && lookup.attribute.has(t.id)) {
      scope.attributes.add(t.id);
      scope.attributeItems.add(t.id);
      scope.entities.add(lookup.attribute.get(t.id)!.entity_id);
    } else if (t.kind === "mapping" && lookup.mapping.has(t.id)) {
      const m = lookup.mapping.get(t.id)!;
      scope.mappings.add(m.id);
      const a = lookup.attribute.get(m.attribute_id);
      if (a) {
        scope.attributes.add(a.id);
        scope.attributeItems.add(a.id);
        scope.entities.add(a.entity_id);
      }
      for (const c of lookup.inputsOf.get(m.id) ?? []) addColumn(c.id);
    } else if (t.kind === "source_table" && lookup.tables.has(t.id)) {
      scope.tables.add(t.id);
    } else if (t.kind === "source_column") addColumn(t.id);
  }
  // slice 15d (D-70): a dimensional attribute in scope brings its feeds and the logical attributes they read, with their
  // entities; they are not items. Their sources follow: Focus lights every scope attribute's mappings with their tables.
  // Slice 18 (F11): a calculated attribute in scope brings its inputs, at any depth, the same way (`inputs`); an input's
  // feeds come along, and a feed's logical input's calculation too.
  const queue = [...scope.attributes];
  const seen = new Set(queue);
  const visit = (id: Uuid) => {
    if (seen.has(id)) return;
    seen.add(id);
    queue.push(id);
  };
  while (queue.length) {
    const id = queue.shift()!;
    for (const input of lookup.calculationInputs(id)) {
      const a = lookup.attribute.get(input);
      if (!a) continue;
      scope.attributes.add(a.id);
      scope.entities.add(a.entity_id);
      if (!scope.attributeItems.has(a.id) && !scope.feeding?.has(a.id)) (scope.inputs ??= new Set()).add(a.id);
      visit(a.id);
    }
    for (const f of lookup.feedsOf(id)) {
      (scope.feeds ??= new Set()).add(f.id);
      for (const input of f.inputs) {
        const a = lookup.attribute.get(input);
        if (!a || lookup.isDimensional(input)) continue;
        scope.attributes.add(a.id);
        scope.entities.add(a.entity_id);
        if (!scope.attributeItems.has(a.id) && !scope.inputs?.has(a.id)) (scope.feeding ??= new Set()).add(a.id);
        visit(a.id);
      }
    }
  }
  return scope;
}

/**
 * A requirement's coverage (D-31; slice 4b-1, PRD item 10): over its items, linked entities first (in model order), then
 * attributes (in model order). An attribute item is covered when it has an approved mapping that passes the type check
 * on every input; an entity item when at least one of its attributes is covered by that rule.
 */
export interface RequirementCoverage {
  /** Items in scope. */
  total: number;
  /** Covered items (entity and attribute ids). */
  covered: Uuid[];
  /** Attribute items with mappings, none of which counts. */
  notApproved: Uuid[];
  /** Attribute items without any mapping. */
  notMapped: Uuid[];
  /** Entity items none of whose attributes is covered. */
  entityGaps: Uuid[];
  /** Of those, the ones with a mapping on some attribute (mapped but not approved; the card's bar, slice 4b-2). */
  entityNotApproved: Uuid[];
  /** The items by kind, for the tooltip (“1 entity, 3 attributes”). */
  parts: { entities: number; attributes: number };
  /** At least one item, and all of them covered. */
  done: boolean;
}

/** “1 entity, 3 attributes” (PRD item 11); “nothing” without items. */
export function coverageParts(parts: RequirementCoverage["parts"]): string {
  const out: string[] = [];
  if (parts.entities) out.push(`${parts.entities} ${parts.entities === 1 ? "entity" : "entities"}`);
  if (parts.attributes) out.push(`${parts.attributes} ${parts.attributes === 1 ? "attribute" : "attributes"}`);
  return out.length ? out.join(", ") : "nothing";
}

/** A gap's reason for an entity item (PRD item 11). */
export const ENTITY_GAP_REASON = "no approved mapping on any attribute";

/** Slice 15d (D5, Y3): a gap's reason for a fact's or a dimension's attribute without a dimensional mapping. */
export const NOT_FED_REASON = "not fed";

/**
 * Slice 15d (D5, Y1, Y3, option A): a gap's reason for an attribute item with mappings, none of which counts: "not
 * approved", or why its approved ones do not count, one set of reasons at both levels.
 */
export const GAP_REASONS: Record<GapReason | "none", string> = {
  none: "not approved",
  logical_feed: "logical feed not covered",
  type_conflict: "type conflict",
  // slice 18 (approved in step 1)
  calculation: "an input of its calculation is not covered",
  // slice 21 (R6, D-76)
  column_left: "column left the source",
};

/** Coverage of a scope, attributes in model order. */
export function coverageOfScope(lookup: ModelLookup, scope: RequirementScope): RequirementCoverage {
  const entities = [...scope.entityItems].filter((id) => lookup.entities.has(id));
  const order = [...scope.attributeItems].filter((id) => lookup.attribute.has(id)).sort((a, b) => lookup.attributeOrder.get(a)! - lookup.attributeOrder.get(b)!);
  const covered: Uuid[] = [], notApproved: Uuid[] = [], notMapped: Uuid[] = [], entityGaps: Uuid[] = [], entityNotApproved: Uuid[] = [];
  for (const id of entities) {
    const states = (lookup.attributesOf.get(id) ?? []).map((a) => lookup.coverageOf(a.id));
    if (states.includes("covered")) covered.push(id);
    else {
      entityGaps.push(id);
      if (states.includes("not_approved")) entityNotApproved.push(id);
    }
  }
  for (const id of order) {
    const state = lookup.coverageOf(id);
    (state === "covered" ? covered : state === "not_approved" ? notApproved : notMapped).push(id);
  }
  const total = entities.length + order.length;
  return { total, covered, notApproved, notMapped, entityGaps, entityNotApproved, parts: { entities: entities.length, attributes: order.length }, done: total > 0 && covered.length === total };
}

/**
 * What a requirement touches (prototype `reqScope`, changed by slice 4b-1, PRD item 9): linked entities (without their
 * attributes); linked attributes with their entity; linked mappings with their attribute, its entity, every input column
 * and its table; linked tables; linked columns with their table. Its items: linked entities, linked attributes, the
 * attributes of linked mappings. Deleted links and elements are left out.
 */
export const requirementScope = (requirementId: Uuid, links: readonly RequirementLink[], model: ScopeModel, feeds?: AttributeFeeds): RequirementScope =>
  scopeOfLinks(lookupModel(model, feeds), links.filter((k) => k.requirement_id === requirementId));

/**
 * Whether a mapping counts for coverage: approved, and the mapping panel's type check (`checkMappingTypes`) passes on
 * every input; a transformation with a rule handles the conversion (Łukasz, step 1).
 */
export function countsForCoverage(mapping: Mapping, model: ScopeModel): boolean {
  if (mapping.status !== "approved") return false;
  const lookup = lookupModel(model);
  const attribute = lookup.attribute.get(mapping.attribute_id);
  const inputs = lookup.inputsOf.get(mapping.id) ?? [];
  return !!attribute && !inputs.some((c) => c.missing_since !== null) && checkMappingTypes(mapping, attribute, inputs).ok;
}

/** Coverage of one requirement (prototype `reqCoverage`, D-31), computed from the mappings on read. */
export function requirementCoverage(requirementId: Uuid, links: readonly RequirementLink[], model: ScopeModel, feeds?: AttributeFeeds): RequirementCoverage {
  const lookup = lookupModel(model, feeds);
  return coverageOfScope(lookup, scopeOfLinks(lookup, links.filter((k) => k.requirement_id === requirementId)));
}

// ---- requirements of an element (prototype reqsFor, PRD item 8) ----

/** How an indirect requirement reaches an element (D-34; slice 4b-1, PRD item 12). There is no “via entity”. */
export type Via = "via attribute" | "via mapping" | "via column";

export interface ElementRequirements {
  direct: Requirement[];
  /** Each with how it reaches the element; a requirement is listed once, as direct when it is both. */
  indirect: { requirement: Requirement; via: Via }[];
}

// ---- four-eyes author (AD-06, PRD item 13) ----

const CONTENT_COLUMNS = ["kind", "name", "description_html", "expression", "severity"] as const;

/**
 * Who last changed a requirement's content: its kind, name, description, expression or severity (Łukasz, step 0, Q3).
 * Read from the change log, as for mappings (`lastContentEditor`). Status, priority, owner, reference, parent, key and
 * links do not count. Without any such event (seeded data) the creator is the author.
 */
export function lastRequirementEditor(requirement: Requirement, events: readonly ChangeEvent[]): Uuid {
  let last: ChangeEvent | null = null;
  for (const e of events) {
    if (e.object_type !== "requirement" || e.object_id !== requirement.id) continue;
    const content =
      e.operation === "create" ||
      (!!e.before_image && !!e.after_image && CONTENT_COLUMNS.some((c) => (e.before_image![c] ?? null) !== (e.after_image![c] ?? null)));
    if (content && (!last || e.occurred_at >= last.occurred_at)) last = e;
  }
  return last?.user_id ?? requirement.created_by;
}

/** A requirement card's three-part bar (D-41, slice 4b-2 PRD item 2): items covered, mapped but not approved, not mapped. */
export function coverageBar(c: RequirementCoverage): { covered: number; mapped: number; notMapped: number } {
  return {
    covered: c.covered.length,
    mapped: c.notApproved.length + c.entityNotApproved.length,
    notMapped: c.notMapped.length + c.entityGaps.length - c.entityNotApproved.length,
  };
}
