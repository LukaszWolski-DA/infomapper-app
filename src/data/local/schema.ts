// The shape of .data/dev-db.json and the rules the database would enforce on it: primary keys, unique indexes,
// foreign keys and CHECK constraints, mirroring supabase/migrations/20261002000000_initial_schema.sql
// for the slice 0 tables.

import type {
  AppUser,
  Canvas,
  ChangeEvent,
  Organization,
  OrganizationMember,
  Project,
  ProjectCanvas,
  Workspace,
  WorkspaceMember,
} from "@/domain/types";
import { CHANGE_OPERATIONS, DOC_LANGUAGES, ORGANIZATION_ROLES, WORKSPACE_ROLES } from "@/domain/types";

export const DEV_DB_FORMAT = 1;

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
  change_event: [],
});

interface TableRules {
  key: readonly string[];
  /** column -> referenced table (always its `id`). Null values are allowed where the column is nullable. */
  foreignKeys: Readonly<Record<string, DevTable>>;
  /** Unique indexes besides the key; `live` = only rows with deleted_at null (partial index). */
  unique?: readonly { columns: readonly string[]; live?: boolean }[];
  checks?: readonly { name: string; test: (row: AnyRow) => boolean }[];
}

const audit = { created_by: "app_user", updated_by: "app_user" } as const;
const oneOf = (values: readonly string[], column: string) => (row: AnyRow) => values.includes(row[column] as string);

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
        const value = index.columns.map((c) => String(row[c])).join("|");
        if (seen.has(value)) return { kind: "unique", table, detail: `${index.columns.join(", ")} = ${value} exists already` };
        seen.add(value);
      }
    }
  }
  return null;
}
