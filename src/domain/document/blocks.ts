// Small pieces of the content tree that more than one section draws (slice 25, step 3): the runs of a name, a type or
// a status, a mapping filter's rule, and an entity's relationships table (the prototype's `relBlock`), which the data
// dictionary and InfoCube's Dimensional model both print. The words come from the section that draws them, in the
// document's language; the rules are the model's.

import type { Uuid } from "../ids";
import { formatAttributeType } from "../model/type-check";
import type { Attribute, CardinalityMax, CardinalityMin, ModuleTable, Relationship } from "../types";
import type { DocColumn, DocNode, DocRow, DocRun, DocRuns } from "./content";
import type { SectionScope } from "./sections";
import type { DocumentState } from "./state";

export const text = (value: string): DocRun => ({ text: value });
export const mono = (value: string): DocRun => ({ text: value, mono: true });
export const muted = (value: string): DocRun => ({ text: value, muted: true });
export const warn = (value: string): DocRun => ({ text: value, warn: true });
export const strong = (value: string): DocRun => ({ text: value, strong: true });
export const EMPTY: DocRuns = [];
/** Slice 26: a small tag ("PII", a code, a requirement's key). */
export const chip = (value: string, tone: NonNullable<DocRun["chip"]> = "plain"): DocRun => ({ text: value, chip: tone });

/** Runs on separate lines: the first as it is, every later one starting a new line. */
export const lines = (parts: readonly DocRuns[]): DocRuns => parts.flatMap((runs, i) => (i && runs.length ? [{ ...runs[0]!, lineBreak: true }, ...runs.slice(1)] : runs));

/** Runs joined by a separator ("a, b"). */
export const joined = (parts: readonly DocRuns[], separator = ", "): DocRuns => parts.flatMap((runs, i) => (i ? [text(separator), ...runs] : [...runs]));

/** Whether runs say anything. */
export const hasText = (runs: DocRuns | undefined): boolean => !!runs?.some((r) => r.text.trim() || r.bar || r.end || r.line || r.dots || r.swatch);

/**
 * Where a table's long texts go (slice 26, D1, the prototype's `ltable`): under each row (the full width under it),
 * after the table as numbered notes (the row carries their numbers), or in their own column.
 */
export const LONG_TEXTS = ["row", "after", "column"] as const;
export type LongTexts = (typeof LONG_TEXTS)[number];

/** A column of a table with long texts: its label, and whether it is a long text. */
export interface LongColumn {
  readonly key: string;
  readonly label: string;
  readonly long?: boolean;
}

/**
 * A table whose long columns go where `mode` says (the prototype's `ltable`). Under each row: the row keeps the short
 * columns and each long text gets a line under it, labelled when there are several long columns; after the table: the
 * row's last short cell carries "→ 1, 2" and the texts follow as a numbered list, each with its column's label; as a
 * column: one plain table. An empty long text is left out. No rows: `none`.
 */
export function longTextTable(columns: readonly LongColumn[], rows: readonly (readonly DocRuns[])[], mode: LongTexts, none: string, style?: "narrow" | "fixed"): DocNode[] {
  if (!rows.length) return [{ kind: "paragraph", runs: [muted(none)] }];
  const long = columns.map((c, i) => (c.long ? i : -1)).filter((i) => i >= 0);
  const head = (idx: readonly number[]): DocColumn[] => idx.map((i) => ({ key: columns[i]!.key, label: columns[i]!.label }));
  if (mode === "column" || !long.length) return [{ kind: "table", columns: head(columns.map((_, i) => i)), rows: rows.map((cells) => ({ cells })), ...(style ? { style } : {}) }];
  const short = columns.map((_, i) => i).filter((i) => !long.includes(i));
  const labelled = long.length > 1;
  const notes: { label: DocRuns; runs: DocRuns }[] = [];
  const body = rows.map((cells): DocRow => {
    const texts = long.map((i) => ({ label: columns[i]!.label, runs: cells[i] ?? EMPTY })).filter((x) => hasText(x.runs));
    if (mode === "after") {
      const refs = texts.map((x) => notes.push({ label: [strong(`${x.label}:`)], runs: x.runs }));
      const out = short.map((i) => cells[i] ?? EMPTY);
      if (refs.length && out.length) out[out.length - 1] = [...out[out.length - 1]!, text(" "), { text: `→ ${refs.join(", ")}`, ref: true }];
      return { cells: out };
    }
    const below = texts.map((x) => (labelled ? [strong(`${x.label}: `), ...x.runs] : x.runs));
    return { cells: short.map((i) => cells[i] ?? EMPTY), ...(below.length ? { below } : {}) };
  });
  const out: DocNode[] = [{ kind: "table", columns: head(short), rows: body, ...(style ? { style } : {}) }];
  if (notes.length) out.push({ kind: "list", ordered: true, items: notes });
  return out;
}

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
