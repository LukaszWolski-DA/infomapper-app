// The shape of .data/dev-db.json and the rules the database would enforce on it: primary keys, unique indexes,
// foreign keys and CHECK constraints, mirroring supabase/migrations/20261002000000_initial_schema.sql
// for the tables built so far, plus the rules the SQL cannot express: a card's frame is on the card's canvas, and a
// note's card, frames and canvas are one canvas (slice 3a).

import type {
  AppUser,
  Attribute,
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
  Workspace,
  WorkspaceMember,
} from "@/domain/types";
import {
  CARDINALITY_MAX,
  CHANGE_OPERATIONS,
  CLASSIFICATION_ORIGINS,
  CLASSIFICATION_SCOPES,
  DOC_LANGUAGES,
  FRAME_KINDS,
  IMPORT_CHANNELS,
  LIVE_LEVELS,
  LOGICAL_TYPES,
  MAPPING_KINDS,
  MAPPING_STATUSES,
  NOTE_COLORS,
  NOTE_STATUSES,
  ORGANIZATION_ROLES,
  REQUIREMENT_KINDS,
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_SEVERITIES,
  REQUIREMENT_STATUSES,
  ROW_FILTERS,
  SOURCE_CHANGE_KINDS,
  SOURCE_CHANGE_SEVERITIES,
  SOURCE_CHANGE_STATUSES,
  SOURCE_OBJECT_TYPES,
  SOURCE_RELATIONSHIP_KINDS,
  STEREOTYPES,
  WORKSPACE_ROLES,
} from "@/domain/types";

/**
 * 2 = slice 1a (model tables), 3 = slice 2b (frames), 4 = slice 3a (labels, label links, project pins, notes), 5 = slice
 * 4a (requirements, requirement links), 6 = slice 7a (source relationships and imports; `file_format` and `missing_since`
 * on sources, `review_reason` on mappings), 7 = slice 7b (changes to resolve; `retired_since` on sources, `not_needed`
 * on columns, two counts on imports), 8 = slice 7c (classifications and their links, notes on tables and columns; the
 * columns' business key and personal data flags dropped). A format-2 to 7 file is read as format 8 with the missing
 * tables empty and the new columns null (false, 0); a format-6 file also gets the open changes its imports leave
 * (`deriveSourceChanges`, F1), a format-7 file the classifications its flags said and its hand-typed comments as notes
 * (`upgrade-8.ts`). It is written back at once; an older file is refused with a hint to run "npm run reset-dev-data".
 */
export const DEV_DB_FORMAT = 8;

export interface DevDb {
  format: typeof DEV_DB_FORMAT;
  app_user: AppUser[];
  organization: Organization[];
  organization_member: OrganizationMember[];
  workspace: Workspace[];
  workspace_member: WorkspaceMember[];
  project: Project[];
  canvas: Canvas[];
  project_canvas: ProjectCanvas[];
  concept: Concept[];
  entity: Entity[];
  attribute: Attribute[];
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

export const emptyDb = (): DevDb => ({
  format: DEV_DB_FORMAT,
  app_user: [],
  organization: [],
  organization_member: [],
  workspace: [],
  workspace_member: [],
  project: [],
  canvas: [],
  project_canvas: [],
  concept: [],
  entity: [],
  attribute: [],
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

interface TableRules {
  key: readonly string[];
  /** column -> referenced table (always its `id`). Null values are allowed where the column is nullable. */
  foreignKeys: Readonly<Record<string, DevTable>>;
  /**
   * Unique indexes besides the key; `live` = only rows with deleted_at null, `where` = a further condition
   * (partial indexes such as "where entity_id is not null and deleted_at is null"), `lower` = columns compared in lower
   * case (an index on `lower(column)`).
   */
  unique?: readonly { columns: readonly string[]; live?: boolean; where?: (row: AnyRow) => boolean; lower?: readonly string[] }[];
  checks?: readonly { name: string; test: (row: AnyRow) => boolean }[];
}

const audit = { created_by: "app_user", updated_by: "app_user" } as const;
const oneOf = (values: readonly string[], column: string) => (row: AnyRow) => values.includes(row[column] as string);
const isSet = (v: unknown) => v !== null && v !== undefined;
/** Standard model columns: the workspace and the audit users. */
const model = { workspace_id: "workspace", ...audit } as const;

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
  workspace: {
    key: ["id"],
    foreignKeys: { organization_id: "organization", archived_by: "app_user", ...audit },
    checks: [{ name: "workspace_doc_language_ck", test: oneOf(DOC_LANGUAGES, "doc_language") }],
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
    checks: [{ name: "entity_stereotype_ck", test: oneOf(STEREOTYPES, "stereotype") }],
  },
  attribute: {
    key: ["id"],
    foreignKeys: { ...model, entity_id: "entity" },
    checks: [
      { name: "attribute_data_type_ck", test: oneOf(LOGICAL_TYPES, "data_type") },
      { name: "attribute_custom_type_ck", test: (r) => (r.data_type === "custom") === isSet(r.custom_type) },
      { name: "attribute_type_params_ck", test: typeParamsFit },
    ],
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
      { name: "classification_code_ck", test: (r) => (r.origin === "own") === !isSet(r.code) },
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

/** The rows of a table as plain records, for the generic rules below and the adapter. */
export const rowsOf = (db: DevDb, table: DevTable): AnyRow[] => db[table] as unknown as AnyRow[];

export const keyOf = (table: DevTable, row: AnyRow): string => RULES[table].key.map((c) => String(row[c])).join("|");

export interface IntegrityViolation {
  kind: "duplicate_key" | "unique" | "foreign_key" | "check";
  table: DevTable;
  detail: string;
}

/**
 * Checks the tables against their rules. Returns the first violation, or null. With `scope` (a write, slice 7a): only
 * the tables it touched, and of the change events only the new ones (the last `newEvents`) besides their keys. Rows of
 * other tables cannot break: writes never take an id away (deletes are soft; removed link rows are no foreign key's
 * target).
 */
export function findViolation(db: DevDb, scope?: { tables: ReadonlySet<DevTable>; newEvents: number }): IntegrityViolation | null {
  const idsCache = new Map<DevTable, Set<string>>();
  const ids = (table: DevTable) => {
    let set = idsCache.get(table);
    if (!set) {
      set = new Set(rowsOf(db, table).map((r) => String(r.id)));
      idsCache.set(table, set);
    }
    return set;
  };

  for (const table of TABLES) {
    const isEvents = table === "change_event";
    if (scope && !isEvents && !scope.tables.has(table)) continue;
    const rules = RULES[table];
    const rows = rowsOf(db, table);
    const keys = new Set<string>();
    const firstChecked = scope && isEvents ? rows.length - scope.newEvents : 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const key = keyOf(table, row);
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
  if (scope && !["canvas", "canvas_item", "frame", "note"].some((t) => scope.tables.has(t as DevTable))) return null;
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
