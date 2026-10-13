// Requirements (D-30, D-31; slice 4a, PRD items 1–8, 13): names shown for kinds, statuses and priorities, the key
// counter, parent cycles, scope and coverage (computed on read, never stored), the direct and indirect requirements of
// an element (prototype `reqsFor`), and who last changed a requirement's content (four-eyes, AD-06).

import type { Uuid } from "../ids";
import type {
  ChangeEvent,
  Mapping,
  Requirement,
  RequirementKind,
  RequirementLink,
  RequirementPriority,
  RequirementStatus,
  WorkspaceModel,
} from "../types";
import { targetOf, type LabelTarget, type LabelTargetKind } from "./labels";
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

type ScopeModel = Pick<WorkspaceModel, "entities" | "attributes" | "mappings" | "mappingInputs" | "sourceTables" | "sourceColumns">;
type CoverageModel = ScopeModel;

export interface RequirementScope {
  entities: Set<Uuid>;
  attributes: Set<Uuid>;
  mappings: Set<Uuid>;
  tables: Set<Uuid>;
  columns: Set<Uuid>;
}

/**
 * What a requirement covers (prototype `reqScope`): linked entities with all their attributes; linked attributes with
 * their entity; linked mappings with their attribute, its entity, every input column and its table; linked tables;
 * linked columns with their table. Deleted links and elements are left out.
 */
export function requirementScope(requirementId: Uuid, links: readonly RequirementLink[], model: ScopeModel): RequirementScope {
  const scope: RequirementScope = { entities: new Set(), attributes: new Set(), mappings: new Set(), tables: new Set(), columns: new Set() };
  const attribute = new Map(live(model.attributes).map((a) => [a.id, a]));
  const column = new Map(live(model.sourceColumns).map((c) => [c.id, c]));
  const mapping = new Map(live(model.mappings).map((m) => [m.id, m]));
  const entities = new Set(live(model.entities).map((e) => e.id));
  const tables = new Set(live(model.sourceTables).map((t) => t.id));
  const addColumn = (id: Uuid) => {
    const c = column.get(id);
    if (!c) return;
    scope.columns.add(c.id);
    scope.tables.add(c.source_table_id);
  };
  for (const link of live(links)) {
    if (link.requirement_id !== requirementId) continue;
    const t = targetOf(link);
    if (!t) continue;
    if (t.kind === "entity" && entities.has(t.id)) {
      scope.entities.add(t.id);
      for (const a of attribute.values()) if (a.entity_id === t.id) scope.attributes.add(a.id);
    } else if (t.kind === "attribute" && attribute.has(t.id)) {
      scope.attributes.add(t.id);
      scope.entities.add(attribute.get(t.id)!.entity_id);
    } else if (t.kind === "mapping" && mapping.has(t.id)) {
      const m = mapping.get(t.id)!;
      scope.mappings.add(m.id);
      const a = attribute.get(m.attribute_id);
      if (a) {
        scope.attributes.add(a.id);
        scope.entities.add(a.entity_id);
      }
      for (const i of live(model.mappingInputs)) if (i.mapping_id === m.id) addColumn(i.source_column_id);
    } else if (t.kind === "source_table" && tables.has(t.id)) {
      scope.tables.add(t.id);
    } else if (t.kind === "source_column") addColumn(t.id);
  }
  return scope;
}

export interface RequirementCoverage {
  /** Attributes in scope. */
  total: number;
  /** Attributes with at least one approved mapping that fits on every input. */
  covered: Uuid[];
  /** Attributes with mappings, none of which counts as covered. */
  notApproved: Uuid[];
  /** Attributes without any mapping. */
  notMapped: Uuid[];
  /** At least one attribute in scope, and all of them covered. */
  done: boolean;
}

/**
 * Whether a mapping counts for coverage: approved, and no type conflict on any of its inputs (AD-26). The type check is
 * the mapping panel's (`checkMappingTypes`): a transformation with a rule handles the conversion.
 */
export function countsForCoverage(mapping: Mapping, model: CoverageModel): boolean {
  if (mapping.status !== "approved") return false;
  const attribute = model.attributes.find((a) => a.id === mapping.attribute_id && a.deleted_at === null);
  if (!attribute) return false;
  const columns = new Map(live(model.sourceColumns).map((c) => [c.id, c]));
  const inputs = live(model.mappingInputs)
    .filter((i) => i.mapping_id === mapping.id)
    .map((i) => columns.get(i.source_column_id))
    .filter((c) => !!c);
  return checkMappingTypes(mapping, attribute, inputs).ok;
}

/** Coverage of a requirement (prototype `reqCoverage`, D-31), computed from the mappings on every read. */
export function requirementCoverage(requirementId: Uuid, links: readonly RequirementLink[], model: CoverageModel): RequirementCoverage {
  const scope = requirementScope(requirementId, links, model);
  const mappingsOf = new Map<Uuid, Mapping[]>();
  for (const m of live(model.mappings)) mappingsOf.set(m.attribute_id, [...(mappingsOf.get(m.attribute_id) ?? []), m]);
  const order = live(model.attributes).filter((a) => scope.attributes.has(a.id));
  const covered: Uuid[] = [], notApproved: Uuid[] = [], notMapped: Uuid[] = [];
  for (const a of order) {
    const ms = mappingsOf.get(a.id) ?? [];
    if (!ms.length) notMapped.push(a.id);
    else if (ms.some((m) => countsForCoverage(m, model))) covered.push(a.id);
    else notApproved.push(a.id);
  }
  return { total: order.length, covered, notApproved, notMapped, done: order.length > 0 && covered.length === order.length };
}

// ---- requirements of an element (prototype reqsFor, PRD item 8) ----

export interface ElementRequirements {
  direct: Requirement[];
  indirect: Requirement[];
  /** “via entity”, “via attribute” or “via column”; null when the element has no indirect requirements by kind. */
  via: "via entity" | "via attribute" | "via column" | null;
}

/**
 * An attribute's own requirements plus its entity's (“via entity”); an entity's own plus every requirement whose scope
 * contains it (“via attribute”); a table's own plus every requirement whose scope contains it (“via column”); a
 * column's and a mapping's own only. A requirement is listed once, as direct when it is both.
 */
export function requirementsOf(
  target: TraceTarget,
  requirements: readonly Requirement[],
  links: readonly RequirementLink[],
  model: ScopeModel,
): ElementRequirements {
  const reqs = live(requirements);
  const liveLinks = live(links);
  const linkedTo = (t: TraceTarget) => {
    const ids = new Set(liveLinks.filter((k) => { const o = targetOf(k); return o?.kind === t.kind && o.id === t.id; }).map((k) => k.requirement_id));
    return reqs.filter((r) => ids.has(r.id));
  };
  const direct = linkedTo(target);
  let indirect: Requirement[] = [];
  let via: ElementRequirements["via"] = null;
  if (target.kind === "attribute") {
    const entityId = model.attributes.find((a) => a.id === target.id)?.entity_id;
    indirect = entityId ? linkedTo({ kind: "entity", id: entityId }) : [];
    via = "via entity";
  } else if (target.kind === "entity" || target.kind === "source_table") {
    indirect = reqs.filter((r) => {
      const s = requirementScope(r.id, liveLinks, model);
      return target.kind === "entity" ? s.entities.has(target.id) : s.tables.has(target.id);
    });
    via = target.kind === "entity" ? "via attribute" : "via column";
  }
  const directIds = new Set(direct.map((r) => r.id));
  return { direct, indirect: indirect.filter((r) => !directIds.has(r.id)), via };
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
