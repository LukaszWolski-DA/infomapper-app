// Row types for the tables built so far (slices 0 to 3a). Names and columns mirror docs/data-model-v2.md and
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

/** The live model of one workspace (slice 1a). */
export interface WorkspaceModel {
  /** In panel order (sort_order). */
  concepts: Concept[];
  entities: Entity[];
  /** Per entity in model order (sort_order, D-36). */
  attributes: Attribute[];
  relationships: Relationship[];
  sourceSystems: SourceSystem[];
  sourceTables: SourceTable[];
  /** Per table in physical order (ordinal). */
  sourceColumns: SourceColumn[];
  mappings: Mapping[];
  /** Per mapping in rule order (sort_order). */
  mappingInputs: MappingInput[];
}

// ---- Organisation of work ----

export interface Project extends StandardColumns {
  name: string;
  description: string | null;
}

/** A canvas's look (D-12): background and grid, and its layer mode (D-22). Stored as JSON in `canvas.look`. */
export const CANVAS_BACKGROUNDS = ["grey", "white", "blue", "warm"] as const;
export type CanvasBackground = (typeof CANVAS_BACKGROUNDS)[number];

export const CANVAS_GRIDS = ["dots", "lines", "none"] as const;
export type CanvasGrid = (typeof CANVAS_GRIDS)[number];

/** Everything, only the mapping lines, or only the relationship lines; cards always show. */
export const CANVAS_LAYERS = ["all", "mappings", "relationships"] as const;
export type CanvasLayer = (typeof CANVAS_LAYERS)[number];

export interface CanvasLook {
  background: CanvasBackground;
  grid: CanvasGrid;
  layer: CanvasLayer;
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

/** What a frame stands for (D-04, D-05): a concept, a source system, or only an area of this canvas. */
export const FRAME_KINDS = ["concept", "source_system", "free"] as const;
export type FrameKind = (typeof FRAME_KINDS)[number];

/**
 * An area of one canvas (AD-16, D-04): a concept frame has a concept, a source frame a source system, a free frame
 * neither (`frame_ref_ck`). Cards belong to it through `canvas_item.frame_id`. `collapsed` stays false until slice 2c.
 */
export interface Frame extends StandardColumns {
  canvas_id: Uuid;
  name: string;
  kind: FrameKind;
  concept_id: Uuid | null;
  source_system_id: Uuid | null;
  /** `#RRGGBB`; the colour of a free frame (a concept frame takes its concept's colour). */
  color: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
}

// ---- Working layer (data model section 8, slice 3a) ----

/**
 * A working label such as `CR-23` (D-08): kept apart from the model's own tags. `name_key` is the lower-case copy the
 * server writes; it carries the case-insensitive unique name per workspace.
 */
export interface Label extends StandardColumns {
  name: string;
  name_key: string;
}

/** One label on one item (AD-15): exactly one of the five targets is set. */
export interface LabelLink extends StandardColumns {
  label_id: Uuid;
  entity_id: Uuid | null;
  attribute_id: Uuid | null;
  mapping_id: Uuid | null;
  source_table_id: Uuid | null;
  source_column_id: Uuid | null;
}

/** A label pinned to a project's home (D-29). A link row: removed, not soft-deleted. */
export interface ProjectPinnedLabel {
  project_id: Uuid;
  label_id: Uuid;
  workspace_id: Uuid;
}

export const NOTE_COLORS = ["yellow", "blue", "green", "pink", "grey"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export const NOTE_STATUSES = ["open", "resolved"] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

/**
 * A note on a canvas (D-20, D-21). Free: `x`, `y` are its place on the canvas and `frame_id` the frame it was dropped
 * in. Pinned to a card (`pin_canvas_item_id`) or a frame (`pin_frame_id`), at most one: `x`, `y` are its offset from
 * that element, and it is in no frame.
 */
export interface Note extends StandardColumns {
  canvas_id: Uuid;
  body_html: string | null;
  body_text: string | null;
  color: NoteColor;
  status: NoteStatus;
  resolved_at: Timestamp | null;
  resolved_by: Uuid | null;
  width: number;
  pin_canvas_item_id: Uuid | null;
  pin_frame_id: Uuid | null;
  x: number;
  y: number;
  frame_id: Uuid | null;
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
  frame: Frame;
  label: Label;
  label_link: LabelLink;
  project_pinned_label: ProjectPinnedLabel;
  note: Note;
}
export type WritableTable = keyof WritableRows;

/** Link tables without an id or `deleted_at`: their rows are removed, not soft-deleted (data model, change_event). */
export const LINK_TABLES = ["project_canvas", "project_pinned_label"] as const;
export type LinkTable = (typeof LINK_TABLES)[number];
