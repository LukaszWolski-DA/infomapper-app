// Hints for options that show nothing (slice 28, item 2, Q5, Q-B): an option is ticked and nothing in the document uses
// it, so a short line under it says why. Pure: the editor reads them from the document state it already has, with the
// section's scope as the builders read it (`sectionScopeOf`), never a count of its own.
//
// - Source-to-target's Note column: no mapping in the document has a note, or the notes are on mappings the document's
//   mapping filter leaves out (F3's words: draft and in-review mappings alike under "Approved only").
// - Source tables' table note and table classifications: no table in scope has one.
// - The dictionary's figure of a concept's frame: no canvas in scope has a frame for a concept the dictionary shows.
// - The style's List of figures: the document has no figure.
//
// Source-to-target's Rule column has no hint: every shown mapping prints its rule or "Direct" (`s2tCell`), so the
// column is never empty while a mapping is shown, and with none shown the section says so itself.

import { statusShown } from "@/domain/document/blocks";
import type { SectionScope } from "@/domain/document/sections";
import type { DocumentState } from "@/domain/document/state";
import { attributesOf, byConcept, logicalEntities, scopeEntities } from "./parts";

export const HINT_TEXTS = {
  noNote: "No mapping in this document has a note.",
  hiddenNotes: (n: number) => (n === 1 ? "1 note is on a mapping that Mappings included leaves out." : `${n} notes are on mappings that Mappings included leaves out.`),
  noTableNote: "No table in this document has a note.",
  noTableClassification: "No table in this document has a classification.",
  noConceptFrame: "No canvas in this document's scope has a concept's frame.",
  noFigures: "This document has no figures yet.",
} as const;

/** A section's hints by option key (`columns` for a column of its list), only for the options that are on. */
export function sectionHints(state: DocumentState, scope: SectionScope, type: string, options: Readonly<Record<string, unknown>>): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  const columns = Array.isArray(options.columns) ? (options.columns as readonly string[]) : [];
  if (type === "s2t" && columns.includes("note")) {
    let shown = 0, hidden = 0;
    for (const e of [...logicalEntities(state, scope).values()].flat())
      for (const a of attributesOf(state, e.id))
        for (const m of state.lookup.mappingsOfAttribute.get(a.id) ?? []) {
          if (!m.note_text?.trim()) continue;
          if (statusShown(scope.mappings, m.status)) shown++;
          else hidden++;
        }
    if (!shown) out.columns = hidden ? HINT_TEXTS.hiddenNotes(hidden) : HINT_TEXTS.noNote;
  }
  if (type === "sources") {
    const tables = state.snapshot.model.sourceTables.filter((x) => scope.tableIds.has(x.id));
    if (options.tableNote === true && !tables.some((x) => x.note_text?.trim())) out.tableNote = HINT_TEXTS.noTableNote;
    if (options.tableClassifications === true && !tables.some((x) => state.classifications.of(x.id).length > 0)) out.tableClassifications = HINT_TEXTS.noTableClassification;
  }
  if (type === "dict" && options.byConcept !== false && options.conceptFigures === true) {
    const concepts = new Set(byConcept(state, scopeEntities(state, scope)).keys());
    const framed = state.snapshot.frames.some((f) => f.kind === "concept" && f.concept_id !== null && concepts.has(f.concept_id) && scope.canvasIds.has(f.canvas_id));
    if (!framed) out.conceptFigures = HINT_TEXTS.noConceptFrame;
  }
  return out;
}

/** The style's hints: the List of figures while it is on and the document draws no figure. */
export function styleHints(listOfFigures: boolean, figures: number): Readonly<Record<string, string>> {
  return listOfFigures && figures === 0 ? { listOfFigures: HINT_TEXTS.noFigures } : {};
}
