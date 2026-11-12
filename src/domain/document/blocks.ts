// Small pieces of the content tree that more than one section draws (slice 25, step 3): the runs of a name, a type or
// a status, a mapping filter's rule, and an entity's relationships table (the prototype's `relBlock`), which the data
// dictionary and InfoCube's Dimensional model both print. The words come from the section that draws them, in the
// document's language; the rules are the model's.

import type { Uuid } from "../ids";
import { formatAttributeType } from "../model/type-check";
import type { Attribute, CardinalityMax, CardinalityMin, ModuleTable, Relationship } from "../types";
import type { DocNode, DocRun, DocRuns } from "./content";
import type { SectionScope } from "./sections";
import type { DocumentState } from "./state";

export const text = (value: string): DocRun => ({ text: value });
export const mono = (value: string): DocRun => ({ text: value, mono: true });
export const muted = (value: string): DocRun => ({ text: value, muted: true });
export const warn = (value: string): DocRun => ({ text: value, warn: true });
export const strong = (value: string): DocRun => ({ text: value, strong: true });
export const EMPTY: DocRuns = [];

/** An attribute's type as the model writes it (`string(100)`, `decimal(18,2)`). */
export const typeRuns = (a: Attribute): DocRuns => [mono(formatAttributeType(a))];

/** Whether a mapping of this status is shown under the document's mapping filter (the prototype's `mapOk`). */
export function statusShown(filter: SectionScope["mappings"], status: "draft" | "review" | "approved"): boolean {
  if (filter === "all") return true;
  return filter === "approved" ? status === "approved" : status !== "draft";
}

/** Whether a mapping's status is marked beside it: in a document that shows more than approved ones (`markSt`). */
export const marksStatus = (filter: SectionScope["mappings"]): boolean => filter !== "approved";

/** The prototype's `cardTx`: "1", "0..1", "1..*", "0..*". */
export const cardinalityText = (min: CardinalityMin, max: CardinalityMax): string => (max === "n" ? (min ? "1..*" : "0..*") : min ? "1" : "0..1");

/** The words the relationships table needs, in the document's language. */
export interface RelationshipWords {
  readonly heading: string;
  readonly related: string;
  readonly name: string;
  readonly cardinality: string;
  readonly outsideScope: string;
}

/**
 * An entity's live relationships (the prototype's `relBlock`): the related entity (marked when outside the document's
 * scope), the relationship's label and role names, each once, and the cardinality "this : related". Nothing when it
 * has none.
 */
export function relationshipsBlock<T extends ModuleTable>(state: DocumentState<T>, entityId: Uuid, scope: SectionScope, words: RelationshipWords): DocNode[] {
  const rs = state.snapshot.model.relationships.filter((r) => r.from_entity_id === entityId || r.to_entity_id === entityId);
  if (!rs.length) return [];
  const row = (r: Relationship) => {
    const mine = r.from_entity_id === entityId;
    const other = mine ? r.to_entity_id : r.from_entity_id;
    const names = [r.label, r.from_role, r.to_role].map((x) => (x ?? "").trim()).filter((x, i, all) => x && all.indexOf(x) === i);
    const thisEnd = mine ? cardinalityText(r.from_min, r.from_max) : cardinalityText(r.to_min, r.to_max);
    const otherEnd = mine ? cardinalityText(r.to_min, r.to_max) : cardinalityText(r.from_min, r.from_max);
    const related: DocRun[] = [strong(state.entity.get(other)?.name ?? "?")];
    if (!scope.entityIds.has(other)) related.push(muted(` (${words.outsideScope})`));
    return { cells: [related, names.length ? [text(names.join(" · "))] : EMPTY, [mono(`${thisEnd} : ${otherEnd}`)]] };
  };
  return [
    { kind: "heading", level: 4, text: words.heading },
    {
      kind: "table",
      columns: [
        { key: "related", label: words.related },
        { key: "name", label: words.name },
        { key: "cardinality", label: words.cardinality },
      ],
      rows: rs.map(row),
    },
  ];
}
