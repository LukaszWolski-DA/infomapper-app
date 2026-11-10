// The shape of .data/dev-db.json and the rules the database would enforce on it: primary keys, unique indexes,
// foreign keys and CHECK constraints, mirroring supabase/migrations/20261002000000_initial_schema.sql
// for the tables built so far, plus the rules the SQL cannot express: a card's frame is on the card's canvas, and a
// note's card, frames and canvas are one canvas (slice 3a).

import type {
  AppUser,
  Attribute,
  AttributeInput,
  Canvas,
  CanvasItem,
  ChangeEvent,
  Classification,
  ClassificationLink,
  Concept,
  Entity,
  Frame,
  Label,
  LabelLink,
  Mapping,
  MappingInput,
  Note,
  Organization,
  ModuleTable,
  OrganizationAccess,
  OrganizationLicence,
  OrganizationMember,
  Project,
  ProjectCanvas,
  ProjectPinnedLabel,
  Relationship,
  Requirement,
  RequirementLink,
  SourceChange,
  SourceColumn,
  SourceImport,
  SourceRelationship,
  SourceRelationshipColumn,
  SourceSystem,
  SourceTable,
  Stereotype,
  Workspace,
  WorkspaceMember,
  WritableRows,
} from "@/domain/types";
import { BUILTIN_STEREOTYPE_CODES } from "@/domain/model/stereotypes";
import { UNDOABLE_TABLES } from "@/domain/commands/undo";
import {
  CARDINALITY_MAX,
  CHANGE_OPERATIONS,
  CLASSIFICATION_ORIGINS,
  CLASSIFICATION_SCOPES,
  DOC_LANGUAGES,
  FRAME_KINDS,
  IMPORT_CHANNELS,
  LICENSED_MODULES,
  LIVE_LEVELS,
  LOGICAL_TYPES,
  MAPPING_KINDS,
  MAPPING_STATUSES,
  MODEL_LEVELS,
  NOTE_COLORS,
  NOTE_STATUSES,
  ORGANIZATION_ROLES,
  REQUIREMENT_KINDS,
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_SEVERITIES,
  REQUIREMENT_STATUSES,
  NAME_MODES,
  ROW_FILTERS,
  SOURCE_CHANGE_KINDS,
  SOURCE_CHANGE_SEVERITIES,
  SOURCE_CHANGE_STATUSES,
  SOURCE_OBJECT_TYPES,
  SOURCE_RELATIONSHIP_KINDS,
  STEREOTYPE_ORIGINS,
  WORKSPACE_ROLES,
} from "@/domain/types";

/**
 * 2 = slice 1a (model tables), 3 = slice 2b (frames), 4 = slice 3a (labels, label links, project pins, notes), 5 = slice
 * 4a (requirements, requirement links), 6 = slice 7a (source relationships and imports; `file_format` and `missing_since`
 * on sources, `review_reason` on mappings), 7 = slice 7b (changes to resolve; `retired_since` on sources, `not_needed`
 * on columns, two counts on imports), 8 = slice 7c (classifications and their links, notes on tables and columns; the
 * columns' business key and personal data flags dropped), 9 = slice 8 (organization access: every organization's
 * development password), 10 = slice 10c (`copied_from_attribute_id` on attributes, null), 11 = slice 11 (`alias` on
 * entities and attributes, `entity_names` and `attribute_names` on canvases and canvas items, all null). A format-2 to 10
 * file is read as format 11 with the missing tables empty and the new columns null (false, 0); a format-6 file also gets the open
 * changes its imports leave (`deriveSourceChanges`, F1), a format-7 file the classifications its flags said and its
 * hand-typed comments as notes (`upgrade-8.ts`), a format-8 file the password `demo-pass` for every organization (F7,
 * F18: no change events, one log line), a format-9 file the null link on every attribute (slice 10c, F11: no change
 * events, no log line), a format-10 file the null aliases and names (slice 11: no change events, no log line), a
 * format-11 file every entity's model level `logical`, every workspace's InfoCube off and no licences (slice 15a: no
 * change events, no log line), a format-12 file every relationship's two roles null (slice 15b: no change events, no log
 * line). 12 = slice 15a (`model_level` on entities, `infocube` on workspaces, `organization_licence`), 13 = slice 15b
 * (`from_role` and `to_role` on relationships), 14 = slice 18 (`is_calculated` false and `calc_rule` null on attributes,
 * `attribute_input`; no change events, no log line), 15 = slice 23 (`definition` on classifications, the built-in ones' in
 * their workspace's documentation language, and `naming_conventions` on workspaces, null; no change events, no log line), 16 = slice 24
 * (`stereotype`: every workspace's five built-in rows, English names, definitions in its documentation language, and an
 * own row for any other code an entity has, with one log line; no change events). It is written back at once; an older file no upgrade reaches is refused with a hint to
 * run "npm run reset-dev-data", a newer one (a newer branch wrote it) with the advice to switch back to that branch or
 * restore a backup, never a reset (`newerFormatMessage`, slice 15a). A module's tables are not part of the format (AD-33): a file without one has none of its rows yet.
 */
export const DEV_DB_FORMAT = 16;

export interface DevDb {
  format: typeof DEV_DB_FORMAT;
  app_user: AppUser[];
  organization: Organization[];
  organization_member: OrganizationMember[];
  organization_access: OrganizationAccess[];
  organization_licence: OrganizationLicence[];
  workspace: Workspace[];
  workspace_member: WorkspaceMember[];
  project: Project[];
  canvas: Canvas[];
  project_canvas: ProjectCanvas[];
  concept: Concept[];
  entity: Entity[];
  attribute: Attribute[];
  attribute_input: AttributeInput[];
  relationship: Relationship[];
  source_system: SourceSystem[];
  source_table: SourceTable[];
  source_column: SourceColumn[];
  source_relationship: SourceRelationship[];
  source_relationship_column: SourceRelationshipColumn[];
  source_import: SourceImport[];
  source_change: SourceChange[];
  classification: Classification[];
  classification_link: ClassificationLink[];
  stereotype: Stereotype[];
  mapping: Mapping[];
  mapping_input: MappingInput[];
  requirement: Requirement[];
  requirement_link: RequirementLink[];
  canvas_item: CanvasItem[];
  frame: Frame[];
  label: Label[];
  label_link: LabelLink[];
  project_pinned_label: ProjectPinnedLabel[];
  note: Note[];
  change_event: ChangeEvent[];
}

export type DevTable = Exclude<keyof DevDb, "format">;
export type AnyRow = Record<string, unknown>;

/**
 * A module's tables in the same file (slice 15a, AD-33): beside InfoMapper's, under their own names, absent until a
 * module writes its first row. InfoMapper's code never names them; their rules come with the store's schema.
 */
export type ModuleDb = { [T in ModuleTable]?: WritableRows[T][] };
/** Any table the store may hold: InfoMapper's and the modules'. */
export type StoreTable = DevTable | ModuleTable;

export const emptyDb = (): DevDb => ({
  format: DEV_DB_FORMAT,
  app_user: [],
  organization: [],
  organization_member: [],
  organization_access: [],
  organization_licence: [],
  workspace: [],
  workspace_member: [],
  project: [],
  canvas: [],
  project_canvas: [],
  concept: [],
  entity: [],
  attribute: [],
  attribute_input: [],
  relationship: [],
  source_system: [],
  source_table: [],
  source_column: [],
  source_relationship: [],
  source_relationship_column: [],
  source_import: [],
  source_change: [],
  classification: [],
  classification_link: [],
  stereotype: [],
  mapping: [],
  mapping_input: [],
  requirement: [],
  requirement_link: [],
  canvas_item: [],
  frame: [],
  label: [],
  label_link: [],
  project_pinned_label: [],
  note: [],
  change_event: [],
});

export interface TableRules {
  key: readonly string[];
  /** column -> referenced table (always its `id`). Null values are allowed where the column is nullable. */
  foreignKeys: Readonly<Record<string, StoreTable>>;
  /**
   * Unique indexes besides the key; `live` = only rows with deleted_at null, `where` = a further condition
   * (partial indexes such as "where entity_id is not null and deleted_at is null"), `lower` = columns compared in lower
   * case (an index on `lower(column)`).
   */
  unique?: readonly { columns: readonly string[]; live?: boolean; where?: (row: AnyRow) => boolean; lower?: readonly string[] }[];
  checks?: readonly { name: string; test: (row: AnyRow) => boolean }[];
  /**
   * A module's columns added after its table had rows (slice 18, Q2: InfoCube's lookup columns): a row without one reads
   * it as this value. A module's tables are not part of the file's format (AD-33), so no upgrade writes them.
   */
  defaults?: Readonly<Record<string, unknown>>;
  /**
   * A module's row stored in an older shape (slice 19, F1: InfoCube's `scd_type` became `history`): the row as it reads
   * now, or null when it is current. Pure and idempotent; the adapter runs it on every row of the table when the file is
   * loaded, before any read or check (`upgradeRows`), so the file holds the new shape after its next write. A module's
   * tables are not part of the file's format (AD-33): this is how a module changes its own rows' shape.
   */
  upgrade?: (row: AnyRow) => AnyRow | null;
}

const audit = { created_by: "app_user", updated_by: "app_user" } as const;
export const oneOf = (values: readonly string[], column: string) => (row: AnyRow) => values.includes(row[column] as string);
const isSet = (v: unknown) => v !== null && v !== undefined;
/** A stereotype's code (slice 24): lower-case letters, digits and `_`, starting with a letter, at most 30. */
const STEREOTYPE_CODE_RE = /^[a-z][a-z0-9_]{0,29}$/;
/** A nullable closed value (`x is null or x in (...)`). */
const noneOrOneOf = (values: readonly string[], column: string) => (row: AnyRow) => row[column] === null || values.includes(row[column] as string);
/** Standard model columns: the workspace and the audit users (a module's tables use them too, slice 15a). */
export const model = { workspace_id: "workspace", ...audit } as const;

function typeParamsFit(r: AnyRow): boolean {
  const length = r.type_length as number | null;
  const precision = r.type_precision as number | null;
  const scale = r.type_scale as number | null;
  return (
    (length === null || length > 0) &&
    (precision === null || precision > 0) &&
    (scale === null || (scale >= 0 && precision !== null && scale <= precision))
  );
}

export const RULES: Record<DevTable, TableRules> = {
  app_user: {
    key: ["id"],
    foreignKeys: {},
    unique: [{ columns: ["email"] }],
    checks: [{ name: "app_user_email_lower", test: (r) => r.email === String(r.email).toLowerCase() }],
  },
  organization: { key: ["id"], foreignKeys: audit },
  organization_member: {
    key: ["organization_id", "user_id"],
    foreignKeys: { organization_id: "organization", user_id: "app_user" },
    checks: [{ name: "organization_member_role_ck", test: oneOf(ORGANIZATION_ROLES, "role") }],
  },
  organization_access: {
    key: ["organization_id"],
    foreignKeys: { organization_id: "organization", changed_by: "app_user" },
  },
  // slice 15a (C-7): one live licence per organization and module
  organization_licence: {
    key: ["id"],
    foreignKeys: { organization_id: "organization", ...audit },
    unique: [{ columns: ["organization_id", "module"], live: true }],
    checks: [{ name: "organization_licence_module_ck", test: oneOf(LICENSED_MODULES, "module") }],
  },
  workspace: {
    key: ["id"],
    foreignKeys: { organization_id: "organization", archived_by: "app_user", ...audit },
    checks: [
      { name: "workspace_doc_language_ck", test: oneOf(DOC_LANGUAGES, "doc_language") },
      // slice 23: plain text, never empty (null when not set)
      { name: "workspace_naming_conventions_ck", test: (r) => !isSet(r.naming_conventions) || (typeof r.naming_conventions === "string" && r.naming_conventions.length > 0) },
    ],
  },
  workspace_member: {
    key: ["workspace_id", "user_id"],
    foreignKeys: { workspace_id: "workspace", user_id: "app_user", added_by: "app_user" },
    checks: [{ name: "workspace_member_role_ck", test: oneOf(WORKSPACE_ROLES, "role") }],
  },
  project: { key: ["id"], foreignKeys: { workspace_id: "workspace", ...audit } },
  canvas: {
    key: ["id"],
    foreignKeys: { workspace_id: "workspace", live_label_id: "label", ...audit },
    // at most one live canvas per label (canvas_live_label_uq, slice 3b)
    unique: [{ columns: ["live_label_id"], live: true, where: (r) => isSet(r.live_label_id) }],
    checks: [
      { name: "canvas_entity_names_ck", test: noneOrOneOf(NAME_MODES, "entity_names") },
      { name: "canvas_attribute_names_ck", test: noneOrOneOf(NAME_MODES, "attribute_names") },
    ],
  },
  project_canvas: {
    key: ["project_id", "canvas_id"],
    foreignKeys: { project_id: "project", canvas_id: "canvas", workspace_id: "workspace", added_by: "app_user" },
  },
  concept: {
    key: ["id"],
    foreignKeys: model,
    // Shape only, as in SQL; the palette (no violet, D-41) is the domain's rule.
    checks: [{ name: "concept_color_ck", test: (r) => typeof r.color === "string" && /^#.{6}$/.test(r.color) }],
  },
  entity: {
    key: ["id"],
    foreignKeys: { ...model, concept_id: "concept" },
    checks: [
      // slice 24 (F1): the code is one of the workspace's live stereotypes, which the domain checks on every write; the
      // SQL has a composite foreign key, the local adapter none (its keys point to ids; known-limitations.md)
      { name: "entity_stereotype_code_ck", test: (r) => typeof r.stereotype === "string" && STEREOTYPE_CODE_RE.test(r.stereotype) },
      { name: "entity_model_level_ck", test: oneOf(MODEL_LEVELS, "model_level") },
    ],
  },
  attribute: {
    key: ["id"],
    foreignKeys: { ...model, entity_id: "entity", copied_from_attribute_id: "attribute" },
    checks: [
      { name: "attribute_data_type_ck", test: oneOf(LOGICAL_TYPES, "data_type") },
      { name: "attribute_custom_type_ck", test: (r) => (r.data_type === "custom") === isSet(r.custom_type) },
      { name: "attribute_type_params_ck", test: typeParamsFit },
      // slice 18 (Q1): a rule only on a calculated attribute
      { name: "attribute_calc_ck", test: (r) => r.is_calculated === true || r.calc_rule == null },
    ],
  },
  // slice 18: one live row per pair, never the attribute itself; the same entity and no cycle are the domain's checks
  attribute_input: {
    key: ["id"],
    foreignKeys: { ...model, attribute_id: "attribute", input_attribute_id: "attribute" },
    unique: [{ columns: ["attribute_id", "input_attribute_id"], live: true }],
    checks: [{ name: "attribute_input_self_ck", test: (r) => r.attribute_id !== r.input_attribute_id }],
  },
  relationship: {
    key: ["id"],
    foreignKeys: { ...model, from_entity_id: "entity", to_entity_id: "entity" },
    checks: [
      { name: "relationship_min_ck", test: (r) => [0, 1].includes(r.from_min as number) && [0, 1].includes(r.to_min as number) },
      { name: "relationship_max_ck", test: (r) => oneOf(CARDINALITY_MAX, "from_max")(r) && oneOf(CARDINALITY_MAX, "to_max")(r) },
    ],
  },
  source_system: {
    key: ["id"],
    foreignKeys: model,
    unique: [{ columns: ["workspace_id", "name"], live: true }],
  },
  source_table: {
    key: ["id"],
    foreignKeys: { ...model, source_system_id: "source_system" },
    unique: [{ columns: ["source_system_id", "database_name", "schema_name", "name"], live: true }],
    checks: [
      { name: "source_table_object_type_ck", test: oneOf(SOURCE_OBJECT_TYPES, "object_type") },
      { name: "source_table_retired_ck", test: (r) => !isSet(r.retired_since) || isSet(r.missing_since) },
    ],
  },
  source_column: {
    key: ["id"],
    foreignKeys: { ...model, source_table_id: "source_table" },
    unique: [{ columns: ["source_table_id", "name"], live: true }],
    checks: [
      // slice 7a: -1 is max
      { name: "source_column_type_length_ck", test: (r) => r.type_length === null || r.type_length === -1 || (r.type_length as number) >= 1 },
      // slice 7b: only what left the source is retired
      { name: "source_column_retired_ck", test: (r) => !isSet(r.retired_since) || isSet(r.missing_since) },
    ],
  },
  source_relationship: {
    key: ["id"],
    foreignKeys: { ...model, source_table_id: "source_table", to_source_table_id: "source_table" },
    // source_relationship_name_uq: one name per from-table among live rows, in any case (slice 7a)
    unique: [{ columns: ["source_table_id", "name"], live: true, lower: ["name"] }],
    checks: [{ name: "source_relationship_kind_ck", test: oneOf(SOURCE_RELATIONSHIP_KINDS, "kind") }],
  },
  source_relationship_column: {
    key: ["id"],
    foreignKeys: { ...model, source_relationship_id: "source_relationship", from_column_id: "source_column", to_column_id: "source_column" },
  },
  source_import: {
    key: ["id"],
    foreignKeys: { ...model, source_system_id: "source_system" },
    checks: [
      { name: "source_import_channel_ck", test: oneOf(IMPORT_CHANNELS, "channel") },
      {
        name: "source_import_counts_ck",
        test: (r) =>
          ["tables_new", "columns_new", "columns_changed", "columns_renamed", "columns_missing", "relationships_new", "changes_raised", "changes_high"].every(
            (c) => Number.isInteger(r[c]) && (r[c] as number) >= 0,
          ),
      },
    ],
  },
  // slice 7b: a change to resolve names the objects its kind is about, and a resolved one says how, who and when
  source_change: {
    key: ["id"],
    foreignKeys: {
      ...model,
      source_system_id: "source_system",
      source_import_id: "source_import",
      source_table_id: "source_table",
      source_column_id: "source_column",
      mapping_id: "mapping",
      resolved_by: "app_user",
    },
    checks: [
      { name: "source_change_kind_ck", test: oneOf(SOURCE_CHANGE_KINDS, "kind") },
      { name: "source_change_severity_ck", test: oneOf(SOURCE_CHANGE_SEVERITIES, "severity") },
      { name: "source_change_status_ck", test: oneOf(SOURCE_CHANGE_STATUSES, "status") },
      {
        name: "source_change_resolved_ck",
        test: (r) => (r.status === "resolved") === (isSet(r.resolution) && isSet(r.resolved_by) && isSet(r.resolved_at)),
      },
      {
        name: "source_change_object_ck",
        test: (r) =>
          r.kind === "table_left" || r.kind === "new_table"
            ? isSet(r.source_table_id) && !isSet(r.source_column_id) && !isSet(r.mapping_id)
            : r.kind === "column_left" || r.kind === "new_column" || r.kind === "business_key_changed"
              ? isSet(r.source_column_id) && (r.kind === "business_key_changed" || !isSet(r.mapping_id))
              : isSet(r.mapping_id),
      },
    ],
  },
  // slice 7c: the classification list (P3) and classifications on sources (AD-15)
  classification: {
    key: ["id"],
    foreignKeys: model,
    unique: [
      { columns: ["workspace_id", "code"], where: (r) => isSet(r.code) },
      { columns: ["workspace_id", "scope", "name_key"], live: true },
    ],
    checks: [
      { name: "classification_scope_ck", test: oneOf(CLASSIFICATION_SCOPES, "scope") },
      { name: "classification_origin_ck", test: oneOf(CLASSIFICATION_ORIGINS, "origin") },
      // slice 23 (F3): an own one may have a code; a built-in one always has one, and every code has one shape
      { name: "classification_code_ck", test: (r) => r.origin === "own" || isSet(r.code) },
      { name: "classification_code_format_ck", test: (r) => !isSet(r.code) || (typeof r.code === "string" && /^[A-Z][A-Z0-9_]{0,29}$/.test(r.code)) },
      { name: "classification_definition_ck", test: (r) => !isSet(r.definition) || (typeof r.definition === "string" && r.definition.length > 0) },
    ],
  },
  classification_link: {
    key: ["id"],
    foreignKeys: { ...model, classification_id: "classification", source_table_id: "source_table", source_column_id: "source_column" },
    unique: [
      { columns: ["classification_id", "source_table_id"], live: true, where: (r) => isSet(r.source_table_id) },
      { columns: ["classification_id", "source_column_id"], live: true, where: (r) => isSet(r.source_column_id) },
    ],
    checks: [{ name: "classification_link_one_target_ck", test: (r) => [r.source_table_id, r.source_column_id].filter(isSet).length === 1 }],
  },
  // slice 24 (D-79): the workspace's entity stereotypes. A code is unique among every row, deleted ones too (never given
  // twice); D-78's comparison of names and codes is the domain's. Built-in rows have one of the five codes and are never
  // deleted, so a built-in code is always live (the write rule reads no model for it).
  stereotype: {
    key: ["id"],
    foreignKeys: model,
    unique: [
      { columns: ["workspace_id", "code"] },
      { columns: ["workspace_id", "name_key"], live: true },
    ],
    checks: [
      { name: "stereotype_origin_ck", test: oneOf(STEREOTYPE_ORIGINS, "origin") },
      { name: "stereotype_code_format_ck", test: (r) => typeof r.code === "string" && STEREOTYPE_CODE_RE.test(r.code) },
      { name: "stereotype_builtin_code_ck", test: (r) => r.origin !== "builtin" || (BUILTIN_STEREOTYPE_CODES as readonly string[]).includes(r.code as string) },
      { name: "stereotype_builtin_kept_ck", test: (r) => r.origin === "own" || r.deleted_at === null },
      { name: "stereotype_definition_ck", test: (r) => !isSet(r.definition) || (typeof r.definition === "string" && r.definition.length > 0) },
    ],
  },
  mapping: {

    key: ["id"],
    foreignKeys: { ...model, attribute_id: "attribute", approved_by: "app_user" },
    checks: [
      { name: "mapping_kind_ck", test: oneOf(MAPPING_KINDS, "kind") },
      { name: "mapping_status_ck", test: oneOf(MAPPING_STATUSES, "status") },
      { name: "mapping_rule_ck", test: (r) => r.kind === "direct" || isSet(r.rule_expression) },
      { name: "mapping_approval_ck", test: (r) => (r.status === "approved") === isSet(r.approved_at) },
      // slice 7a: an import's reason belongs to a mapping in review
      { name: "mapping_review_reason_ck", test: (r) => !isSet(r.review_reason) || r.status === "review" },
    ],
  },
  mapping_input: {
    key: ["id"],
    foreignKeys: { ...model, mapping_id: "mapping", source_column_id: "source_column" },
    unique: [{ columns: ["mapping_id", "source_column_id"], live: true }],
  },
  requirement: {
    key: ["id"],
    foreignKeys: { ...model, parent_id: "requirement" },
    // requirement_key_uq: unique per workspace in any case among live rows (slice 4a migration)
    unique: [{ columns: ["workspace_id", "key"], live: true, lower: ["key"] }],
    checks: [
      { name: "requirement_kind_ck", test: oneOf(REQUIREMENT_KINDS, "kind") },
      { name: "requirement_status_ck", test: oneOf(REQUIREMENT_STATUSES, "status") },
      { name: "requirement_priority_ck", test: oneOf(REQUIREMENT_PRIORITIES, "priority") },
      { name: "requirement_severity_ck", test: (r) => r.severity === null || oneOf(REQUIREMENT_SEVERITIES, "severity")(r) },
      { name: "requirement_not_own_parent_ck", test: (r) => r.parent_id === null || r.parent_id !== r.id },
    ],
  },
  requirement_link: {
    key: ["id"],
    foreignKeys: {
      ...model,
      requirement_id: "requirement",
      entity_id: "entity",
      attribute_id: "attribute",
      mapping_id: "mapping",
      source_table_id: "source_table",
      source_column_id: "source_column",
    },
    checks: [
      {
        name: "requirement_link_one_target_ck",
        test: (r) => [r.entity_id, r.attribute_id, r.mapping_id, r.source_table_id, r.source_column_id].filter(isSet).length === 1,
      },
    ],
  },
  canvas_item: {
    key: ["id"],
    foreignKeys: { ...model, canvas_id: "canvas", entity_id: "entity", source_table_id: "source_table", requirement_id: "requirement", frame_id: "frame" },
    unique: [
      { columns: ["canvas_id", "entity_id"], live: true, where: (r) => isSet(r.entity_id) },
      { columns: ["canvas_id", "source_table_id"], live: true, where: (r) => isSet(r.source_table_id) },
      { columns: ["canvas_id", "requirement_id"], live: true, where: (r) => isSet(r.requirement_id) },
    ],
    checks: [
      { name: "canvas_item_one_target_ck", test: (r) => [r.entity_id, r.source_table_id, r.requirement_id].filter(isSet).length === 1 },
      { name: "canvas_item_width_ck", test: (r) => r.width === null || ((r.width as number) >= 200 && (r.width as number) <= 600) },
      { name: "canvas_item_row_filter_ck", test: oneOf(ROW_FILTERS, "row_filter") },
      { name: "canvas_item_live_level_ck", test: (r) => r.live_level === null || oneOf(LIVE_LEVELS, "live_level")(r) },
      { name: "canvas_item_entity_names_ck", test: noneOrOneOf(NAME_MODES, "entity_names") },
      { name: "canvas_item_attribute_names_ck", test: noneOrOneOf(NAME_MODES, "attribute_names") },
    ],
  },
  frame: {
    key: ["id"],
    foreignKeys: { ...model, canvas_id: "canvas", concept_id: "concept", source_system_id: "source_system" },
    checks: [
      { name: "frame_kind_ck", test: oneOf(FRAME_KINDS, "kind") },
      {
        name: "frame_ref_ck",
        test: (r) =>
          (r.kind === "concept" && isSet(r.concept_id) && !isSet(r.source_system_id)) ||
          (r.kind === "source_system" && isSet(r.source_system_id) && !isSet(r.concept_id)) ||
          (r.kind === "free" && !isSet(r.concept_id) && !isSet(r.source_system_id)),
      },
      { name: "frame_size_ck", test: (r) => (r.width as number) > 0 && (r.height as number) > 0 },
    ],
  },
  label: {
    key: ["id"],
    foreignKeys: model,
    unique: [{ columns: ["workspace_id", "name_key"], live: true }],
    checks: [{ name: "label_name_key_ck", test: (r) => r.name_key === String(r.name).toLowerCase() }],
  },
  label_link: {
    key: ["id"],
    foreignKeys: {
      ...model,
      label_id: "label",
      entity_id: "entity",
      attribute_id: "attribute",
      mapping_id: "mapping",
      source_table_id: "source_table",
      source_column_id: "source_column",
    },
    checks: [
      {
        name: "label_link_one_target_ck",
        test: (r) => [r.entity_id, r.attribute_id, r.mapping_id, r.source_table_id, r.source_column_id].filter(isSet).length === 1,
      },
    ],
  },
  project_pinned_label: {
    key: ["project_id", "label_id"],
    foreignKeys: { project_id: "project", label_id: "label", workspace_id: "workspace" },
  },
  note: {
    key: ["id"],
    foreignKeys: {
      ...model,
      canvas_id: "canvas",
      resolved_by: "app_user",
      pin_canvas_item_id: "canvas_item",
      pin_frame_id: "frame",
      frame_id: "frame",
    },
    checks: [
      { name: "note_color_ck", test: oneOf(NOTE_COLORS, "color") },
      { name: "note_status_ck", test: oneOf(NOTE_STATUSES, "status") },
      { name: "note_one_pin_ck", test: (r) => !isSet(r.pin_canvas_item_id) || !isSet(r.pin_frame_id) },
      { name: "note_pinned_not_in_frame_ck", test: (r) => (!isSet(r.pin_canvas_item_id) && !isSet(r.pin_frame_id)) || !isSet(r.frame_id) },
      { name: "note_width_ck", test: (r) => Number.isInteger(r.width) && (r.width as number) >= 160 && (r.width as number) <= 520 },
    ],
  },
  change_event: {
    key: ["id"],
    foreignKeys: { workspace_id: "workspace", user_id: "app_user", context_label_id: "label" },
    checks: [
      { name: "change_event_operation_ck", test: oneOf(CHANGE_OPERATIONS, "operation") },
      {
        name: "change_event_images_ck",
        test: (r) =>
          (r.operation === "create" && r.before_image === null && r.after_image !== null) ||
          ((r.operation === "update" || r.operation === "restore") && r.before_image !== null && r.after_image !== null) ||
          (r.operation === "delete" && r.before_image !== null),
      },
    ],
  },
};

export const TABLES = Object.keys(RULES) as DevTable[];

/**
 * The tables a store knows (slice 15a, AD-33): InfoMapper's rules and the registered modules', and the tables undo
 * reads. Made once by `localSchema`; `src/compose/tables.ts` makes the application's.
 */
export interface LocalSchema {
  readonly rules: Readonly<Record<string, TableRules>>;
  readonly tables: readonly string[];
  /** The tables `loadForUndo` reads: InfoMapper's undoable ones and the modules'. */
  readonly undoable: readonly string[];
}

/** InfoMapper's rules with a module's added; a name InfoMapper already has is refused. */
export function localSchema(moduleRules: Readonly<Partial<Record<ModuleTable, TableRules>>>, undoable: readonly string[] = UNDOABLE_TABLES): LocalSchema {
  const rules: Record<string, TableRules> = { ...RULES };
  for (const [table, r] of Object.entries(moduleRules) as [string, TableRules | undefined][]) {
    if (!r) continue;
    if (table in rules) throw new Error(`The table ${table} is InfoMapper's or registered twice.`);
    rules[table] = r;
  }
  return { rules, tables: Object.keys(rules), undoable };
}

/** InfoMapper's tables only: tests, scripts and earlier specs' helpers that write no module rows. */
export const CORE_SCHEMA: LocalSchema = localSchema({});

/**
 * The rows of a table as plain records, for the generic rules below and the adapter. A module's table may be absent from
 * the file (no rows yet): read as empty.
 */
export const rowsOf = (db: DevDb, table: StoreTable): AnyRow[] => ((db as unknown as Record<string, AnyRow[] | undefined>)[table] ?? []);

const upgraded = new WeakMap<object, WeakMap<LocalSchema, DevDb>>();

/**
 * The file as the store reads it (slice 19, F1): every module table with an `upgrade` gets its older rows in the current
 * shape. The same object when nothing needs it; otherwise a copy with only those tables new, frozen like the cached file,
 * and remembered per loaded file and schema, so a cached read is upgraded once.
 */
export function upgradeRows(db: Readonly<DevDb>, schema: LocalSchema): Readonly<DevDb> {
  const seen = upgraded.get(db)?.get(schema);
  if (seen) return seen;
  let out: DevDb | null = null;
  for (const [table, rules] of Object.entries(schema.rules)) {
    if (!rules.upgrade) continue;
    const rows = rowsOf(db as DevDb, table as StoreTable);
    let changed: AnyRow[] | null = null;
    rows.forEach((r, i) => {
      const next = rules.upgrade!(r);
      if (!next) return;
      changed ??= [...rows];
      changed[i] = Object.freeze(next);
    });
    if (!changed) continue;
    out ??= { ...(db as DevDb) };
    (out as unknown as Record<string, unknown>)[table] = Object.freeze(changed);
  }
  const result = out ? (Object.freeze(out) as Readonly<DevDb>) : db;
  let bySchema = upgraded.get(db);
  if (!bySchema) upgraded.set(db, (bySchema = new WeakMap()));
  bySchema.set(schema, result as DevDb);
  return result;
}

/** The rows as a command reads them: a module's columns a row lacks take their defaults (`TableRules.defaults`). */
export function readRows(db: DevDb, table: StoreTable, schema: LocalSchema): AnyRow[] {
  const rows = rowsOf(db, table);
  const defaults = schema.rules[table]?.defaults;
  if (!defaults) return rows;
  const keys = Object.keys(defaults);
  return rows.map((r) => (keys.every((k) => k in r) ? r : { ...defaults, ...r }));
}

export const keyOf = (table: StoreTable, row: AnyRow, schema: LocalSchema = CORE_SCHEMA): string => {
  const rules = schema.rules[table];
  if (!rules) throw new Error(`The store does not know the table ${table}: register it (src/compose/tables.ts).`);
  return rules.key.map((c) => String(row[c])).join("|");
};

export interface IntegrityViolation {
  kind: "duplicate_key" | "unique" | "foreign_key" | "check" | "unknown_table";
  table: StoreTable;
  detail: string;
}

/**
 * Checks the tables against their rules. Returns the first violation, or null. With `scope` (a write, slice 7a): only
 * the tables it touched, and of the change events only the new ones (the last `newEvents`) besides their keys. Rows of
 * other tables cannot break: writes never take an id away (deletes are soft; removed link rows are no foreign key's
 * target).
 */
export function findViolation(
  db: DevDb,
  scope?: { tables: ReadonlySet<StoreTable>; newEvents: number },
  schema: LocalSchema = CORE_SCHEMA,
): IntegrityViolation | null {
  // a table the schema does not know (a module's rows without its registration) is refused, never skipped (slice 15a)
  const present = scope ? [...scope.tables] : (Object.keys(db).filter((k) => k !== "format") as StoreTable[]);
  const unknown = present.find((t) => !schema.rules[t]);
  if (unknown) return { kind: "unknown_table", table: unknown, detail: `no rules for ${unknown}` };
  const idsCache = new Map<StoreTable, Set<string>>();
  const ids = (table: StoreTable) => {
    let set = idsCache.get(table);
    if (!set) {
      set = new Set(rowsOf(db, table).map((r) => String(r.id)));
      idsCache.set(table, set);
    }
    return set;
  };

  for (const table of schema.tables as StoreTable[]) {
    const isEvents = table === "change_event";
    if (scope && !isEvents && !scope.tables.has(table)) continue;
    const rules = schema.rules[table]!;
    const rows = rowsOf(db, table);
    const keys = new Set<string>();
    const firstChecked = scope && isEvents ? rows.length - scope.newEvents : 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const key = keyOf(table, row, schema);
      if (keys.has(key)) return { kind: "duplicate_key", table, detail: `duplicate key ${key}` };
      keys.add(key);
      if (i < firstChecked) continue;
      for (const [column, target] of Object.entries(rules.foreignKeys)) {
        const value = row[column];
        if (value === null || value === undefined) continue;
        if (!ids(target).has(String(value))) {
          return { kind: "foreign_key", table, detail: `${column} = ${String(value)} is not in ${target}` };
        }
      }
      for (const check of rules.checks ?? []) {
        if (!check.test(row)) return { kind: "check", table, detail: `${check.name} failed for ${key}` };
      }
    }
    for (const index of rules.unique ?? []) {
      const seen = new Set<string>();
      for (const row of rows) {
        if (index.live && row.deleted_at !== null) continue;
        if (index.where && !index.where(row)) continue;
        const value = index.columns.map((c) => (index.lower?.includes(c) ? String(row[c]).toLowerCase() : String(row[c]))).join("|");
        if (seen.has(value)) return { kind: "unique", table, detail: `${index.columns.join(", ")} = ${value} exists already` };
        seen.add(value);
      }
    }
  }
  if (scope && !["canvas", "canvas_item", "frame", "note"].some((t) => scope.tables.has(t as StoreTable))) return null;
  return crossTableViolation(db);
}

/** Rules across tables that the SQL cannot express; the domain keeps them, the local file checks them too. */
function crossTableViolation(db: DevDb): IntegrityViolation | null {
  const frameCanvas = new Map(db.frame.map((f) => [f.id, f.canvas_id]));
  for (const item of db.canvas_item) {
    if (item.frame_id !== null && frameCanvas.get(item.frame_id) !== item.canvas_id) {
      return { kind: "check", table: "canvas_item", detail: `canvas_item_frame_on_canvas failed for ${item.id}` };
    }
  }
  // A note is on the canvas of the card or frame it is pinned to and of the frame it belongs to (slice 3a).
  const itemCanvas = new Map(db.canvas_item.map((i) => [i.id, i.canvas_id]));
  for (const note of db.note) {
    const onCanvas =
      (note.pin_canvas_item_id === null || itemCanvas.get(note.pin_canvas_item_id) === note.canvas_id) &&
      (note.pin_frame_id === null || frameCanvas.get(note.pin_frame_id) === note.canvas_id) &&
      (note.frame_id === null || frameCanvas.get(note.frame_id) === note.canvas_id);
    if (!onCanvas) return { kind: "check", table: "note", detail: `note_on_one_canvas failed for ${note.id}` };
  }
  // A card has a live level only on a live canvas (data model, canvas_item; slice 3b).
  const liveCanvas = new Set(db.canvas.filter((c) => c.live_label_id !== null).map((c) => c.id));
  for (const item of db.canvas_item) {
    if (item.live_level !== null && item.deleted_at === null && !liveCanvas.has(item.canvas_id)) {
      return { kind: "check", table: "canvas_item", detail: `canvas_item_live_level_on_live_canvas failed for ${item.id}` };
    }
  }
  return null;
}
