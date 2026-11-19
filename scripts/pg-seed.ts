// npx tsx scripts/pg-seed.ts [--reset]: the demo (`npm run seed`'s rows: the star, InfoDocumenter's documents, slice 20's
// checks) and "Performance test" (`npm run seed:large`'s workspace) into Postgres, in one transaction, checked by counts
// per table against the rows built (slice 29, Q7).
//
// The rows are built in memory with the seed's own functions: no JSON file is read, so the loader never meets KB or any
// other local data. The target is INFOMAPPER_MIGRATION_URL (Supabase's session pooler, L1), from the environment or
// `.env.postgres.local` (git-ignored, L4), named as host/database only. Without --reset it refuses a database with rows.
// Environments 2 and 3 share infomapper-dev: a reset changes what the preview shows at once.
// Slice 31 (Q8, T4): the reset refuses while the database holds any organization the seed does not make (KB's copy, or
// one made online), naming the order to follow (pg:backup, pg:kb -- --remove, then the reset); no override.
import { Client } from "pg";
import { STORE_SCHEMA } from "../src/compose/tables";
import { pgClientConfig } from "../src/data/postgres/config";
import { loadRows } from "../src/data/postgres/load";
import { loadPgEnv, required, targetName } from "./lib/pg-env";
import { seedRows } from "./lib/seed-rows";
import { resetRefusal } from "./lib/seed-organizations";
import fs from "node:fs";

async function main(): Promise<number> {
  if (fs.existsSync(".env.postgres.local")) loadPgEnv();
  const url = required("INFOMAPPER_MIGRATION_URL");
  const reset = process.argv.includes("--reset");
  const data = seedRows();
  const client = new Client(pgClientConfig(url));
  await client.connect();
  console.log(`Target: ${targetName(url)}${reset ? " (reset: every public table is emptied first; the preview on this database changes too)" : ""}`);
  try {
    const started = Date.now();
    const report = await loadRows(client, STORE_SCHEMA, data as unknown as Record<string, readonly Record<string, unknown>[]>, { reset, resetGuard: (db) => resetRefusal(db) });
    console.log(`Loaded in ${Date.now() - started} ms. Rows per table (built in memory / in Postgres):`);
    for (const c of report.counts) console.log(`  ${c.table.padEnd(28)} ${String(c.given).padStart(7)} ${String(c.stored).padStart(7)}`);
    const total = report.counts.reduce((n, c) => n + c.stored, 0);
    console.log(`  ${"total".padEnd(28)} ${String(total).padStart(7)} ${String(total).padStart(7)}`);
    for (const [table, n] of Object.entries(report.crowded)) {
      console.log(`Note: ${table}: ${n} rows share the last microsecond of a millisecond with more than 1,000 rows (ordered by key there).`);
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
