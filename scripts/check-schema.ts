// npm run schema:check (AD-31): applies every migration in supabase/migrations/ in order to an empty Postgres
// (DATABASE_URL) and compares the tables it creates with the domain's (tests/schema/). Exits 1 on any mismatch.
// CI runs it against a fresh Postgres 17 (.github/workflows/schema.yml); locally, point DATABASE_URL at a throwaway
// database. It refuses a database that already has tables in the public schema.
//
// npm run schema:check -- --existing (slice 29, F12): compares a database that already has its migrations (applied by
// scripts/pg-migrate.ts) and applies nothing: INFOMAPPER_MIGRATION_URL, from the environment or .env.postgres.local
// (git-ignored), named as host/database only. It also requires Row Level Security on every table (S29-09).
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { pgClientConfig } from "../src/data/postgres/config";
import { loadPgEnv, targetName } from "./lib/pg-env";
import { compareSchemas, NOT_IN_DOMAIN_YET, tablesFromPg, type PgColumnRow } from "../tests/schema/compare-schema";
import { domainTables, POSTGRES_ONLY_FILE } from "../tests/schema/domain-tables";

const MIGRATIONS = path.resolve(__dirname, "../supabase/migrations");

async function main(): Promise<number> {
  const existingOnly = process.argv.includes("--existing");
  if (existingOnly && !process.env.INFOMAPPER_MIGRATION_URL && fs.existsSync(".env.postgres.local")) loadPgEnv();
  const url = existingOnly ? process.env.INFOMAPPER_MIGRATION_URL : process.env.DATABASE_URL;
  if (!url) {
    console.error(existingOnly ? "Set INFOMAPPER_MIGRATION_URL (or .env.postgres.local)." : "Set DATABASE_URL to an empty Postgres database.");
    return 1;
  }
  const client = new Client(existingOnly ? pgClientConfig(url) : { connectionString: url });
  await client.connect();
  try {
    const version = await client.query("show server_version");
    if (existingOnly) {
      console.log(`Comparing ${targetName(url)} as it stands (nothing is applied). Postgres ${version.rows[0].server_version}`);
    } else {
      const existing = await client.query("select count(*)::int as n from information_schema.tables where table_schema = 'public'");
      if (existing.rows[0].n > 0) {
        console.error("The database already has tables in the public schema. Use an empty database.");
        return 1;
      }
      console.log(`Postgres ${version.rows[0].server_version}`);
      const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
      for (const file of files) {
        await client.query(fs.readFileSync(path.join(MIGRATIONS, file), "utf8"));
        console.log(`Applied ${file}`);
      }
    }

    const { rows } = await client.query<PgColumnRow>(
      `select table_name, column_name, data_type, is_nullable
         from information_schema.columns
        where table_schema = 'public'
        order by table_name, ordinal_position`,
    );
    const { tables, unsupported } = tablesFromPg(rows);
    // slice 30: the tables only the Postgres adapter has (`undo_step`), beside the domain's
    const domain = [...domainTables(), ...domainTables(POSTGRES_ONLY_FILE, "PostgresOnlyTables")];
    const mismatches = [...unsupported, ...compareSchemas(domain, tables, NOT_IN_DOMAIN_YET)];
    if (mismatches.length) {
      console.error(`The migrations and the domain disagree (${mismatches.length}):`);
      for (const m of mismatches) console.error(`  - ${m}`);
      return 1;
    }
    // S29-09: Row Level Security on every table, both modes
    const noRls = await client.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by c.relname`,
    );
    if (noRls.rows.length) {
      console.error(`Row Level Security is off on ${noRls.rows.length} table(s): ${noRls.rows.map((r) => r.relname).join(", ")}`);
      return 1;
    }
    console.log(
      `The schema matches the domain: ${domain.length} tables, ${domain.reduce((n, t) => n + t.columns.length, 0)} columns ` +
        `(not in the domain yet: ${NOT_IN_DOMAIN_YET.join(", ")}); Row Level Security on every table.`,
    );
    return 0;
  } finally {
    await client.end();
  }
}

main().then(
  (code) => (process.exitCode = code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  },
);
