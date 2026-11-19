// The Postgres adapter's writes (slice 30, Q1, AD-38 as proposed): one transaction per write set, with the local
// adapter's rules and refusals. Server only.
//
// In this order, on one connection, at READ COMMITTED:
// 1. the locks (B4): the organization's row first when the write can break a count across its workspaces
//    (`needsOrganizationLock`) or makes a workspace, then the workspace's row, both `for no key update` (it serialises the writes and leaves foreign key checks free), so every write in a
//    workspace waits for the one before it; `lock_timeout` bounds the wait (L7), refused as busy;
// 2. the access the command was checked with, read again (B3, L1: `accessChangedRefusal`), before the rows;
// 3. the rows in three phases (F8: Postgres checks foreign keys after each statement and unique indexes on each row, the
//    local adapter after the whole write set): removes and soft deletes, then inserts with the tables in their keys'
//    order, then the other updates; one statement per table and phase, the rows as JSON (`json_populate_recordset`);
//    a versioned row is updated only from the version the command read, a link row only from the whole row it read (F10);
//    an update never sets a row's time column, which carries its place in the stored order (F9); an insert's time
//    column gets its place in the write set as microseconds (AD-12's note);
// 4. the change events, stamped the same way, and the person's undo history as the write changes it (`undo_step`);
// 5. the count rules on the state after the rows (F5, F6: `countRefusal`), with the rows each check reads;
// 6. commit, or roll back with the first refusal.

import type { Pool, PoolClient } from "pg";
import type { Write, WriteSet } from "@/domain/changes";
import { accessChangedRefusal, type AccessNow, type CheckedAccess } from "@/domain/commands/access-check";
import { countChecks, countRefusal, crossesWorkspaces, needsOrganizationLock, type CountCheck, type CountRows } from "@/domain/commands/count-rules";
import { domainError, notFound, staleVersion, type DomainError } from "@/domain/errors";
import type { Uuid } from "@/domain/ids";
import type { ApplyOptions, ApplyResult } from "../ports";
import type { AnyRow, StoreSchema } from "../rows";
import { stampPlaces, tablesInKeyOrder } from "./load";
import { timeColumnOf } from "./tables";
import { changeHistory } from "./undo-history";

/** How long a write waits for its workspace's lock (L7: provisional until S30-05's figures). */
export const LOCK_TIMEOUT = "10s";
export const BUSY_MESSAGE = "The workspace is busy saving a large change. Try again in a moment.";

const ident = (name: string): string => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Not a table or column name: ${name}`);
  return `"${name}"`;
};

/** A refusal raised inside the transaction: rolled back and answered as the write's refusal. */
class Refused extends Error {
  constructor(readonly error: DomainError) {
    super(error.message);
  }
}

/** The public tables' columns and their types, read once per pool. */
type Columns = ReadonlyMap<string, ReadonlyMap<string, string>>;
const columnsOf = new WeakMap<Pool, Promise<Columns>>();
function tableColumns(pool: Pool, client: PoolClient): Promise<Columns> {
  let known = columnsOf.get(pool);
  if (!known) {
    known = client
      .query<{ table_name: string; column_name: string; data_type: string }>(
        "select table_name, column_name, data_type from information_schema.columns where table_schema = 'public'",
      )
      .then(({ rows }) => {
        const out = new Map<string, Map<string, string>>();
        for (const r of rows) (out.get(r.table_name) ?? out.set(r.table_name, new Map()).get(r.table_name)!).set(r.column_name, r.data_type);
        return out;
      });
    known.catch(() => columnsOf.delete(pool));
    columnsOf.set(pool, known);
  }
  return known;
}

/** The order of tables for inserts, from the store's keys and the database's own (once per pool). */
const keyOrders = new WeakMap<Pool, Promise<string[]>>();
function insertOrder(pool: Pool, client: PoolClient, schema: StoreSchema): Promise<string[]> {
  let order = keyOrders.get(pool);
  if (!order) {
    order = client
      .query<{ source: string; target: string }>(
        `select s.relname as source, t.relname as target from pg_constraint c
           join pg_class s on s.oid = c.conrelid join pg_class t on t.oid = c.confrelid
           join pg_namespace n on n.oid = s.relnamespace
          where c.contype = 'f' and n.nspname = 'public'`,
      )
      .then(({ rows }) => {
        const more = new Map<string, Set<string>>();
        for (const r of rows) (more.get(r.source) ?? more.set(r.source, new Set()).get(r.source)!).add(r.target);
        return tablesInKeyOrder(schema, more);
      });
    order.catch(() => keyOrders.delete(pool));
    keyOrders.set(pool, order);
  }
  return order;
}

type Phase = "delete" | "insert" | "update";
const phaseOf = (w: Write): Phase => {
  if (w.kind === "remove") return "delete";
  if (w.kind === "insert") return "insert";
  const before = w.before as unknown as AnyRow;
  const row = w.row as unknown as AnyRow;
  return "deleted_at" in before && before.deleted_at === null && row.deleted_at !== null ? "delete" : "update";
};

/** Applies a write set in one transaction (see the file's head). */
export async function applyWriteSet(pool: Pool, schema: StoreSchema, writeSet: WriteSet, options: ApplyOptions = {}): Promise<ApplyResult> {
  const unknown = writeSet.writes.find((w) => !schema.rules[w.table]);
  if (unknown) return { ok: false, error: domainError("invalid", `The store does not know the table ${unknown.table}.`) };
  const client = await pool.connect();
  try {
    await client.query("begin");
    try {
      const columns = await tableColumns(pool, client);
      const order = await insertOrder(pool, client, schema);
      await client.query(`set local lock_timeout = '${LOCK_TIMEOUT}'`);
      const workspaceId = writeSet.events[0]?.workspace_id;
      await lock(client, writeSet, workspaceId);
      if (options.access) {
        const changed = accessChangedRefusal(options.access, await accessNow(client, options.access));
        if (changed) throw new Refused(changed);
      }
      for (const phase of ["delete", "insert", "update"] as const) {
        const writes = writeSet.writes.filter((w) => phaseOf(w) === phase);
        const tables = phase === "insert" ? order.filter((t) => writes.some((w) => w.table === t)) : [...new Set(writes.map((w) => w.table))];
        for (const table of tables) await writeTable(client, schema, columns, table, phase, writes.filter((w) => w.table === table));
      }
      if (writeSet.events.length) await insertRows(client, columns, "change_event", stampPlaces("change_event", writeSet.events as unknown as AnyRow[]).rows);
      // F4: the person's undo history with its write (`undo_step`)
      if (options.history) await changeHistory(client, writeSet, options.history);
      const checks = countChecks(writeSet.writes);
      if (checks.length) {
        const refusal = countRefusal(await countRows(client, checks), checks);
        if (refusal) throw new Refused(refusal);
      }
      await client.query("commit");
      return { ok: true };
    } catch (e) {
      await client.query("rollback").catch(() => undefined);
      if (e instanceof Refused) return { ok: false, error: e.error };
      const mapped = refusalOfDatabase(e);
      if (mapped) return { ok: false, error: mapped };
      throw e;
    }
  } finally {
    client.release();
  }
}

/** B4's locks: the organization's row, then the workspace's, always in that order. */
async function lock(client: PoolClient, writeSet: WriteSet, workspaceId: Uuid | undefined): Promise<void> {
  const made = writeSet.writes.find((w) => w.kind === "insert" && w.table === "workspace");
  let organizationId: Uuid | null = made ? ((made.row as unknown as AnyRow).organization_id as Uuid) : null;
  if (!organizationId && workspaceId && needsOrganizationLock(writeSet.writes)) {
    organizationId = (await client.query<{ organization_id: Uuid }>("select organization_id from workspace where id = $1", [workspaceId])).rows[0]?.organization_id ?? null;
  }
  if (organizationId) await client.query("select id from organization where id = $1 for no key update", [organizationId]);
  if (workspaceId && !made) await client.query("select id from workspace where id = $1 for no key update", [workspaceId]);
}

/** The actor's access as the database holds it now, for the parts the command read. */
async function accessNow(client: PoolClient, checked: CheckedAccess): Promise<AccessNow> {
  const now: AccessNow = {};
  if (checked.workspace) {
    const { rows } = await client.query<{ archived: boolean; role: string | null }>(
      `select w.archived_at is not null as archived, m.role from workspace w
         left join workspace_member m on m.workspace_id = w.id and m.user_id = $2
        where w.id = $1 and w.deleted_at is null`,
      [checked.workspace.id, checked.userId],
    );
    now.workspace = rows[0] ?? null;
  }
  if (checked.organization) {
    const { rows } = await client.query<{ role: string }>("select role from organization_member where organization_id = $1 and user_id = $2", [
      checked.organization.id,
      checked.userId,
    ]);
    now.organization = { role: rows[0]?.role ?? null };
  }
  return now;
}

/** Rows a statement takes at once: a write set's rows of one table with distinct keys (a key written twice goes in a later round). */
function rounds(schema: StoreSchema, table: string, writes: readonly Write[]): Write[][] {
  const key = schema.rules[table]!.key;
  const out: { keys: Set<string>; writes: Write[] }[] = [];
  for (const w of writes) {
    const row = (w.kind === "insert" ? w.row : w.before) as unknown as AnyRow;
    const k = key.map((c) => String(row[c])).join("|");
    const round = out.find((r) => !r.keys.has(k)) ?? out[out.push({ keys: new Set(), writes: [] }) - 1]!;
    round.keys.add(k);
    round.writes.push(w);
  }
  return out.map((r) => r.writes);
}

async function writeTable(client: PoolClient, schema: StoreSchema, columns: Columns, table: string, phase: Phase, writes: readonly Write[]): Promise<void> {
  for (const round of rounds(schema, table, writes)) {
    if (phase === "insert") {
      await insertRows(client, columns, table, stampPlaces(table, round.map((w) => (w as { row: unknown }).row as AnyRow)).rows);
      continue;
    }
    // the delete phase holds a link table's removes and a table's soft deletes (updates)
    const removes = round.filter((w) => w.kind === "remove");
    const updates = round.filter((w) => w.kind === "update");
    if (removes.length) await removeRows(client, schema, columns, table, removes.map((w) => w.before as unknown as AnyRow));
    if (updates.length) await updateRows(client, schema, columns, table, updates);
  }
}

/** The table's columns, refusing a field it has no column for (it would be dropped without a word). */
function knownColumns(columns: Columns, table: string, rows: readonly AnyRow[]): string[] {
  const known = columns.get(table);
  if (!known) throw new Error(`The database has no table ${table}.`);
  const fields = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) fields.add(k);
  const stray = [...fields].filter((f) => !known.has(f));
  if (stray.length) throw new Error(`Fields no column holds, nothing was written: ${stray.map((f) => `${table}.${f}`).join(", ")}`);
  return [...fields];
}

async function insertRows(client: PoolClient, columns: Columns, table: string, rows: readonly AnyRow[]): Promise<void> {
  if (!rows.length) return;
  const cols = knownColumns(columns, table, rows).map(ident).join(", ");
  await client.query(`insert into ${ident(table)} (${cols}) select ${cols} from json_populate_recordset(null::${ident(table)}, $1::json)`, [JSON.stringify(rows)]);
}

/** `t.c is not distinct from b.c`, with times compared in the domain's milliseconds (the stored microseconds are the order's). */
const sameAs = (columns: ReadonlyMap<string, string>, c: string, t: string, b: string): string =>
  columns.get(c) === "timestamp with time zone"
    ? `date_trunc('milliseconds', ${t}.${ident(c)}) is not distinct from date_trunc('milliseconds', ${b}.${ident(c)})`
    : `${t}.${ident(c)} is not distinct from ${b}.${ident(c)}`;

async function removeRows(client: PoolClient, schema: StoreSchema, columns: Columns, table: string, befores: readonly AnyRow[]): Promise<void> {
  const key = schema.rules[table]!.key;
  knownColumns(columns, table, befores);
  const on = key.map((c) => `t.${ident(c)} = b.${ident(c)}`).join(" and ");
  const { rows } = await client.query(`delete from ${ident(table)} t using json_populate_recordset(null::${ident(table)}, $1::json) b where ${on} returning 1`, [
    JSON.stringify(befores),
  ]);
  // as the local adapter: a link row to remove that is gone is not found
  if (rows.length !== befores.length) throw new Refused(notFound("record"));
}

async function updateRows(client: PoolClient, schema: StoreSchema, columns: Columns, table: string, writes: readonly Write[]): Promise<void> {
  const key = schema.rules[table]!.key;
  const known = columns.get(table)!;
  const rows = writes.map((w) => (w as { row: unknown }).row as AnyRow);
  const befores = writes.map((w) => (w as { before: unknown }).before as AnyRow);
  for (const [i, row] of rows.entries()) {
    if (key.some((c) => String(row[c]) !== String(befores[i]![c]))) throw new Refused(domainError("invalid", "The key of a row cannot change."));
    if ("version" in befores[i]! && row.version !== (befores[i]!.version as number) + 1) throw new Refused(domainError("invalid", "The new version must be the read version + 1."));
  }
  const cols = knownColumns(columns, table, rows);
  const time = timeColumnOf(table);
  // F9: the time column is never set again (its microseconds are the row's place); the key never changes
  const set = cols.filter((c) => !key.includes(c) && c !== time).map((c) => `${ident(c)} = v.${ident(c)}`);
  const versioned = "version" in befores[0]!;
  const on = key.map((c) => `t.${ident(c)} = v.${ident(c)}`).join(" and ");
  const beforeOn = key.map((c) => `b.${ident(c)} = v.${ident(c)}`).join(" and ");
  // a versioned row only from the version the command read; a link row only from the whole row it read (F10)
  const guard = versioned
    ? "t.version = v.version - 1"
    : knownColumns(columns, table, befores)
        .map((c) => sameAs(known, c, "t", "b"))
        .join(" and ");
  const sql = `update ${ident(table)} t set ${set.length ? set.join(", ") : `${ident(key[0]!)} = t.${ident(key[0]!)}`}
    from json_populate_recordset(null::${ident(table)}, $1::json) v${versioned ? "" : `, json_populate_recordset(null::${ident(table)}, $2::json) b`}
    where ${on} and ${versioned ? guard : `${beforeOn} and ${guard}`} returning 1`;
  const { rows: done } = await client.query(sql, versioned ? [JSON.stringify(rows)] : [JSON.stringify(rows), JSON.stringify(befores)]);
  if (done.length === rows.length) return;
  // fewer rows than sent: one that is gone is not found, else one changed meanwhile is stale (the local adapter's codes)
  const keys = JSON.stringify(rows.map((r) => Object.fromEntries(key.map((c) => [c, r[c]]))));
  const { rows: there } = await client.query<{ n: number }>(
    `select count(*)::int as n from ${ident(table)} t, json_populate_recordset(null::${ident(table)}, $1::json) v where ${on}`,
    [keys],
  );
  throw new Refused(there[0]!.n < rows.length ? notFound("record") : staleVersion());
}

/** The rows the count checks read, as they stand after the write's rows (its own included). */
async function countRows(client: PoolClient, checks: readonly CountCheck[]): Promise<CountRows> {
  const out: { [K in keyof CountRows]: AnyRow[] } = {
    workspace: [],
    workspace_member: [],
    project: [],
    entity: [],
    canvas: [],
    project_canvas: [],
    organization: [],
    organization_member: [],
    app_user: [],
  };
  const q = async (sql: string, params: unknown[]) => (await client.query(sql, params)).rows as AnyRow[];
  const workspaces = [...new Set(checks.map((c) => c.workspaceId))];
  out.workspace = await q(
    `select id, name, organization_id, infocube, deleted_at from workspace
      where id = any($1::uuid[]) or organization_id in (select organization_id from workspace where id = any($2::uuid[]))`,
    [workspaces, checks.filter(crossesWorkspaces).map((c) => c.workspaceId)],
  );
  const kinds = new Set(checks.map((c) => c.kind));
  const people = [...new Set(checks.filter(crossesWorkspaces).map((c) => (c as { userId: Uuid }).userId))];
  if (kinds.has("last_owner") || people.length) {
    out.workspace_member = await q("select workspace_id, user_id, role from workspace_member where workspace_id = any($1::uuid[]) or user_id = any($2::uuid[])", [workspaces, people]);
  }
  if (kinds.has("last_project") || kinds.has("canvas_links")) {
    out.project = await q("select id, workspace_id, deleted_at from project where workspace_id = any($1::uuid[]) and deleted_at is null", [workspaces]);
  }
  if (kinds.has("infocube_off")) {
    out.entity = await q("select workspace_id, deleted_at, model_level from entity where workspace_id = any($1::uuid[]) and deleted_at is null and model_level = 'dimensional'", [workspaces]);
  }
  if (kinds.has("canvas_links")) {
    out.canvas = await q("select id, deleted_at from canvas where workspace_id = any($1::uuid[]) and deleted_at is null", [workspaces]);
    out.project_canvas = await q("select project_id, canvas_id from project_canvas where workspace_id = any($1::uuid[])", [workspaces]);
  }
  if (people.length) {
    const organizations = [...new Set(out.workspace.map((w) => w.organization_id as Uuid))];
    out.organization = await q("select id, name from organization where id = any($1::uuid[])", [organizations]);
    out.organization_member = await q("select organization_id, user_id, role from organization_member where user_id = any($1::uuid[])", [people]);
    out.app_user = await q("select id, display_name from app_user where id = any($1::uuid[])", [people]);
  }
  return out as unknown as CountRows;
}

/** A database's refusal as the local adapter's (`violationError`, `src/data/local/store.ts`); null for anything else. */
function refusalOfDatabase(e: unknown): DomainError | null {
  const err = e as { code?: string; table?: string; constraint?: string };
  const where = `${err.table ?? "?"}: ${err.constraint ?? "?"}`;
  switch (err.code) {
    case "23505":
      return err.constraint?.endsWith("_pkey") ? domainError("conflict", "This already exists.") : domainError("conflict", `This already exists (${where}).`);
    case "23503":
      return domainError("not_found", `This refers to something that does not exist (${where}).`);
    case "23514":
    case "23502":
      return domainError("invalid", `A data rule was broken (${err.constraint ?? err.table ?? "?"}).`);
    case "55P03":
      // L7: the workspace's lock was not free within LOCK_TIMEOUT. `invalid`: the draft stays editable, nothing is cut
      return domainError("invalid", BUSY_MESSAGE);
    default:
      return null;
  }
}
