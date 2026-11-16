// Loading rows built in memory into Postgres (slice 29, Q7): the seed loader's and the contract suite's one way in.
// Development and tests only; slice C's copy of a file will use it too.
//
// - One transaction, one statement per table (`json_populate_recordset`, portable SQL that converts the types), the
//   tables in the order of their foreign keys (from the store's schema; a table's references to itself are checked at
//   the end of its one statement, so its rows' order does not matter).
// - The stored order (data-model-v2.md, "Conventions", F2): each row's time column gets microseconds by its place among
//   the rows of its table that share its millisecond, so Postgres orders them as the file does; the domain reads
//   milliseconds only. A millisecond holds 1,000 places: rows after the 999th share the last one and fall back to their
//   key (`crowded` reports them).
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

/** The tables in an order where every table comes after the tables it refers to (references to itself left out). */
export function tablesInKeyOrder(schema: StoreSchema): string[] {
  const done = new Set<string>();
  const out: string[] = [];
  const visit = (table: string, path: readonly string[]) => {
    if (done.has(table)) return;
    if (path.includes(table)) throw new Error(`The foreign keys go round: ${[...path, table].join(" → ")}`);
    for (const target of Object.values(schema.rules[table]?.foreignKeys ?? {})) if (target !== table && schema.rules[target]) visit(target, [...path, table]);
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
    if (options.reset) {
      const all = await publicTables(db);
      if (all.length) await db.query(`truncate table ${all.map(ident).join(", ")}`);
    } else if (await hasRows(db)) {
      throw new Error("The database has rows already: nothing was loaded. Run with --reset to replace them.");
    }
    const crowded: Record<string, number> = {};
    for (const table of tablesInKeyOrder(schema)) {
      const given = data[table] ?? [];
      if (!given.length) continue;
      const stamped = stampPlaces(table, given);
      if (stamped.crowded) crowded[table] = stamped.crowded;
      await db.query(`insert into ${ident(table)} select * from json_populate_recordset(null::${ident(table)}, $1::json)`, [JSON.stringify(stamped.rows)]);
    }
    const counts: LoadReport["counts"] = [];
    for (const table of tablesInKeyOrder(schema)) {
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
