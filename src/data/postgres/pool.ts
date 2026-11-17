// The Postgres adapter's connection pool (slice 29, Q2): one per server instance, kept on globalThis as the local store
// keeps its undo map, so a module reload in development opens no second pool.
// - The app connects through Supabase's transaction pooler (port 6543): no named statements anywhere (node-postgres
//   prepares only a query with a `name`), no session state outside a transaction.
// - At most 5 connections and 5 s idle (Vercel's advice for Fluid compute); on Vercel `attachDatabasePool` releases idle
//   clients before an instance suspends.
// Server only. The connection string is never logged.

import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { countStatement, countWait, isTimingOn } from "../timing";
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
  if (isTimingOn()) timePool(pool);
  holder.__infomapperPgPool = pool;
  return pool;
}

/**
 * With the timing record on (slice 29, step 4): every statement's time and every wait for a connection go into the
 * current request's record (`../timing.ts`). Statements on a transaction's client count too (begin and commit included:
 * they are round trips).
 */
function timePool(pool: Pool): void {
  const timedQuery = <T extends { query: (...args: never[]) => unknown }>(target: T) => {
    const query = target.query.bind(target) as (...args: unknown[]) => Promise<unknown>;
    (target as unknown as { query: unknown }).query = async (...args: unknown[]) => {
      const start = performance.now();
      try {
        return await query(...args);
      } finally {
        countStatement(performance.now() - start);
      }
    };
  };
  // Only clients are timed: node-postgres's own `pool.query` takes a client through `this.connect(callback)` and runs the
  // statement on it, so timing the pool too would count every statement twice. Both forms of `connect` are kept: a
  // promise (`readTransaction`) and a callback (`pool.query`).
  type Done = (release?: unknown) => void;
  type Callback = (err: Error | undefined, client?: PoolClient, done?: Done) => void;
  const connect = pool.connect.bind(pool) as (cb?: Callback) => Promise<PoolClient> | void;
  const timeClient = (client: PoolClient) => {
    if ((client as { __timed?: boolean }).__timed) return;
    timedQuery(client);
    (client as { __timed?: boolean }).__timed = true;
  };
  (pool as unknown as { connect: unknown }).connect = (cb?: Callback) => {
    const start = performance.now();
    if (typeof cb === "function") {
      return connect((err, client, done) => {
        countWait(performance.now() - start);
        if (client) timeClient(client);
        cb(err, client, done);
      });
    }
    return (connect() as Promise<PoolClient>).then((client) => {
      countWait(performance.now() - start);
      timeClient(client);
      return client;
    });
  };
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
