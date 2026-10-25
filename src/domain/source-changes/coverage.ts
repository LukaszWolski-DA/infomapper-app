// Requirements whose coverage changes (slice 7b, items 9 and 13, Q3; prototype `reqBox`, `covOfS`, `reasons`): the
// requirement index built on the model before and on the model after (an import's `materialize`, a delete's cascade
// applied in memory), compared requirement by requirement. Over the whole model, so the review's callout counts the
// whole plan (slice 7a, step 5's condition). The reasons name what stopped an item counting: a column that left the
// source, a mapping sent back to review, a mapping deleted, a new type conflict.

import type { Uuid } from "../ids";
import type { ImportModel } from "../import/model";
import { buildRequirementIndex } from "../model/requirement-index";
import type { ScopeModel } from "../model/requirements";
import { checkMappingTypes } from "../model/type-check";
import type { Mapping, Requirement, RequirementLink, SourceColumn } from "../types";

export interface CoverageDelta {
  requirement: Pick<Requirement, "id" | "key" | "name">;
  before: { covered: number; total: number };
  after: { covered: number; total: number };
  /** Why it changes, one line per reason (“email_addr missing from source”; “email: mapping back to review, …”). */
  why: string[];
}

/** The import engine's model as the requirement index reads it. */
export const scopeModelOf = (m: ImportModel): ScopeModel => ({
  entities: [...m.entities],
  attributes: [...m.attributes],
  mappings: [...m.mappings],
  mappingInputs: [...m.mappingInputs],
  sourceTables: [...m.tables],
  sourceColumns: [...m.columns],
});

const live = <R extends { deleted_at: string | null }>(rows: readonly R[]) => rows.filter((r) => r.deleted_at === null);

/** “4 of 6 → 3 of 6”. */
export const coverageChangeText = (d: CoverageDelta): string => `${d.before.covered} of ${d.before.total} → ${d.after.covered} of ${d.after.total}`;

export function coverageDelta(requirements: readonly Requirement[], links: readonly RequirementLink[], before: ScopeModel, after: ScopeModel): CoverageDelta[] {
  const ixBefore = buildRequirementIndex(requirements, links, before);
  const ixAfter = buildRequirementIndex(requirements, links, after);
  const attributes = new Map(live(before.attributes).map((a) => [a.id, a]));
  const entities = new Map(live(before.entities).map((e) => [e.id, e]));
  const columnsBefore = new Map(live(before.sourceColumns).map((c) => [c.id, c]));
  const columnsAfter = new Map(live(after.sourceColumns).map((c) => [c.id, c]));
  const mappingsAfter = new Map(live(after.mappings).map((m) => [m.id, m]));
  const inputsOf = (model: ScopeModel, columns: ReadonlyMap<Uuid, SourceColumn>) => {
    const out = new Map<Uuid, SourceColumn[]>();
    for (const i of live(model.mappingInputs)) {
      const c = columns.get(i.source_column_id);
      if (c) (out.get(i.mapping_id) ?? out.set(i.mapping_id, []).get(i.mapping_id)!).push(c);
    }
    return out;
  };
  const inBefore = inputsOf(before, columnsBefore);
  const inAfter = inputsOf(after, columnsAfter);

  /** Why an approved mapping that counted before no longer does. */
  const whyMapping = (m: Mapping): string | null => {
    const a = attributes.get(m.attribute_id);
    if (!a) return null;
    const name = a.name;
    const later = mappingsAfter.get(m.id);
    if (!later) return `${name}: mapping deleted`;
    const gone = (inAfter.get(m.id) ?? []).find((c) => c.missing_since && !(inBefore.get(m.id) ?? []).some((b) => b.id === c.id && b.missing_since));
    if (gone) return `${gone.name} missing from source`;
    if (later.status !== "approved") return `${name}: mapping back to review${later.review_reason ? `, ${later.review_reason}` : ""}`;
    if (!checkMappingTypes(later, a, inAfter.get(m.id) ?? []).ok) return `${name}: type conflict`;
    return null;
  };

  const out: CoverageDelta[] = [];
  for (const r of ixBefore.requirements) {
    const b = ixBefore.coverage(r.id);
    const a = ixAfter.coverage(r.id);
    if (b.covered.length === a.covered.length && b.total === a.total) continue;
    const lost = new Set(b.covered.filter((id) => !a.covered.includes(id)));
    const why = new Set<string>();
    for (const id of lost) {
      const attributeIds = attributes.has(id) ? [id] : live(before.attributes).filter((x) => x.entity_id === id).map((x) => x.id);
      for (const m of live(before.mappings)) {
        if (!attributeIds.includes(m.attribute_id) || m.status !== "approved") continue;
        const reason = whyMapping(m);
        if (reason) why.add(reason);
      }
      if (!attributes.has(id) && entities.has(id) && !why.size) why.add(`${entities.get(id)!.name}: no approved mapping on any attribute`);
    }
    out.push({ requirement: { id: r.id, key: r.key, name: r.name }, before: { covered: b.covered.length, total: b.total }, after: { covered: a.covered.length, total: a.total }, why: [...why] });
  }
  return out;
}
