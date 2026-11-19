// Environment 2's values for the Postgres scripts (slice 29, L4): `.env.postgres.local`, git-ignored, read only by
// `npm run dev:pg` and these scripts. Environment 1 (`npm run dev`) never loads it. No value is ever printed: a target is
// named by `targetName` (host and database only).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const PG_ENV_FILE = ".env.postgres.local";

/** Refuses unless git ignores the file (L4: confirmed before anything reads it). */
export function assertIgnored(file: string = PG_ENV_FILE): void {
  try {
    execFileSync("git", ["check-ignore", "-q", file], { stdio: "ignore" });
  } catch {
    throw new Error(`${file} is not ignored by git: nothing was read. Add it to .gitignore first.`);
  }
}

/**
 * Loads `.env.postgres.local` into `process.env` (values already set in the environment win, as CI sets its own) and
 * returns the names it set. Refuses when the file is missing or not git-ignored.
 */
export function loadPgEnv(file: string = PG_ENV_FILE): string[] {
  const full = path.resolve(file);
  if (!fs.existsSync(full)) throw new Error(`${file} does not exist.`);
  assertIgnored(file);
  const before = new Set(Object.keys(process.env).filter((k) => process.env[k] !== undefined));
  const saved = { ...process.env };
  process.loadEnvFile(full);
  const set: string[] = [];
  for (const key of Object.keys(process.env)) {
    if (before.has(key)) process.env[key] = saved[key];
    else set.push(key);
  }
  return set;
}

/** A variable that must be set; its name in the error, never a value. */
export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (${PG_ENV_FILE} or the environment).`);
  return v;
}

/** A connection string's host and database, for messages: never the user, the password or the query. */
export function targetName(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname || "/"}`;
  } catch {
    return "(unreadable connection string)";
  }
}

/**
 * The refusal of a target that is not `infomapper-dev` (slice 31, F10; until slice D), or null: the database is
 * `postgres` on the Supabase project `SUPABASE_URL` names (its reference in the session pooler's user name,
 * `postgres.<reference>`, or the direct host `db.<reference>.supabase.co`), and the server's name is `dev`. No project
 * reference is written in the repository; nothing of the values is in the message.
 */
export function devTargetRefusal(values: { migrationUrl: string; supabaseUrl: string | undefined; serverName: string | undefined }): string | null {
  const refused = "The target is not infomapper-dev (INFOMAPPER_MIGRATION_URL, SUPABASE_URL and INFOMAPPER_SERVER_NAME must name it): nothing was changed.";
  if (values.serverName !== "dev" || !values.supabaseUrl) return refused;
  try {
    const host = new URL(values.supabaseUrl).hostname;
    const m = /^([a-z0-9]+)\.supabase\.co$/.exec(host);
    if (!m) return refused;
    const reference = m[1]!;
    const db = new URL(values.migrationUrl);
    if (db.pathname !== "/postgres") return refused;
    const user = decodeURIComponent(db.username);
    const pooled = user === `postgres.${reference}` && /\.pooler\.supabase\.com$/.test(db.hostname);
    const direct = user === "postgres" && db.hostname === `db.${reference}.supabase.co`;
    return pooled || direct ? null : refused;
  } catch {
    return refused;
  }
}
