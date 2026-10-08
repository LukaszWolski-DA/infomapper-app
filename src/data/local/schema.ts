// The shape of .data/dev-db.json and the rules the database would enforce on it: primary keys, unique indexes,
// foreign keys and CHECK constraints, mirroring supabase/migrations/20261002000000_initial_schema.sql
// for the tables built so far, plus the one rule the SQL cannot express: a card's frame is on the card's canvas.

import type {
  AppUser,
  Attribute,
  Canvas,
  CanvasItem,
  ChangeEvent,
  Concept,
  Entity,
  Frame,
  Mapping,
  MappingInput,
  Organization,
  OrganizationMember,
  Project,
  ProjectCanvas,
  Relationship,
  SourceColumn,
  SourceSystem,
  SourceTable,
  Workspace,
  WorkspaceMember,
} from "@/domain/types";
import {
  CARDINALITY_MAX,
  CHANGE_OPERATIONS,
  DOC_LANGUAGES,
  FRAME_KINDS,
  LIVE_LEVELS,
  LOGICAL_TYPES,
  MAPPING_KINDS,
  MAPPING_STATUSES,
  ORGANIZATION_ROLES,
  ROW_FILTERS,
  SOURCE_OBJECT_TYPES,
  STEREOTYPES,
  WORKSPACE_ROLES,
} from "@/domain/types";

/**
 * 2 = slice 1a (model tables), 3 = slice 2b (frames). A format-2 file is read as format 3 with no frames (it is
 * written back as 3 with the next write); an older file is refused with a hint to run "npm run reset-dev-data".
 */
export const DEV_DB_FORMAT = 3;

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
  mapping: Mapping[];
  mapping_input: MappingInput[];
  canvas_item: CanvasItem[];
  frame: Frame[];
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
  mapping: [],
  mapping_input: [],
  canvas_item: [],
  frame: [],
  change_event: [],
});

interface TableRules {
  key: readonly string[];
  /** column -> referenced table (always its `id`). Null values are allowed where the column is nullable. */
  foreignKeys: Readonly<Record<string, DevTable>>;
  /**
   * Unique indexes besides the key; `live` = only rows with deleted_at null, `where` = a further condition
   * (partial indexes such as "where entity_id is not null and deleted_at is null").
   */
  unique?: readonly { columns: readonly string[]; live?: boolean; where?: (row: AnyRow) => boolean }[];
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
  canvas: { key: ["id"], foreignKeys: { workspace_id: "workspace", ...audit } },
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
    checks: [{ name: "source_table_object_type_ck", test: oneOf(SOURCE_OBJECT_TYPES, "object_type") }],
  },
  source_column: {
    key: ["id"],
    foreignKeys: { ...model, source_table_id: "source_table" },
    unique: [{ columns: ["source_table_id", "name"], live: true }],
  },
  mapping: {
    key: ["id"],
    foreignKeys: { ...model, attribute_id: "attribute", approved_by: "app_user" },
    checks: [
      { name: "mapping_kind_ck", test: oneOf(MAPPING_KINDS, "kind") },
      { name: "mapping_status_ck", test: oneOf(MAPPING_STATUSES, "status") },
      { name: "mapping_rule_ck", test: (r) => r.kind === "direct" || isSet(r.rule_expression) },
      { name: "mapping_approval_ck", test: (r) => (r.status === "approved") === isSet(r.approved_at) },
    ],
  },
  mapping_input: {
    key: ["id"],
    foreignKeys: { ...model, mapping_id: "mapping", source_column_id: "source_column" },
    unique: [{ columns: ["mapping_id", "source_column_id"], live: true }],
  },
  canvas_item: {
    key: ["id"],
    // requirement_id points to a table the local file does not have yet (requirements).
    foreignKeys: { ...model, canvas_id: "canvas", entity_id: "entity", source_table_id: "source_table", frame_id: "frame" },
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
      { name: "canvas_item_no_requirement_yet", test: (r) => !isSet(r.requirement_id) },
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
  change_event: {
    key: ["id"],
    foreignKeys: { workspace_id: "workspace", user_id: "app_user" },
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

/** Checks every table against its rules. Returns the first violation, or null. */
export function findViolation(db: DevDb): IntegrityViolation | null {
  const ids = new Map<DevTable, Set<string>>();
  for (const table of TABLES) ids.set(table, new Set(rowsOf(db, table).map((r) => String(r.id))));

  for (const table of TABLES) {
    const rules = RULES[table];
    const rows = rowsOf(db, table);
    const keys = new Set<string>();
    for (const row of rows) {
      const key = keyOf(table, row);
      if (keys.has(key)) return { kind: "duplicate_key", table, detail: `duplicate key ${key}` };
      keys.add(key);
      for (const [column, target] of Object.entries(rules.foreignKeys)) {
        const value = row[column];
        if (value === null || value === undefined) continue;
        if (!ids.get(target)!.has(String(value))) {
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
        const value = index.columns.map((c) => String(row[c])).join("|");
        if (seen.has(value)) return { kind: "unique", table, detail: `${index.columns.join(", ")} = ${value} exists already` };
        seen.add(value);
      }
    }
  }
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
  return null;
}
