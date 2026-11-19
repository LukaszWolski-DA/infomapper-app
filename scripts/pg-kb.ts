// npm run pg:kb -- <file under .data/backups/> (slice 31, C2.2): organization KB copied from a copy of a backup of
// Łukasz's local file into infomapper-dev, replacing KB's rows there (copied again the same way); `--remove` removes KB
// only. One transaction, checked by counts per table; the demo, "Performance test", the people and the other
// organizations' undo histories stay.
//
//   npm run pg:kb -- .data/backups/dev-db-<yyyymmdd-hhmm>.json   # copy, or copy again
//   npm run pg:kb -- --remove                                     # remove KB
//   --organization <id>: another organization of the file (or of the database, with --remove) instead of KB
//
// - The file: only one under `.data/backups/`, never `dev-db.json`, read through a temporary copy (removed afterwards)
//   and upgraded to the current format in memory, never written back (T2, F9: `scripts/lib/backup-file.ts`).
// - What is copied (T1): the organization, its workspaces with every row in them (module rows, the history, soft-deleted
//   rows), its members and licences, and the people its rows name, keeping every id. Not copied: the organization's
//   development password (`organization_access`, C1.2). People are never deleted, and a person already online is kept as
//   is, with their Supabase link (F2); a person whose e-mail an online person with another id has stops the copy (F1).
//   KB's undo histories are emptied. The stored order: the rows' places in the whole file (T3, `placeAll`).
// - The target: INFOMAPPER_MIGRATION_URL (`.env.postgres.local`), named as host/database only, refused unless it is
//   infomapper-dev (F10: `devTargetRefusal`).
// It prints counts and schema names only: no name, no content, no e-mail, no id.
import fs from "node:fs";
import { Client } from "pg";
import { STORE_SCHEMA } from "../src/compose/tables";
import { pgClientConfig } from "../src/data/postgres/config";
import { placeAll, replaceOrganization, type OrganizationReport } from "../src/data/postgres/load";
import { readBackupCopy } from "./lib/backup-file";
import { organizationNamed, organizationRows, type Tables } from "./lib/organization-rows";
import { devTargetRefusal, loadPgEnv, required, targetName } from "./lib/pg-env";

const KB = "KB";

function option(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function print(report: OrganizationReport, remove: boolean, crowded: Record<string, number>) {
  const removed = Object.entries(report.removed);
  console.log(`Removed first: ${removed.length ? removed.map(([t, n]) => `${t} ${n}`).join(", ") : "nothing"}.`);
  if (remove) return;
  console.log("Rows per table (in the file / in the database):");
  for (const c of report.counts) if (c.given || c.stored) console.log(`  ${c.table.padEnd(28)} ${String(c.given).padStart(7)} ${String(c.stored).padStart(7)}`);
  const total = report.counts.reduce((n, c) => n + c.stored, 0);
  console.log(`  ${"total".padEnd(28)} ${String(total).padStart(7)} ${String(total).padStart(7)}`);
  console.log(`People: ${report.counts.find((c) => c.table === "app_user")?.given ?? 0}, of them ${report.peopleKept} online already and kept as they are.`);
  for (const [table, n] of Object.entries(crowded)) console.log(`Note: ${table}: ${n} rows share the last microsecond of a millisecond (ordered by key there).`);
}

async function main(): Promise<number> {
  if (fs.existsSync(".env.postgres.local")) loadPgEnv();
  const url = required("INFOMAPPER_MIGRATION_URL");
  const refusal = devTargetRefusal({ migrationUrl: url, supabaseUrl: process.env.SUPABASE_URL, serverName: process.env.INFOMAPPER_SERVER_NAME });
  if (refusal) throw new Error(refusal);
  const remove = process.argv.includes("--remove");
  const chosen = option("--organization");
  const fileArg = process.argv.slice(2).find((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--organization");

  let rows: Tables | null = null;
  let crowded: Record<string, number> = {};
  let organizationId = chosen;
  if (!remove) {
    const { db, formatBefore, made } = readBackupCopy(fileArg);
    // the places in the whole file (T3), then the organization's rows
    const placed = placeAll(db as unknown as Record<string, unknown>);
    crowded = placed.crowded;
    const tables = placed.tables as Tables;
    organizationId ??= organizationNamed(tables, KB);
    rows = organizationRows(tables, organizationId, STORE_SCHEMA);
    const madeText = Object.entries(made).map(([t, n]) => `${t} +${n}`).join(", ");
    console.log(`File: format ${formatBefore}, in memory ${db.format as number}; the upgrade in memory made ${madeText || "no rows"}.`);
  } else if (fileArg) {
    throw new Error("--remove takes no file: nothing was changed.");
  }

  const client = new Client(pgClientConfig(url));
  await client.connect();
  console.log(`Target: ${targetName(url)}${remove ? " (remove)" : ""}`);
  try {
    if (!organizationId) {
      const found = (await client.query<{ id: string }>("select id from organization where name = $1", [KB])).rows;
      if (found.length !== 1) throw new Error(`The database has ${found.length} organizations of that name, not one: nothing was changed.`);
      organizationId = found[0]!.id;
    }
    const started = Date.now();
    const report = await replaceOrganization(client, STORE_SCHEMA, organizationId, rows, { placed: true });
    console.log(`${remove ? "Removed" : "Copied"} in ${Date.now() - started} ms.`);
    print(report, remove, crowded);
    return 0;
  } finally {
    await client.end();
  }
}

main().then(
  (code) => (process.exitCode = code),
  (e: unknown) => {
    // the database's own refusals may quote a row's values (a key's detail): only their code and constraint
    const db = e as { code?: unknown; constraint?: unknown; severity?: unknown };
    if (typeof db.code === "string" && db.severity) console.error(`The database refused the copy (${db.code}${typeof db.constraint === "string" ? `, ${db.constraint}` : ""}): nothing was changed.`);
    else console.error(e instanceof Error ? e.message : "Failed.");
    process.exitCode = 1;
  },
);
