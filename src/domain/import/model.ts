// What the import engine reads (slice 7a, step 3): the workspace's sources, their relationships, and the mappings that
// read them, with the attributes and entities they feed. The rows are the domain's, plus the columns step 4 adds to the
// data model (`missing_since`, `file_format`, `review_reason`, relationships between source tables); until then they
// are optional, so today's rows can be passed as they are.

import type { Uuid } from "../ids";
import type { Attribute, Entity, Mapping, MappingInput, SourceColumn, SourceSystem, SourceTable, Timestamp } from "../types";
import type { StandardObjectType } from "./standard";

export interface ImportTable extends Omit<SourceTable, "object_type"> {
  object_type: StandardObjectType;
  file_format?: string | null;
  missing_since?: Timestamp | null;
}

export interface ImportColumn extends SourceColumn {
  missing_since?: Timestamp | null;
}

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

export interface ImportMapping extends Mapping {
  review_reason?: string | null;
}

export interface ImportModel {
  systems: readonly SourceSystem[];
  tables: readonly ImportTable[];
  columns: readonly ImportColumn[];
  relationships: readonly ImportRelationship[];
  mappings: readonly ImportMapping[];
  mappingInputs: readonly MappingInput[];
  attributes: readonly Attribute[];
  entities: readonly Entity[];
}
