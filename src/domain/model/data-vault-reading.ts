// The Data Vault reading of a source table (slice 7c, P10, item 21, AD-08; prototype `dvReading`): hints only, from the
// table's classifications and the source's keys; nothing is created. Shown in the table panel in Data Vault 2.0 mode.
//   It reads codes (answer F1), so a renamed classification keeps working and a removed one is simply absent.
//   Columns missing from the source, retired or marked not needed are left out, and so are relationships missing from
//   the source; a relationship none of whose columns is left is left out too.
//   As in the prototype, a satellite's descriptive columns are those that are neither keys of the source (primary,
//   foreign) nor classified as a key or technical column (Business key, Link key, Dependent child key, Driving key,
//   Multi-active key, Technical / audit, Load date, Record source).

import type { Uuid } from "../ids";
import type { SourceColumn, SourceRelationship, SourceRelationshipColumn, SourceTable } from "../types";
import type { ClassificationCode, ClassificationIndex } from "./classifications";

export type ReadingLine =
  | { kind: "hub"; columns: string[] }
  | { kind: "hub_candidate" }
  | { kind: "link"; to: string; columns: string[]; markedLinkKey: boolean }
  | { kind: "link_key_without_relationship"; columns: string[] }
  | { kind: "dependent_child_key"; columns: string[] }
  | { kind: "driving_key"; columns: string[] }
  | { kind: "multi_active"; columns: string[] }
  | { kind: "effective_dated"; columns: string[] }
  | { kind: "satellite"; descriptive: number; personalData: string[] };

export interface ReadingInput {
  table: SourceTable;
  /** The table's columns (deleted ones are skipped). */
  columns: readonly SourceColumn[];
  /** Relationships from the table, with their column pairs (others are skipped). */
  relationships: readonly SourceRelationship[];
  relationshipColumns: readonly SourceRelationshipColumn[];
  /** A table's name by id (the link's target). */
  tableName: (id: Uuid) => string;
}

const KEYISH: readonly ClassificationCode[] = ["BK", "LK", "DCK", "DK", "MAK", "TECH", "LDTS", "RSRC"];

export function dataVaultReading(input: ReadingInput, cls: Pick<ClassificationIndex, "has">): ReadingLine[] {
  const cols = input.columns
    .filter((c) => c.deleted_at === null && c.source_table_id === input.table.id && !c.missing_since && !c.retired_since && !c.not_needed)
    .sort((a, b) => a.ordinal - b.ordinal);
  const by = (code: ClassificationCode) => cols.filter((c) => cls.has(c.id, code));
  const names = (list: readonly SourceColumn[]) => list.map((c) => c.name);
  const out: ReadingLine[] = [];

  const bk = by("BK");
  if (bk.length) out.push({ kind: "hub", columns: names(bk) });
  else if (cls.has(input.table.id, "T_HUB")) out.push({ kind: "hub_candidate" });

  const byId = new Map(cols.map((c) => [c.id, c]));
  const rels = input.relationships.filter((r) => r.deleted_at === null && r.source_table_id === input.table.id && !r.missing_since).sort((a, b) => a.name.localeCompare(b.name));
  const inLinks = new Set<Uuid>();
  for (const r of rels) {
    const from = input.relationshipColumns
      .filter((p) => p.deleted_at === null && p.source_relationship_id === r.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((p) => byId.get(p.from_column_id) ?? []);
    if (!from.length) continue;
    from.forEach((c) => inLinks.add(c.id));
    out.push({ kind: "link", to: input.tableName(r.to_source_table_id), columns: names(from), markedLinkKey: from.some((c) => cls.has(c.id, "LK")) });
  }
  const lonely = by("LK").filter((c) => !inLinks.has(c.id));
  if (lonely.length) out.push({ kind: "link_key_without_relationship", columns: names(lonely) });
  const dck = by("DCK"), dk = by("DK"), mak = by("MAK"), eff = by("EFF");
  if (dck.length) out.push({ kind: "dependent_child_key", columns: names(dck) });
  if (dk.length) out.push({ kind: "driving_key", columns: names(dk) });
  if (mak.length) out.push({ kind: "multi_active", columns: names(mak) });
  if (eff.length) out.push({ kind: "effective_dated", columns: names(eff) });

  const descriptive = cols.filter((c) => !c.is_primary_key && !c.is_foreign_key && !KEYISH.some((code) => cls.has(c.id, code)));
  if (descriptive.length) out.push({ kind: "satellite", descriptive: descriptive.length, personalData: names(descriptive.filter((c) => cls.has(c.id, "PII"))) });
  return out;
}

export const READING_EMPTY = "Classify columns (Business key, Link key…) to see what this table suggests.";
export const READING_FOOTER = "Hints from the classifications and the source’s keys; nothing is created.";

const list = (names: readonly string[]) => names.join(", ");

/** A line as text (the prototype's words; the panel sets the names in a monospace font). */
export function readingText(line: ReadingLine): string {
  switch (line.kind) {
    case "hub":
      return `Hub on ${list(line.columns)}`;
    case "hub_candidate":
      return "Marked as a hub candidate, but no column is a business key yet";
    case "link":
      return `Link to ${line.to} via ${list(line.columns)}${line.markedLinkKey ? "" : " (foreign key; not marked Link key)"}`;
    case "link_key_without_relationship":
      return `Link key ${list(line.columns)} with no relationship known: which table does it point to?`;
    case "dependent_child_key":
      return `Dependent child key ${list(line.columns)}: part of the link’s or satellite’s key, not a hub`;
    case "driving_key":
      return `Driving key ${list(line.columns)}: an effectivity satellite on the link tracks it`;
    case "multi_active":
      return `Multi-active satellite keyed by ${list(line.columns)}`;
    case "effective_dated":
      return `Effective-dated by ${list(line.columns)}`;
    case "satellite": {
      const n = `${line.descriptive} descriptive column${line.descriptive === 1 ? "" : "s"}`;
      const pii = line.personalData.length ? `; ${line.personalData.length} with personal data: consider a separate satellite for ${list(line.personalData)}` : "";
      return `Satellite with ${n}${pii}`;
    }
  }
}
