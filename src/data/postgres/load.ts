// Loading rows built in memory into Postgres (slice 29, Q7): the seed loader's and the contract suite's one way in.
// Development and tests only; since slice 31 also one organization's rows from a file (`replaceOrganization`: pg:kb).
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
import { readTable, timeColumnOf } from "./tables";

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
 * The rows inserted table by table in `order` (the foreign keys' order), each table's rows spread and stamped by their
 * places (the stored order); `app_user` rows that exist already (by id) are kept as they are when `keepPeople` (slice 31,
 * F2: a person's Supabase link stays). One statement per table. Answers the crowded rows per table.
 */
async function insertStamped(db: Queryable, order: readonly string[], data: Readonly<Record<string, readonly AnyRow[]>>, keepPeople = false, placed = false): Promise<Record<string, number>> {
  const crowded: Record<string, number> = {};
  for (const table of order) {
    const given = data[table] ?? [];
    if (!given.length) continue;
    let rows: readonly AnyRow[] = given;
    if (!placed) {
      const stamped = stampPlaces(table, spreadCrowded(table, given));
      if (stamped.crowded) crowded[table] = stamped.crowded;
      rows = stamped.rows;
    }
    const conflict = keepPeople && table === "app_user" ? " on conflict (id) do nothing" : "";
    await db.query(`insert into ${ident(table)} select * from json_populate_recordset(null::${ident(table)}, $1::json)${conflict}`, [JSON.stringify(rows)]);
  }
  return crowded;
}

/**
 * Every table's rows spread and stamped by their places in the whole file (slice 31, T3): one organization's rows taken
 * from it afterwards keep their places among every row of the file, so a copy of one organization into a database that
 * holds others sorts as the file does (stamping only the organization's rows would give two organizations' rows of one
 * millisecond the same places, and their key would order them). `replaceOrganization` takes such rows with `placed`.
 */
export function placeAll(data: Readonly<Record<string, unknown>>): { tables: Record<string, AnyRow[]>; crowded: Record<string, number> } {
  const tables: Record<string, AnyRow[]> = {};
  const crowded: Record<string, number> = {};
  for (const [table, rows] of Object.entries(data)) {
    if (!Array.isArray(rows)) continue;
    const stamped = stampPlaces(table, spreadCrowded(table, rows as AnyRow[]));
    if (stamped.crowded) crowded[table] = stamped.crowded;
    tables[table] = stamped.rows;
  }
  return { tables, crowded };
}

/** How a table's rows belong to one organization: by their workspace, by the organization, or not at all (people). */
function ownership(table: string, columns: ReadonlySet<string>): "workspace" | "organization" | "own" | "person" {
  if (table === "app_user") return "person";
  if (table === "organization") return "own";
  if (columns.has("workspace_id")) return "workspace";
  if (columns.has("organization_id")) return "organization";
  throw new Error(`The table ${table} belongs to no workspace and no organization: the copy does not know whose its rows are.`);
}

export interface OrganizationReport {
  /** Per table: the rows given and the organization's rows the database holds after the write (people: those given). */
  counts: { table: string; given: number; stored: number }[];
  /** People given who were in the database already and were kept as they are. */
  peopleKept: number;
  /** Per table: the organization's rows deleted before the insert (the undo history's table too). */
  removed: Record<string, number>;
  crowded: Record<string, number>;
}

/**
 * Replaces one organization's rows in the database (slice 31, C2.2): in one transaction, its organization and workspace
 * rows locked (`for update`, so a write of the app waits or is refused as busy), every row of its workspaces (the
 * undo histories too), its organization's rows and the organization itself deleted, soft-deleted rows included, then
 * `data`'s rows inserted in the foreign keys' order and stamped by their places (the stored order). People are never
 * deleted (F2): a person given who exists is kept as is, with their Supabase link. With `placed` the rows' time columns
 * carry their places already (`placeAll` over the whole file, T3); otherwise they are stamped here. `data: null` removes the
 * organization only (`--remove`). Refused before anything is written: a table the store does not know, a field no column
 * holds, a row of another organization, a person whose e-mail an online person with another id has (F1). Counts per
 * table, of this organization's rows only, are compared with the rows given before the commit.
 */
export async function replaceOrganization(
  db: Queryable,
  schema: StoreSchema,
  organizationId: string,
  data: Readonly<Record<string, readonly AnyRow[]>> | null,
  options: { placed?: boolean } = {},
): Promise<OrganizationReport> {
  const given = data ?? {};
  for (const table of Object.keys(given)) {
    if (table === "format") continue;
    if (!schema.rules[table]) throw new Error(`The store does not know the table ${table}: nothing was written.`);
  }
  await db.query("begin");
  try {
    await db.query("set local lock_timeout = '15s'");
    const columns = await databaseColumns(db);
    const rows = Object.fromEntries(Object.entries(given).filter(([t]) => t !== "format"));
    const stray = strayFields(rows, columns);
    if (stray.length) throw new Error(`Fields no column holds, nothing was written: ${stray.join(", ")}`);

    const fileWorkspaces = new Set((rows.workspace ?? []).map((w) => w.id as string));
    for (const w of rows.workspace ?? []) if (w.organization_id !== organizationId) throw new Error("A workspace given belongs to another organization: nothing was written.");
    for (const o of rows.organization ?? []) if (o.id !== organizationId) throw new Error("An organization given is another one: nothing was written.");
    for (const [table, list] of Object.entries(rows)) {
      const how = ownership(table, columns.get(table) ?? new Set());
      for (const r of list) {
        if (how === "workspace" && !fileWorkspaces.has(r.workspace_id as string)) throw new Error(`A row of ${table} belongs to a workspace not given: nothing was written.`);
        if (how === "organization" && r.organization_id !== organizationId) throw new Error(`A row of ${table} belongs to another organization: nothing was written.`);
      }
    }

    // F1: a person given whose e-mail an online person with another id has stops the copy
    const people = rows.app_user ?? [];
    if (people.length) {
      const clash = await db.query<{ n: string }>(
        `select count(*) as n from app_user u join json_to_recordset($1::json) as g(id uuid, email text) on lower(u.email) = lower(g.email) and u.id <> g.id`,
        [JSON.stringify(people.map((p) => ({ id: p.id, email: p.email })))],
      );
      const n = Number(clash.rows[0]!.n);
      if (n) throw new Error(`${n} ${n === 1 ? "person" : "people"} of the copy ${n === 1 ? "has" : "have"} the e-mail of an online person with another id: nothing was written.`);
    }

    await db.query("select id from organization where id = $1 for update", [organizationId]);
    await db.query("select id from workspace where organization_id = $1 for update", [organizationId]);
    const workspaces = [
      ...new Set([
        ...fileWorkspaces,
        ...(await db.query<{ id: string }>("select id from workspace where organization_id = $1", [organizationId])).rows.map((r) => r.id),
      ]),
    ];

    const order = tablesInKeyOrder(schema, await databaseReferences(db));
    const known = new Set(order);
    // tables only the database has (the undo history) go first, then the store's in the reverse of the keys' order
    const extra = [...columns.keys()].filter((t) => !known.has(t)).sort();
    const removed: Record<string, number> = {};
    for (const table of [...extra, ...[...order].reverse()]) {
      const how = ownership(table, columns.get(table) ?? new Set());
      if (how === "person") continue;
      const [where, param] = how === "workspace" ? ["workspace_id = any($1::uuid[])", workspaces] : how === "organization" ? ["organization_id = $1", organizationId] : ["id = $1", organizationId];
      const r = await db.query<{ n: string }>(`with d as (delete from ${ident(table)} where ${where} returning 1) select count(*) as n from d`, [param]);
      const n = Number(r.rows[0]!.n);
      if (n) removed[table] = n;
    }

    const existingPeople = people.length
      ? Number((await db.query<{ n: string }>("select count(*) as n from app_user where id = any($1::uuid[])", [people.map((p) => p.id)])).rows[0]!.n)
      : 0;
    const crowded = await insertStamped(db, order, rows, true, options.placed);

    const counts: OrganizationReport["counts"] = [];
    for (const table of order) {
      const how = ownership(table, columns.get(table) ?? new Set());
      const n = (sql: string, params: unknown[]) => db.query<{ n: string }>(sql, params).then((r) => Number(r.rows[0]!.n));
      const stored =
        how === "person"
          ? await n(`select count(*) as n from app_user where id = any($1::uuid[])`, [people.map((p) => p.id)])
          : how === "workspace"
            ? await n(`select count(*) as n from ${ident(table)} where workspace_id = any($1::uuid[])`, [workspaces])
            : how === "organization"
              ? await n(`select count(*) as n from ${ident(table)} where organization_id = $1`, [organizationId])
              : await n(`select count(*) as n from ${ident(table)} where id = $1`, [organizationId]);
      counts.push({ table, given: rows[table]?.length ?? 0, stored });
    }
    const wrong = counts.filter((c) => c.given !== c.stored);
    if (wrong.length) throw new Error(`Counts differ, nothing was written: ${wrong.map((c) => `${c.table} ${c.given} given, ${c.stored} stored`).join("; ")}`);
    await db.query("commit");
    return { counts, peopleKept: existingPeople, removed, crowded };
  } catch (e) {
    await db.query("rollback").catch(() => undefined);
    throw e;
  }
}

/**
 * One organization's rows as the store reads them (slice 31, C2.1: `pg:backup`), from one state of the data (a read-only
 * REPEATABLE READ transaction): its organization, its organization rows except `organization_access` (never in a
 * backup, as never in a copy), every row of its workspaces (soft-deleted rows included; the undo history, the store's own
 * table, left out) in the stored order, and the people its rows name without their Supabase link (`shaped`). Tables
 * without a row are left out. The local file's shape around it is the caller's.
 */
export async function readOrganization(db: Queryable, schema: StoreSchema, organizationId: string): Promise<Record<string, AnyRow[]>> {
  await db.query("begin transaction isolation level repeatable read read only");
  try {
    const columns = await databaseColumns(db);
    if (!(await db.query("select 1 from organization where id = $1", [organizationId])).rows.length) throw new Error("The database has no such organization: nothing was read.");
    const workspaces = (await db.query<{ id: string }>("select id from workspace where organization_id = $1", [organizationId])).rows.map((r) => r.id);
    const out: Record<string, AnyRow[]> = {};
    for (const table of Object.keys(schema.rules)) {
      if (table === "organization_access") continue;
      const how = ownership(table, columns.get(table) ?? new Set());
      if (how === "person") continue;
      const read =
        how === "workspace"
          ? { where: "workspace_id = any($1::uuid[])", params: [workspaces] }
          : how === "organization"
            ? { where: "organization_id = $1", params: [organizationId] }
            : { where: "id = $1", params: [organizationId] };
      const rows = await readTable(db, schema, table, read);
      if (rows.length) out[table] = rows;
    }
    const named = new Set<string>();
    for (const [table, rows] of Object.entries(out)) {
      const refs = Object.entries(schema.rules[table]?.foreignKeys ?? {}).filter(([, target]) => target === "app_user").map(([c]) => c);
      for (const r of rows) for (const c of refs) if (typeof r[c] === "string") named.add(r[c] as string);
    }
    if (named.size) out.app_user = await readTable(db, schema, "app_user", { where: "id = any($1::uuid[])", params: [[...named]] });
    await db.query("commit");
    return out;
  } catch (e) {
    await db.query("rollback").catch(() => undefined);
    throw e;
  }
}

/**
 * Loads `data` (table name → rows, in the file's order) into the database the client is connected to, in one
 * transaction. With `reset`, every public table is emptied first (unless `resetGuard` refuses); without it, a database
 * with rows is refused.
 */
export async function loadRows(
  db: Queryable,
  schema: StoreSchema,
  data: Readonly<Record<string, readonly AnyRow[]>>,
  options: { reset?: boolean; resetGuard?: (db: Queryable) => Promise<string | null> } = {},
): Promise<LoadReport> {
  for (const table of Object.keys(data)) {
    if (table === "format") continue;
    if (!schema.rules[table]) throw new Error(`The store does not know the table ${table}: nothing was loaded.`);
  }
  await db.query("begin");
  try {
    const stray = strayFields(Object.fromEntries(Object.entries(data).filter(([t]) => t !== "format")), await databaseColumns(db));
    if (stray.length) throw new Error(`Fields no column holds, nothing was loaded: ${stray.join(", ")}`);
    if (options.reset) {
      // slice 31 (Q8): a refusal inside the reset's transaction, before anything is emptied
      const refused = options.resetGuard ? await options.resetGuard(db) : null;
      if (refused) throw new Error(refused);
      const all = await publicTables(db);
      if (all.length) await db.query(`truncate table ${all.map(ident).join(", ")}`);
    } else if (await hasRows(db)) {
      throw new Error("The database has rows already: nothing was loaded. Run with --reset to replace them.");
    }
    const order = tablesInKeyOrder(schema, await databaseReferences(db));
    const crowded = await insertStamped(db, order, data);
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
