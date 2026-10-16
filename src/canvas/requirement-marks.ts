// Requirement markers on cards (slice 4b-1, PRD item 14; prototype reqMark, CSS .rmark): an entity or table card shows a
// violet dot and the number of requirements its panel lists (direct and indirect, D-34), with the tooltip “Requirements:”
// and one line per requirement. Worked out from the canvas's requirement index once per data version; a card gets its
// marker in its node data only when it changes (as the pinned notes' number), so no other card draws again.

import type { RequirementIndex } from "@/domain/model/requirement-index";

/** A card's marker: the number of requirements and the tooltip. */
export interface RequirementMark {
  n: number;
  title: string;
}

/** The markers of the given cards (entity and table cards by their model id); cards without requirements get none. */
export function requirementMarks(index: RequirementIndex | null, cards: readonly { id: string; kind: "ent" | "src"; targetId: string }[]): Map<string, RequirementMark> {
  const out = new Map<string, RequirementMark>();
  if (!index) return out;
  for (const c of cards) {
    const { direct, indirect } = index.of({ kind: c.kind === "ent" ? "entity" : "source_table", id: c.targetId });
    const all = [...direct, ...indirect.map((x) => x.requirement)];
    if (!all.length) continue;
    // the prototype's tooltip: “Requirements: REQ-101 Single view of the customer” and a line per further requirement
    out.set(c.id, { n: all.length, title: `Requirements: ${all.map((r) => `${r.key} ${r.name}`).join("\n")}` });
  }
  return out;
}

/** Whether two markers draw the same. */
export const sameMark = (a: RequirementMark | undefined, b: RequirementMark | undefined) => a?.n === b?.n && a?.title === b?.title;
