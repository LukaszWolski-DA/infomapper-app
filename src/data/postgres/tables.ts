// How the Postgres adapter reads a table (slice 29, Q1, F2): its rows of one workspace (or the tenancy tables' own
// filters) in the stored order, with a module's defaults and row upgrades (`src/data/rows.ts`).
//
// The stored order (data-model-v2.md, "Conventions"): the row's time column, whose microseconds carry its place in the
// file (the seed loader, slice C's copy) or in its write set (slice B), then its key. Table names are never taken from
// input: only the store's schema names them, and each is checked against it before it goes into a statement.

import type { Uuid } from "@/domain/ids";
import { readRows, upgradeRows, type AnyRow, type StoreSchema } from "../rows";
import type { Queryable } from "./pool";

/** A table's time column where it is not `created_at`; `null`: none (ordered by its key only). */
const TIME_COLUMNS: Readonly<Record<string, string | null>> = {
  project_canvas: "added_at",
  change_event: "occurred_at",
  organization_access: "changed_at",
  project_pinned_label: null,
};

/** The time column that carries a table's stored order. */
export const timeColumnOf = (table: string): string | null => (table in TIME_COLUMNS ? TIME_COLUMNS[table]! : "created_at");

/** A table or column name from the schema, quoted. */
const ident = (name: string): string => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Not a table or column name: ${name}`);
  return `"${name}"`;
};

/** `order by` for a table's stored order: its time column, then its key's columns. */
export function storedOrderSql(schema: StoreSchema, table: string): string {
  const rules = schema.rules[table];
  if (!rules) throw new Error(`The store does not know the table ${table}.`);
  const time = timeColumnOf(table);
  return `order by ${[...(time ? [time] : []), ...rules.key].map(ident).join(", ")}`;
}

export interface TableRead {
  /** The rows' filter, written with `$1`, `$2`…; none: every row (only the tenancy tables). */
  where?: string;
  params?: readonly unknown[];
}

/**
 * The table's rows in the stored order, as a command reads them: a module's defaults for columns a row lacks and its
 * row upgrade (one rule with the local adapter).
 */
export async function readTable(db: Queryable, schema: StoreSchema, table: string, read: TableRead = {}): Promise<AnyRow[]> {
  if (!schema.rules[table]) throw new Error(`The store does not know the table ${table}.`);
  const sql = `select * from ${ident(table)}${read.where ? ` where ${read.where}` : ""} ${storedOrderSql(schema, table)}`;
  const { rows } = await db.query(sql, read.params ? [...read.params] : []);
  return shaped(schema, table, rows);
}

/** A table's rows of one workspace, deleted ones included unless `live`. */
export const workspaceRows = (db: Queryable, schema: StoreSchema, table: string, workspaceId: Uuid, live = false): Promise<AnyRow[]> =>
  readTable(db, schema, table, { where: live ? "workspace_id = $1 and deleted_at is null" : "workspace_id = $1", params: [workspaceId] });

/** Rows as the store hands them on: defaults, then upgrades (the order `upgradeRows` and `readRows` run in locally). */
export function shaped(schema: StoreSchema, table: string, rows: AnyRow[]): AnyRow[] {
  const holder = upgradeRows({ [table]: rows }, schema);
  return readRows(holder, table, schema);
}
