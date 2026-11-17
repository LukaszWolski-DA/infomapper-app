// How the Postgres adapter connects (slice 29, Q2, F6). Server only.
// - TLS with full verification: the connection string's own `sslmode` is dropped (node-postgres would read it as its
//   own TLS settings) and `ssl` verifies the server's certificate against Supabase's root certificate
//   (`supabase-ca.crt` beside this file: "Supabase Root 2021 CA", public, from the project's dashboard, valid to 2031).
// - `timestamptz` is read as the domain's text (ISO, milliseconds, `Z`): the microseconds that carry a row's place in the
//   stored order (data-model-v2.md, "The stored order") never reach the domain. `numeric` and `bigint` are read as
//   numbers, as the local file holds them.

import fs from "node:fs";
import path from "node:path";
import type { ClientConfig } from "pg";
import pg from "pg";

const TIMESTAMPTZ = 1184;
const NUMERIC = 1700;
const INT8 = 20;

/** A `timestamptz` as Postgres prints it, as the domain's ISO text in milliseconds (truncated, never rounded). */
export function timestampText(value: string): string {
  // "2026-11-16 10:00:00.123456+00" (the session's time zone is UTC on Supabase; the offset is honoured either way)
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?([+-]\d{2}(?::?\d{2})?(?::?\d{2})?|Z)?$/.exec(value);
  if (!m) throw new Error(`Unexpected timestamptz text: ${value}`);
  const [, date, time, fraction = "", zone = "Z"] = m;
  const ms = (fraction + "000").slice(0, 3);
  const offset = zone === "Z" ? "Z" : zone.length === 3 ? `${zone}:00` : zone.includes(":") ? zone : `${zone.slice(0, 3)}:${zone.slice(3, 5)}`;
  return new Date(`${date}T${time}.${ms}${offset}`).toISOString();
}

/** The type parsers of the adapter's connections (their own, never node-postgres's global ones). */
export const pgTypes = {
  getTypeParser(oid: number, format?: "text" | "binary") {
    if (oid === TIMESTAMPTZ) return timestampText;
    if (oid === NUMERIC || oid === INT8) return (v: string) => Number(v);
    return pg.types.getTypeParser(oid, format as "text");
  },
};

/** The client settings for a connection string: its TLS settings replaced by full verification. */
export function pgClientConfig(url: string): ClientConfig {
  const u = new URL(url);
  for (const p of ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) u.searchParams.delete(p);
  return {
    connectionString: u.toString(),
    ssl: isLocalHost(u.hostname) ? false : { rejectUnauthorized: true, ca: supabaseCa() },
    types: pgTypes as ClientConfig["types"],
  };
}

/** Supabase's root certificate, read once (the build traces the file, slice 29 step 4). */
let ca: string | null = null;
const supabaseCa = (): string => (ca ??= fs.readFileSync(path.join(process.cwd(), "src/data/postgres/supabase-ca.crt"), "utf8"));

/** A database on this machine (CI's container, a local Postgres): no TLS. */
const isLocalHost = (host: string): boolean => host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
