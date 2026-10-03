// Row types for the tables in slices 0 and 1a. Names and columns mirror docs/data-model-v2.md and
// supabase/migrations/20261002000000_initial_schema.sql, so the Supabase adapter can map them one to one.
// Timestamps are ISO 8601 strings (timestamptz).

import type { Uuid } from "./ids";

export type Timestamp = string;

// ---- Closed value lists (text + CHECK in the database, AD-18) ----

export const ORGANIZATION_ROLES = ["owner", "admin", "member"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const WORKSPACE_ROLES = ["owner", "admin", "modeler", "reviewer", "reader"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const DOC_LANGUAGES = ["en", "pl", "de"] as const;
export type DocLanguage = (typeof DOC_LANGUAGES)[number];

export const CHANGE_OPERATIONS = ["create", "update", "delete", "restore"] as const;
export type ChangeOperation = (typeof CHANGE_OPERATIONS)[number];

// ---- Standard columns (AD-12) ----

export interface VersionedColumns {
  id: Uuid;
  version: number;
  created_at: Timestamp;
  created_by: Uuid;
  updated_at: Timestamp;
  updated_by: Uuid;
  deleted_at: Timestamp | null;
}

export interface StandardColumns extends VersionedColumns {
  workspace_id: Uuid;
}

// ---- Tenancy and access ----

export interface AppUser {
  id: Uuid;
  email: string;
  display_name: string;
  created_at: Timestamp;
  last_seen_at: Timestamp | null;
}

export interface Organization extends VersionedColumns {
  name: string;
}

export interface OrganizationMember {
  organization_id: Uuid;
  user_id: Uuid;
  role: OrganizationRole;
  created_at: Timestamp;
}

export interface Workspace extends VersionedColumns {
  organization_id: Uuid;
  name: string;
  client_name: string | null;
  description: string | null;
  doc_language: DocLanguage;
  dv2_mode: boolean;
  four_eyes: boolean;
  archived_at: Timestamp | null;
  archived_by: Uuid | null;
  requirement_key_next: number;
}

export interface WorkspaceMember {
  workspace_id: Uuid;
  user_id: Uuid;
  role: WorkspaceRole;
  added_by: Uuid | null;
  created_at: Timestamp;
}

// ---- Model (data model section 4) ----

export const STEREOTYPES = ["object", "link", "dictionary", "context", "informative"] as const;
export type Stereotype = (typeof STEREOTYPES)[number];

export const LOGICAL_TYPES = ["string", "integer", "decimal", "boolean", "date", "datetime", "json", "custom"] as const;
export type LogicalType = (typeof LOGICAL_TYPES)[number];

export const CARDINALITY_MAX = ["1", "n"] as const;
export type CardinalityMax = (typeof CARDINALITY_MAX)[number];
export type CardinalityMin = 0 | 1;

export interface Concept extends StandardColumns {
  name: string;
  description_html: string | null;
  description_text: string | null;
  /** `#RRGGBB` from the concept palette, never violet (D-41). */
  color: string;
  sort_order: number;
}

export interface Entity extends StandardColumns {
  concept_id: Uuid;
  name: string;
  stereotype: Stereotype;
  definition_html: string | null;
  definition_text: string | null;
}

/** An attribute's type: logical type plus optional parameters (AD-27). */
export interface AttributeType {
  data_type: LogicalType;
  custom_type: string | null;
  type_length: number | null;
  type_precision: number | null;
  type_scale: number | null;
}

export interface Attribute extends StandardColumns, AttributeType {
  entity_id: Uuid;
  name: string;
  sort_order: number;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  is_business_key: boolean;
  is_pii: boolean;
  is_nullable: boolean;
  definition_html: string | null;
  definition_text: string | null;
}

export interface Relationship extends StandardColumns {
  from_entity_id: Uuid;
  to_entity_id: Uuid;
  label: string | null;
  from_min: CardinalityMin;
  from_max: CardinalityMax;
  to_min: CardinalityMin;
  to_max: CardinalityMax;
  description: string | null;
}

// ---- Sources (data model section 5) ----

export const SOURCE_OBJECT_TYPES = ["table", "view"] as const;
export type SourceObjectType = (typeof SOURCE_OBJECT_TYPES)[number];

export interface SourceSystem extends StandardColumns {
  name: string;
  description: string | null;
}

export interface SourceTable extends StandardColumns {
  source_system_id: Uuid;
  database_name: string;
  schema_name: string;
  name: string;
  object_type: SourceObjectType;
  row_count: number | null;
  comment: string | null;
}

export interface SourceColumn extends StandardColumns {
  source_table_id: Uuid;
  name: string;
  ordinal: number;
  /** Physical type as in the source, e.g. `varchar`. */
  data_type: string;
  type_length: number | null;
  type_precision: number | null;
  type_scale: number | null;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  is_business_key: boolean;
  is_pii: boolean;
  default_value: string | null;
  comment: string | null;
}

// ---- Mappings (data model section 6, AD-26) ----

export const MAPPING_KINDS = ["direct", "transform"] as const;
export type MappingKind = (typeof MAPPING_KINDS)[number];

export const MAPPING_STATUSES = ["draft", "review", "approved"] as const;
export type MappingStatus = (typeof MAPPING_STATUSES)[number];

export interface Mapping extends StandardColumns {
  attribute_id: Uuid;
  kind: MappingKind;
  rule_expression: string | null;
  status: MappingStatus;
  note_html: string | null;
  note_text: string | null;
  approved_by: Uuid | null;
  approved_at: Timestamp | null;
}

export interface MappingInput extends StandardColumns {
  mapping_id: Uuid;
  source_column_id: Uuid;
  sort_order: number;
}

// ---- Organisation of work ----

export interface Project extends StandardColumns {
  name: string;
  description: string | null;
}

export interface CanvasLook {
  background: string;
  grid: string;
  layer: string;
}

export const DEFAULT_CANVAS_LOOK: CanvasLook = { background: "grey", grid: "dots", layer: "all" };

export interface Canvas extends StandardColumns {
  name: string;
  live_label_id: Uuid | null;
  look: CanvasLook;
}

export interface ProjectCanvas {
  project_id: Uuid;
  canvas_id: Uuid;
  workspace_id: Uuid;
  sort_order: number;
  added_at: Timestamp;
  added_by: Uuid;
}

export const ROW_FILTERS = ["all", "mapped", "unmapped", "keys", "labeled"] as const;
export type RowFilter = (typeof ROW_FILTERS)[number];

export const LIVE_LEVELS = ["full", "context"] as const;
export type LiveLevel = (typeof LIVE_LEVELS)[number];

/** One card on one canvas (AD-16): exactly one of entity_id, source_table_id, requirement_id is set. */
export interface CanvasItem extends StandardColumns {
  canvas_id: Uuid;
  entity_id: Uuid | null;
  source_table_id: Uuid | null;
  requirement_id: Uuid | null;
  x: number;
  y: number;
  /** null = default width (D-37). */
  width: number | null;
  collapsed: boolean;
  row_filter: RowFilter;
  frame_id: Uuid | null;
  live_level: LiveLevel | null;
}

// ---- History ----

export type RowImage = Record<string, unknown>;

export interface ChangeEvent {
  id: Uuid;
  workspace_id: Uuid;
  change_group_id: Uuid;
  occurred_at: Timestamp;
  user_id: Uuid;
  object_type: string;
  object_id: Uuid;
  operation: ChangeOperation;
  before_image: RowImage | null;
  after_image: RowImage | null;
  context_label_id: Uuid | null;
}

/** The tables a command may write, with their row types. */
export interface WritableRows {
  workspace: Workspace;
  workspace_member: WorkspaceMember;
  project: Project;
  canvas: Canvas;
  project_canvas: ProjectCanvas;
  concept: Concept;
  entity: Entity;
  attribute: Attribute;
  relationship: Relationship;
  source_system: SourceSystem;
  source_table: SourceTable;
  source_column: SourceColumn;
  mapping: Mapping;
  mapping_input: MappingInput;
  canvas_item: CanvasItem;
}
export type WritableTable = keyof WritableRows;
