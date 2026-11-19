// Loading rows built in memory into Postgres (slice 29, Q7): the seed loader's and the contract suite's one way in.
// Development and tests only; slice C's copy of a file will use it too.
//
// - One transaction, one statement per table (`json_populate_recordset`, portable SQL that converts the types), the
//   tables in the order of their foreign keys (from the store's schema; a table's references to itself are checked at
//   the end of its one statement, so its rows' order does not matter).
// - The stored order (data-model-v2.md, "Conventions", F2): each row's time column gets microseconds by its place among
//   the rows of its table that share its millisecond, so Postgres orders them as the file does; the domain reads
//   milliseconds only. A millisecond holds 1,000 places: since slice 30 (L8) the loader moves a crowded millisecond's
//   rows past the 999th into the following milliseconds (`spreadCrowded`), so the seed's rows, whose ids are not in
//   their order, keep it too; their times move by a millisecond for each further 999 rows. Rows still past the 999th of
//   a millisecond after that fall back to their key (`crowded` reports them). `apply` never moves a time: a write's
//   rows carry the time its change images hold.
// - A row field its table has no column for is refused before anything is written (it would be dropped silently).
// - Counts per table are compared with the rows given before the commit; a difference rolls everything back.

import type { AnyRow, StoreSchema } from "../rows";
import type { Queryable } from "./pool";
import { timeColumnOf } from "./tables";

export interface LoadReport {
  /** Per table: the rows given and the rows the database holds after the load. */
  counts: { table: string; given: number; stored: number }[];
  /** Per table: rows that share the last microsecond of a crowded millisecond (more than 1,000 rows in it). */
  crowded: Record<string, number>;
}

/**
 * The tables in an order where every table comes after the tables it refers to (references to itself left out): the
 * store's foreign keys and, when given, the database's own (`databaseReferences`: SQL-only keys such as
 * `entity_stereotype_fk` on (workspace_id, stereotype), which the local adapter's rules do not have).
 */
export function tablesInKeyOrder(schema: StoreSchema, more: ReadonlyMap<string, ReadonlySet<string>> = new Map()): string[] {
  const done = new Set<string>();
  const out: string[] = [];
  const visit = (table: string, path: readonly string[]) => {
    if (done.has(table)) return;
    if (path.includes(table)) throw new Error(`The foreign keys go round: ${[...path, table].join(" → ")}`);
    const targets = new Set([...Object.values(schema.rules[table]?.foreignKeys ?? {}), ...(more.get(table) ?? [])]);
    for (const target of targets) if (target !== table && schema.rules[target]) visit(target, [...path, table]);
    done.add(table);
    out.push(table);
  };
  for (const table of Object.keys(schema.rules).sort()) visit(table, []);
  return out;
}

/**
 * A time column's text with the row's place in its millisecond as microseconds: "2026-11-16T10:00:00.123Z" and 45 give
 * "2026-11-16T10:00:00.123045Z".
 */
export function withPlace(iso: string, place: number): string {
  const m = /^(.*\.\d{3})Z$/.exec(iso);
  if (!m) throw new Error(`A time column holds ${iso}, not the domain's ISO text in milliseconds.`);
  return `${m[1]}${String(Math.min(place, 999)).padStart(3, "0")}Z`;
}

/**
 * The rows with a crowded millisecond's rows past the 999th moved into the following milliseconds, 999 each, in the rows'
 * order (slice 30, L8; the loader only), so no microsecond is shared (`stampPlaces` counts the last place, 999, as
 * crowded). A copy; the same array when nothing is crowded.
 */
const PER_MS = 999;
export function spreadCrowded(table: string, rows: readonly AnyRow[]): readonly AnyRow[] {
  const column = timeColumnOf(table);
  if (!column) return rows;
  const seen = new Map<string, number>();
  let out: AnyRow[] | null = null;
  rows.forEach((r, i) => {
    const at = r[column];
    if (typeof at !== "string") return;
    const place = seen.get(at) ?? 0;
    seen.set(at, place + 1);
    if (place < PER_MS) return;
    out ??= [...rows];
    out[i] = { ...r, [column]: new Date(Date.parse(at) + Math.floor(place / PER_MS)).toISOString() };
  });
  return out ?? rows;
}

/** The rows with their places stamped into their time column (a copy; the rows given are not changed). */
export function stampPlaces(table: string, rows: readonly AnyRow[]): { rows: AnyRow[]; crowded: number } {
  const column = timeColumnOf(table);
  if (!column) return { rows: [...rows], crowded: 0 };
  const seen = new Map<string, number>();
  let crowded = 0;
  const out = rows.map((r) => {
    const at = r[column];
    if (typeof at !== "string") return r;
    const place = seen.get(at) ?? 0;
    seen.set(at, place + 1);
    if (place >= 999) crowded++;
    return { ...r, [column]: withPlace(at, place) };
  });
  return { rows: out, crowded: crowded > 0 ? crowded : 0 };
}

const ident = (name: string): string => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Not a table name: ${name}`);
  return `"${name}"`;
};

/** Every table of the public schema (the store's and those not in the domain yet), for a reset. */
async function publicTables(db: Queryable): Promise<string[]> {
  return (await db.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public' order by tablename")).rows.map((r) => r.tablename);
}

/** Every foreign key of the public schema, as table → the tables it refers to. */
export async function databaseReferences(db: Queryable): Promise<Map<string, Set<string>>> {
  const { rows } = await db.query<{ source: string; target: string }>(
    `select s.relname as source, t.relname as target from pg_constraint c
       join pg_class s on s.oid = c.conrelid join pg_class t on t.oid = c.confrelid
       join pg_namespace n on n.oid = s.relnamespace
      where c.contype = 'f' and n.nspname = 'public'`,
  );
  const out = new Map<string, Set<string>>();
  for (const r of rows) (out.get(r.source) ?? out.set(r.source, new Set()).get(r.source)!).add(r.target);
  return out;
}

/** Every column of the public schema's tables, by table. */
async function databaseColumns(db: Queryable): Promise<Map<string, Set<string>>> {
  const { rows } = await db.query<{ table_name: string; column_name: string }>(
    "select table_name, column_name from information_schema.columns where table_schema = 'public'",
  );
  const out = new Map<string, Set<string>>();
  for (const r of rows) (out.get(r.table_name) ?? out.set(r.table_name, new Set()).get(r.table_name)!).add(r.column_name);
  return out;
}

/**
 * The fields of the rows given that their table has no column for (`json_populate_recordset` would drop them without a
 * word): "table.field" each, never a value.
 */
export function strayFields(data: Readonly<Record<string, readonly AnyRow[]>>, columns: ReadonlyMap<string, ReadonlySet<string>>): string[] {
  const out = new Set<string>();
  for (const [table, rows] of Object.entries(data)) {
    const known = columns.get(table);
    if (!known) continue;
    for (const r of rows) for (const k of Object.keys(r)) if (!known.has(k)) out.add(`${table}.${k}`);
  }
  return [...out].sort();
}

/** Rows in any of the public tables. */
export async function hasRows(db: Queryable): Promise<boolean> {
  for (const t of await publicTables(db)) {
    if ((await db.query(`select 1 from ${ident(t)} limit 1`)).rows.length) return true;
  }
  return false;
}

/**
 * Loads `data` (table name → rows, in the file's order) into the database the client is connected to, in one
 * transaction. With `reset`, every public table is emptied first; without it, a database with rows is refused.
 */
export async function loadRows(db: Queryable, schema: StoreSchema, data: Readonly<Record<string, readonly AnyRow[]>>, options: { reset?: boolean } = {}): Promise<LoadReport> {
  for (const table of Object.keys(data)) {
    if (table === "format") continue;
    if (!schema.rules[table]) throw new Error(`The store does not know the table ${table}: nothing was loaded.`);
  }
  await db.query("begin");
  try {
    const stray = strayFields(Object.fromEntries(Object.entries(data).filter(([t]) => t !== "format")), await databaseColumns(db));
    if (stray.length) throw new Error(`Fields no column holds, nothing was loaded: ${stray.join(", ")}`);
    if (options.reset) {
      const all = await publicTables(db);
      if (all.length) await db.query(`truncate table ${all.map(ident).join(", ")}`);
    } else if (await hasRows(db)) {
      throw new Error("The database has rows already: nothing was loaded. Run with --reset to replace them.");
    }
    const crowded: Record<string, number> = {};
    const order = tablesInKeyOrder(schema, await databaseReferences(db));
    for (const table of order) {
      const given = data[table] ?? [];
      if (!given.length) continue;
      const stamped = stampPlaces(table, spreadCrowded(table, given));
      if (stamped.crowded) crowded[table] = stamped.crowded;
      await db.query(`insert into ${ident(table)} select * from json_populate_recordset(null::${ident(table)}, $1::json)`, [JSON.stringify(stamped.rows)]);
    }
    const counts: LoadReport["counts"] = [];
    for (const table of order) {
      const stored = Number((await db.query<{ n: string }>(`select count(*) as n from ${ident(table)}`)).rows[0]!.n);
      counts.push({ table, given: data[table]?.length ?? 0, stored });
    }
    const wrong = counts.filter((c) => c.given !== c.stored);
    if (wrong.length) throw new Error(`Counts differ, nothing was loaded: ${wrong.map((c) => `${c.table} ${c.given} given, ${c.stored} stored`).join("; ")}`);
    await db.query("commit");
    return { counts, crowded };
  } catch (e) {
    await db.query("rollback").catch(() => undefined);
    throw e;
  }
}
