// The Postgres adapter's connection pool (slice 29, Q2): one per server instance, kept on globalThis as the local store
// keeps its undo map, so a module reload in development opens no second pool.
// - The app connects through Supabase's transaction pooler (port 6543): no named statements anywhere (node-postgres
//   prepares only a query with a `name`), no session state outside a transaction.
// - At most 5 connections and 5 s idle (Vercel's advice for Fluid compute); on Vercel `attachDatabasePool` releases idle
//   clients before an instance suspends.
// Server only. The connection string is never logged.

import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { pgClientConfig } from "./config";

export const DATABASE_URL_ENV = "INFOMAPPER_DATABASE_URL";

const holder = globalThis as { __infomapperPgPool?: Pool };

/** The instance's pool, made on first use from `INFOMAPPER_DATABASE_URL`. */
export function getPool(): Pool {
  if (holder.__infomapperPgPool) return holder.__infomapperPgPool;
  const url = process.env[DATABASE_URL_ENV];
  if (!url) throw new Error(`${DATABASE_URL_ENV} is not set: the Postgres adapter has no database.`);
  const pool = new Pool({ ...pgClientConfig(url), max: 5, idleTimeoutMillis: 5_000 });
  // an idle client's error (the pooler closed it) must not end the process; the next query takes a new connection
  pool.on("error", () => undefined);
  if (process.env.VERCEL) {
    void import("@vercel/functions").then(({ attachDatabasePool }) => attachDatabasePool(pool));
  }
  holder.__infomapperPgPool = pool;
  return pool;
}

/** Something to run queries on: the pool, or one transaction's client. */
export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: R[] }>;
}

/**
 * Runs `work` in one read-only transaction at REPEATABLE READ on one connection (slice 29, F3): every statement sees
 * the same state of the data. Statements on one client run one after another.
 */
export async function readTransaction<T>(pool: Pool, work: (client: Queryable) => Promise<T>): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("begin transaction isolation level repeatable read read only");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
