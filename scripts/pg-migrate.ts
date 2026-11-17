// npx tsx scripts/pg-migrate.ts [--dry-run]: applies the migrations in supabase/migrations/ that a database has not had
// yet (slice 29, F12), each in its own transaction, recording it in `supabase_migrations.schema_migrations` (the table
// the Supabase CLI keeps, keyed by the file's timestamp), so the database's history says what it holds.
//
// The target is INFOMAPPER_MIGRATION_URL (Supabase's session pooler, port 5432, L1), from the environment or
// `.env.postgres.local` (git-ignored, L4). It is named as host/database only; no value is printed. Refuses a migration
// in the history that is not in the folder (a database ahead of this branch) and a file whose name has no timestamp.
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { pgClientConfig } from "../src/data/postgres/config";
import { loadPgEnv, required, targetName } from "./lib/pg-env";

const MIGRATIONS = path.resolve(__dirname, "../supabase/migrations");
const NAME = /^(\d{14})_([a-z0-9_]+)\.sql$/;

async function main(): Promise<number> {
  if (fs.existsSync(".env.postgres.local")) loadPgEnv();
  const url = required("INFOMAPPER_MIGRATION_URL");
  const dryRun = process.argv.includes("--dry-run");
  const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) if (!NAME.test(f)) throw new Error(`${f}: a migration's name is <14-digit timestamp>_<name>.sql.`);

  const client = new Client(pgClientConfig(url));
  await client.connect();
  console.log(`Target: ${targetName(url)}`);
  try {
    await client.query(`create schema if not exists supabase_migrations`);
    await client.query(`create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text)`);
    const applied = new Set((await client.query<{ version: string }>("select version from supabase_migrations.schema_migrations")).rows.map((r) => r.version));
    const known = new Set(files.map((f) => NAME.exec(f)![1]!));
    const ahead = [...applied].filter((v) => !known.has(v));
    if (ahead.length) {
      console.error(`The database has migrations this branch does not know (${ahead.join(", ")}): nothing was applied.`);
      return 1;
    }
    const todo = files.filter((f) => !applied.has(NAME.exec(f)![1]!));
    console.log(`${applied.size} applied before, ${todo.length} to apply${dryRun ? " (dry run: nothing is applied)" : ""}.`);
    if (dryRun) {
      for (const f of todo) console.log(`  would apply ${f}`);
      return 0;
    }
    for (const f of todo) {
      const [, version, name] = NAME.exec(f)!;
      const sql = fs.readFileSync(path.join(MIGRATIONS, f), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3)", [version, [sql], name]);
        await client.query("commit");
      } catch (e) {
        await client.query("rollback").catch(() => undefined);
        console.error(`${f} failed and was rolled back: ${(e as Error).message}`);
        return 1;
      }
      console.log(`Applied ${f}`);
    }
    return 0;
  } finally {
    await client.end();
  }
}

main().then(
  (code) => (process.exitCode = code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : "Failed.");
    process.exitCode = 1;
  },
);
