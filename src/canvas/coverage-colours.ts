// Coverage colours (slice 4b-1, PRD items 16–19; prototype applyHighlight, .row.rq, .row.gap): what a selected
// requirement colours on the canvas, with no fading. Worked out from the requirement index:
//   - attribute items: their rows blue (covered) or orange (gap);
//   - entity items: their cards' headers blue or orange (covered when any of the entity's attributes is, D-31);
//   - linked columns: their rows blue; linked tables: their headers blue;
//   - linked mappings: their lines lit, as the hover highlight draws them.
// Below 40 % rows are not drawn (AD-24 rule 1), so a card's summary stands for them (item 19; Łukasz chose a dot at the
// header's right end): orange when any of the card's items in scope is a gap, else blue. A collapsed frame's block
// carries the same dot on each member's row.

import type { Uuid } from "@/domain/ids";
import { targetOf } from "@/domain/model/labels";
import type { RequirementIndex } from "@/domain/model/requirement-index";

export type CoverageColour = "covered" | "gap";

export interface CoverageColours {
  /** Attribute and column rows (by row id, the model's id). */
  rows: Map<Uuid, CoverageColour>;
  /** Card headers by the entity's or table's id: entity items and linked tables. */
  headers: Map<Uuid, CoverageColour>;
  /** Linked mappings: their lines lit. */
  mappings: Set<Uuid>;
  /** Per entity or table with anything in scope: orange when any of its items is a gap (below 40 %). */
  summary: Map<Uuid, CoverageColour>;
}

export const NO_COLOURS: CoverageColours = { rows: new Map(), headers: new Map(), mappings: new Set(), summary: new Map() };

/**
 * What the requirement colours. `entityOf` and `tableOf` give an attribute's entity and a column's table (the canvas
 * knows them from its cards).
 */
export function coverageColours(index: RequirementIndex | null, requirementId: Uuid | null, entityOf: (attributeId: Uuid) => Uuid | undefined, tableOf: (columnId: Uuid) => Uuid | undefined): CoverageColours {
  if (!index || !requirementId || !index.byId.has(requirementId)) return NO_COLOURS;
  const scope = index.scope(requirementId);
  const coverage = index.coverage(requirementId);
  const covered = new Set(coverage.covered);
  const out: CoverageColours = { rows: new Map(), headers: new Map(), mappings: new Set(), summary: new Map() };
  const sum = (id: Uuid | undefined, c: CoverageColour) => {
    if (!id) return;
    if (out.summary.get(id) !== "gap") out.summary.set(id, c);
  };
  for (const a of scope.attributeItems) {
    const c: CoverageColour = covered.has(a) ? "covered" : "gap";
    out.rows.set(a, c);
    sum(entityOf(a), c);
  }
  for (const e of scope.entityItems) {
    const c: CoverageColour = covered.has(e) ? "covered" : "gap";
    out.headers.set(e, c);
    sum(e, c);
  }
  for (const link of index.linksOf(requirementId)) {
    const t = targetOf(link);
    if (!t) continue;
    if (t.kind === "source_column") {
      out.rows.set(t.id, "covered");
      sum(tableOf(t.id), "covered");
    } else if (t.kind === "source_table") {
      out.headers.set(t.id, "covered");
      sum(t.id, "covered");
    } else if (t.kind === "mapping") out.mappings.add(t.id);
  }
  return out;
}

