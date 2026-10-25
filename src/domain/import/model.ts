// What the import engine reads (slice 7a, step 3): the workspace's sources, their relationships, and the mappings that
// read them, with the attributes and entities they feed, and the changes to resolve (slice 7b). The rows are the domain's; a relationship comes with its
// column pairs (`relationshipsWithColumns` puts them together).

import type { Uuid } from "../ids";
import type { Attribute, Entity, Mapping, MappingInput, SourceChange, SourceColumn, SourceRelationship, SourceRelationshipColumn, SourceSystem, SourceTable, Timestamp } from "../types";

export type ImportTable = SourceTable;
export type ImportColumn = SourceColumn;

/** A foreign key between two source tables (data model item 3), with its column pairs in order. */
export interface ImportRelationship {
  id: Uuid;
  version: number;
  deleted_at: Timestamp | null;
  source_table_id: Uuid;
  to_source_table_id: Uuid;
  name: string;
  missing_since: Timestamp | null;
  columns: readonly { id: Uuid; from_column_id: Uuid; to_column_id: Uuid; sort_order: number }[];
}

export type ImportMapping = Mapping;

export interface ImportModel {
  systems: readonly SourceSystem[];
  tables: readonly ImportTable[];
  columns: readonly ImportColumn[];
  relationships: readonly ImportRelationship[];
  mappings: readonly ImportMapping[];
  mappingInputs: readonly MappingInput[];
  attributes: readonly Attribute[];
  entities: readonly Entity[];
  /** The workspace's changes to resolve (slice 7b): an import settles the open ones the source settles (P7). */
  changes?: readonly SourceChange[];
}

/** The engine's view of stored rows: each live relationship with its live column pairs. */
export function relationshipsWithColumns(relationships: readonly SourceRelationship[], columns: readonly SourceRelationshipColumn[]): ImportRelationship[] {
  const pairs = new Map<Uuid, ImportRelationship["columns"][number][]>();
  for (const c of columns) {
    if (c.deleted_at !== null) continue;
    const list = pairs.get(c.source_relationship_id) ?? pairs.set(c.source_relationship_id, []).get(c.source_relationship_id)!;
    list.push({ id: c.id, from_column_id: c.from_column_id, to_column_id: c.to_column_id, sort_order: c.sort_order });
  }
  return relationships
    .filter((r) => r.deleted_at === null)
    .map((r) => ({
      id: r.id,
      version: r.version,
      deleted_at: r.deleted_at,
      source_table_id: r.source_table_id,
      to_source_table_id: r.to_source_table_id,
      name: r.name,
      missing_since: r.missing_since,
      columns: pairs.get(r.id) ?? [],
    }));
}
