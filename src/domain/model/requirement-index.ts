// The requirement index (slice 4a, step 3): built once per data version, then read by the panels, the left panel's
// Requirements tab, the project home, the status bar and the canvas, so nothing works out a scope while rendering. For
// every live requirement: its live links, scope and items (D-31), coverage and children; for every element: the
// requirements linked to it directly and those that reach it indirectly, each with how (D-34; slice 4b-1, PRD item 12).

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
  type Via,
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

const EMPTY_SCOPE: RequirementScope = { entities: new Set(), attributes: new Set(), mappings: new Set(), tables: new Set(), columns: new Set(), entityItems: new Set(), attributeItems: new Set() };
const EMPTY_COVERAGE: RequirementCoverage = { total: 0, covered: [], notApproved: [], notMapped: [], entityGaps: [], entityNotApproved: [], parts: { entities: 0, attributes: 0 }, done: false };
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
  const children = new Map<Uuid, Requirement[]>();
  let coveredCount = 0;
  for (const r of reqs) {
    const scope = scopeOfLinks(lookup, linksOf.get(r.id) ?? []);
    const coverage = coverageOfScope(lookup, scope);
    scopes.set(r.id, scope);
    coverages.set(r.id, coverage);
    if (coverage.done) coveredCount++;
    if (r.parent_id && byId.has(r.parent_id)) (children.get(r.parent_id) ?? children.set(r.parent_id, []).get(r.parent_id)!).push(r);
  }
  for (const list of children.values()) list.sort(byKey);
  const ordered = (list: readonly Requirement[]) => [...list].sort((a, b) => reqs.indexOf(a) - reqs.indexOf(b));

  /** The requirements linked directly to these elements, each with how it reaches the element asked about. */
  const linkedTo = (kind: TraceTarget["kind"], ids: Iterable<Uuid>, via: Via) => {
    const out: { requirement: Requirement; via: Via }[] = [];
    for (const id of ids) for (const r of directOf.get(itemKey({ kind, id } as TraceTarget)) ?? []) out.push({ requirement: r, via });
    return out;
  };
  const of = (target: TraceTarget): ElementRequirements => {
    const direct = ordered(directOf.get(itemKey(target)) ?? []);
    let found: { requirement: Requirement; via: Via }[] = [];
    if (target.kind === "entity") {
      // its attributes' requirements, then those of the mappings onto its attributes
      const attributes = (lookup.attributesOf.get(target.id) ?? []).map((a) => a.id);
      found = [
        ...linkedTo("attribute", attributes, "via attribute"),
        ...linkedTo("mapping", attributes.flatMap((a) => (lookup.mappingsOfAttribute.get(a) ?? []).map((m) => m.id)), "via mapping"),
      ];
    } else if (target.kind === "attribute") {
      found = linkedTo("mapping", (lookup.mappingsOfAttribute.get(target.id) ?? []).map((m) => m.id), "via mapping");
    } else if (target.kind === "source_table") {
      // its columns' requirements, then those of the mappings reading its columns
      const columns = (lookup.columnsOf.get(target.id) ?? []).map((c) => c.id);
      found = [
        ...linkedTo("source_column", columns, "via column"),
        ...linkedTo("mapping", [...new Set(columns.flatMap((c) => (lookup.mappingsOfColumn.get(c) ?? []).map((m) => m.id)))], "via mapping"),
      ];
    }
    // once each, direct first; an indirect one keeps the first way it was found; in the requirements' order
    const seen = new Set(direct.map((r) => r.id));
    const indirect: { requirement: Requirement; via: Via }[] = [];
    for (const f of found) {
      if (seen.has(f.requirement.id)) continue;
      seen.add(f.requirement.id);
      indirect.push(f);
    }
    indirect.sort((a, b) => reqs.indexOf(a.requirement) - reqs.indexOf(b.requirement));
    return { direct, indirect };
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
 * The direct and indirect requirements of one element (prototype `reqsFor`; slice 4b-1, PRD item 12): an entity's own,
 * then those linked to its attributes (“via attribute”) or to mappings onto them (“via mapping”); an attribute's own,
 * then those linked to mappings onto it (“via mapping”); a table's own, then those linked to its columns (“via column”)
 * or to mappings reading them (“via mapping”); a mapping's and a column's own only. No “via entity”. A requirement is
 * listed once, as direct when it is both. For many elements, build the index once instead.
 */
export const requirementsOf = (target: TraceTarget, requirements: readonly Requirement[], links: readonly RequirementLink[], model: ScopeModel): ElementRequirements =>
  buildRequirementIndex(requirements, links, model).of(target);
