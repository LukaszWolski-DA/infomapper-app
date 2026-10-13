// The requirement index (slice 4a, step 3): built once per data version, then read by the panels, the left panel's
// Requirements tab, and later the project home and the status bar, so nothing works out a scope while rendering. For
// every live requirement: its live links, scope (D-31), coverage and children; for every element: the requirements
// linked to it directly and those that reach it indirectly (prototype `reqsFor`).

import type { Uuid } from "../ids";
import { REQUIREMENT_KINDS, type Requirement, type RequirementLink } from "../types";
import { itemKey, targetOf } from "./labels";
import {
  coverageOfScope,
  lookupModel,
  scopeOfLinks,
  type ElementRequirements,
  type RequirementCoverage,
  type RequirementScope,
  type ScopeModel,
  type TraceTarget,
} from "./requirements";

export interface RequirementIndex {
  /** Live requirements in the left panel's order: by kind (as REQUIREMENT_KINDS), then by key. */
  requirements: Requirement[];
  byId: ReadonlyMap<Uuid, Requirement>;
  /** Live links whose requirement is live (an element may have been deleted meanwhile; its link counts for nothing). */
  linksOf: (requirementId: Uuid) => RequirementLink[];
  scope: (requirementId: Uuid) => RequirementScope;
  coverage: (requirementId: Uuid) => RequirementCoverage;
  /** Requirements whose parent it is, by key. */
  children: (requirementId: Uuid) => Requirement[];
  /** The direct and indirect requirements of an element. */
  of: (target: TraceTarget) => ElementRequirements;
  /** How many requirements are covered (the status bar, the project home). */
  coveredCount: number;
}

const EMPTY_SCOPE: RequirementScope = { entities: new Set(), attributes: new Set(), mappings: new Set(), tables: new Set(), columns: new Set() };
const EMPTY_COVERAGE: RequirementCoverage = { total: 0, covered: [], notApproved: [], notMapped: [], done: false };
const byKey = (a: Requirement, b: Requirement) => a.key.localeCompare(b.key, "en", { numeric: true, sensitivity: "base" });
const KIND_ORDER = new Map(REQUIREMENT_KINDS.map((k, i) => [k, i]));

export function buildRequirementIndex(requirements: readonly Requirement[], links: readonly RequirementLink[], model: ScopeModel): RequirementIndex {
  const lookup = lookupModel(model);
  const reqs = requirements.filter((r) => r.deleted_at === null).sort((a, b) => KIND_ORDER.get(a.kind)! - KIND_ORDER.get(b.kind)! || byKey(a, b));
  const byId = new Map(reqs.map((r) => [r.id, r]));

  const linksOf = new Map<Uuid, RequirementLink[]>();
  const directOf = new Map<string, Requirement[]>();
  for (const k of links) {
    const r = k.deleted_at === null ? byId.get(k.requirement_id) : undefined;
    if (!r) continue;
    const own = linksOf.get(r.id);
    if (own) own.push(k);
    else linksOf.set(r.id, [k]);
    const t = targetOf(k);
    if (!t) continue;
    const key = itemKey(t);
    const list = directOf.get(key);
    if (!list) directOf.set(key, [r]);
    else if (!list.includes(r)) list.push(r);
  }

  const scopes = new Map<Uuid, RequirementScope>();
  const coverages = new Map<Uuid, RequirementCoverage>();
  const reachEntity = new Map<Uuid, Requirement[]>();
  const reachTable = new Map<Uuid, Requirement[]>();
  const children = new Map<Uuid, Requirement[]>();
  let coveredCount = 0;
  for (const r of reqs) {
    const scope = scopeOfLinks(lookup, linksOf.get(r.id) ?? []);
    const coverage = coverageOfScope(lookup, scope);
    scopes.set(r.id, scope);
    coverages.set(r.id, coverage);
    if (coverage.done) coveredCount++;
    for (const e of scope.entities) (reachEntity.get(e) ?? reachEntity.set(e, []).get(e)!).push(r);
    for (const t of scope.tables) (reachTable.get(t) ?? reachTable.set(t, []).get(t)!).push(r);
    if (r.parent_id && byId.has(r.parent_id)) (children.get(r.parent_id) ?? children.set(r.parent_id, []).get(r.parent_id)!).push(r);
  }
  for (const list of children.values()) list.sort(byKey);
  const ordered = (list: readonly Requirement[]) => [...list].sort((a, b) => reqs.indexOf(a) - reqs.indexOf(b));

  const of = (target: TraceTarget): ElementRequirements => {
    const direct = ordered(directOf.get(itemKey(target)) ?? []);
    const directIds = new Set(direct.map((r) => r.id));
    let indirect: Requirement[] = [];
    let via: ElementRequirements["via"] = null;
    if (target.kind === "attribute") {
      const entityId = lookup.attribute.get(target.id)?.entity_id;
      indirect = entityId ? (directOf.get(itemKey({ kind: "entity", id: entityId })) ?? []) : [];
      via = "via entity";
    } else if (target.kind === "entity") {
      indirect = reachEntity.get(target.id) ?? [];
      via = "via attribute";
    } else if (target.kind === "source_table") {
      indirect = reachTable.get(target.id) ?? [];
      via = "via column";
    }
    return { direct, indirect: ordered(indirect.filter((r) => !directIds.has(r.id))), via };
  };

  return {
    requirements: reqs,
    byId,
    linksOf: (id) => linksOf.get(id) ?? [],
    scope: (id) => scopes.get(id) ?? EMPTY_SCOPE,
    coverage: (id) => coverages.get(id) ?? EMPTY_COVERAGE,
    children: (id) => children.get(id) ?? [],
    of,
    coveredCount,
  };
}

/**
 * The direct and indirect requirements of one element (prototype `reqsFor`, PRD item 8): an attribute's own plus its
 * entity's (“via entity”); an entity's own plus every requirement whose scope contains it (“via attribute”); a table's
 * own plus every requirement whose scope contains it (“via column”); a column's and a mapping's own only. A
 * requirement is listed once, as direct when it is both. For many elements, build the index once instead.
 */
export const requirementsOf = (target: TraceTarget, requirements: readonly Requirement[], links: readonly RequirementLink[], model: ScopeModel): ElementRequirements =>
  buildRequirementIndex(requirements, links, model).of(target);
