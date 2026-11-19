// npx tsx scripts/kb-counts.ts <file under .data/backups/> (slice 31, step 1, Q2): a read-only count of organization KB
// in a copy of a backup of the local file, so the copy (step 2) and the measurement are planned on KB's real size. It
// prints counts and schema names only: never a name, an e-mail, an id or any content.
//
// It reads only the path it is given, which must be a file under `.data/backups/` and not named `dev-db.json` (CLAUDE.md:
// KB is read only on a copy of a backup); it never opens `.data/dev-db.json`. The file is upgraded to the current format
// in memory with the local adapter's own upgrade (`upgradeDb`), never written back, and compared with the demo built in
// memory (`seedRows()`). It writes nothing.
//
// Run (PowerShell, on a copy of the newest backup, removed afterwards):
//   $b = Get-ChildItem .data\backups\dev-db-*.json | Sort-Object LastWriteTime | Select-Object -Last 1
//   Copy-Item $b.FullName .data\backups\kb-count-copy.json
//   npx tsx scripts/kb-counts.ts .data/backups/kb-count-copy.json
//   Remove-Item .data\backups\kb-count-copy.json
import fs from "node:fs";
import { STORE_SCHEMA } from "../src/compose/tables";
import { upgradeDb } from "../src/data/local/file";
import { DEV_DB_FORMAT, type DevDb } from "../src/data/local/schema";
import { timeColumnOf } from "../src/data/postgres/tables";
import { uuidv7 } from "../src/domain/ids";
import { backupPath } from "./lib/backup-file";
import { seedRows } from "./lib/seed-rows";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

const tablesOf = (db: object): Tables =>
  Object.fromEntries(Object.entries(db).filter(([k, v]) => k !== "format" && Array.isArray(v))) as Tables;
const count = (t: Tables) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.length]));
const isDeleted = (r: Row) => r.deleted_at !== undefined && r.deleted_at !== null;
const ISO_MS = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const pad = (s: string | number, n: number) => String(s).padStart(n);

function main() {
  const file = backupPath(process.argv[2]);
  const bytes = fs.statSync(file).size;
  const db = JSON.parse(fs.readFileSync(file, "utf8")) as DevDb;
  const before = db.format as number;
  if (typeof before !== "number" || before < 2) throw new Error("Not a local data file of a known format.");
  if (before > DEV_DB_FORMAT) throw new Error(`Format ${before} is newer than this branch's ${DEV_DB_FORMAT}.`);
  const countsBefore = count(tablesOf(db));
  upgradeDb(db, new Date().toISOString(), () => uuidv7());
  const t = tablesOf(db);
  console.log(`File: ${bytes.toLocaleString("en-GB")} bytes; format ${before}, in memory ${db.format as number}.`);
  const made = Object.entries(count(t)).filter(([k, n]) => n !== (countsBefore[k] ?? 0));
  console.log(`The upgrade in memory made rows: ${made.length ? made.map(([k, n]) => `${k} +${n - (countsBefore[k] ?? 0)}`).join(", ") : "none"}.`);

  const unknown = Object.keys(t).filter((k) => !STORE_SCHEMA.rules[k]);
  if (unknown.length) console.log(`Tables the store does not know: ${unknown.join(", ")}.`);

  const orgs = t.organization ?? [];
  const kbs = orgs.filter((o) => o.name === "KB");
  console.log(`Organizations: ${orgs.length}; named KB: ${kbs.length}.`);
  if (kbs.length !== 1) throw new Error("Exactly one organization named KB is needed: nothing more is counted.");
  const kb = kbs[0]!.id as string;
  const workspaces = (t.workspace ?? []).filter((w) => w.organization_id === kb);
  const ws = new Set(workspaces.map((w) => w.id as string));
  console.log(`KB's workspaces: ${workspaces.length} (${workspaces.filter(isDeleted).length} deleted).`);

  const ownedBy = (table: string, r: Row): "kb" | "other" | "global" => {
    if (table === "app_user") return "global";
    if (table === "organization") return r.id === kb ? "kb" : "other";
    if ("workspace_id" in r) return ws.has(r.workspace_id as string) ? "kb" : "other";
    if ("organization_id" in r) return r.organization_id === kb ? "kb" : "other";
    return "other";
  };
  const kbRows: Tables = {};
  for (const [table, rows] of Object.entries(t)) kbRows[table] = rows.filter((r) => ownedBy(table, r) === "kb");

  // the demo's largest workspace beside KB, for the measurement
  const demo = seedRows();
  const demoTables = tablesOf(demo);
  const demoWs = (demoTables.workspace ?? []).find((w) => w.name === "Retail Co – DWH")!;
  const demoIn = (table: string, r: Row) => ("workspace_id" in r ? r.workspace_id === demoWs.id : table === "workspace" ? r.id === demoWs.id : false);

  console.log("\nRows per table: KB live / KB deleted / other organizations' / the demo's Retail Co – DWH");
  let kbBytes = 0;
  for (const table of Object.keys(t).sort()) {
    const mine = kbRows[table] ?? [];
    kbBytes += mine.reduce((n, r) => n + JSON.stringify(r).length, 0);
    const other = (t[table] ?? []).filter((r) => ownedBy(table, r) === "other").length;
    const d = (demoTables[table] ?? []).filter((r) => demoIn(table, r)).length;
    if (!mine.length && !other && !d && table !== "app_user") continue;
    const live = mine.filter((r) => !isDeleted(r)).length;
    console.log(`  ${table.padEnd(28)} ${pad(live, 7)} ${pad(mine.length - live, 7)} ${pad(table === "app_user" ? `(${t[table]!.length} people)` : other, 12)} ${pad(d, 7)}`);
  }
  console.log(`KB's rows as JSON: about ${kbBytes.toLocaleString("en-GB")} bytes.`);

  // fields KB's rows use that no row of the demo's seed uses (schema names only)
  const seedFields = new Map<string, Set<string>>();
  for (const [table, rows] of Object.entries(demoTables)) seedFields.set(table, new Set(rows.flatMap((r) => Object.keys(r))));
  const extra: string[] = [];
  for (const [table, rows] of Object.entries(kbRows)) {
    if (!rows.length) continue;
    const known = seedFields.get(table);
    const fields = new Set(rows.flatMap((r) => Object.keys(r)));
    if (!known || !known.size) extra.push(`${table} (no seed rows: ${[...fields].sort().join(", ")})`);
    else for (const f of fields) if (!known.has(f)) extra.push(`${table}.${f}`);
  }
  console.log(`\nFields in KB's rows that no seed row uses: ${extra.length ? extra.sort().join("; ") : "none"}.`);

  // the people KB's rows name
  const named = new Set<string>();
  for (const [table, rows] of Object.entries(kbRows)) {
    const cols = Object.entries(STORE_SCHEMA.rules[table]?.foreignKeys ?? {}).filter(([, target]) => target === "app_user").map(([c]) => c);
    for (const r of rows) for (const c of cols) if (typeof r[c] === "string") named.add(r[c] as string);
  }
  const orgMembers = new Set((t.organization_member ?? []).filter((m) => m.organization_id === kb).map((m) => m.user_id as string));
  const wsMembers = new Set((t.workspace_member ?? []).filter((m) => ws.has(m.workspace_id as string)).map((m) => m.user_id as string));
  const otherOrgMembers = new Set((t.organization_member ?? []).filter((m) => m.organization_id !== kb).map((m) => m.user_id as string));
  const users = new Map((t.app_user ?? []).map((u) => [u.id as string, u]));
  const demoEmails = new Set((demoTables.app_user ?? []).map((u) => String(u.email).toLowerCase()));
  const list = [...named];
  console.log("\nPeople:");
  console.log(`  KB's organization members: ${orgMembers.size}; members of KB's workspaces: ${wsMembers.size}.`);
  console.log(`  People KB's rows name: ${named.size}; not in app_user: ${list.filter((u) => !users.has(u)).length}.`);
  console.log(`  Of them, not KB's organization members: ${list.filter((u) => !orgMembers.has(u)).length}; not members of a KB workspace: ${list.filter((u) => !wsMembers.has(u)).length}.`);
  console.log(`  Of them, members of another organization in the file: ${list.filter((u) => otherOrgMembers.has(u)).length}.`);
  console.log(`  Of them, with an e-mail equal to a demo person's: ${list.filter((u) => demoEmails.has(String(users.get(u)?.email ?? "").toLowerCase())).length}.`);
  console.log(`  Of them, with an e-mail not in lower case: ${list.filter((u) => { const e = String(users.get(u)?.email ?? ""); return e !== e.toLowerCase(); }).length}.`);

  // foreign keys from KB's rows to rows outside KB, other than people
  const kbIds = new Map<string, Set<string>>();
  for (const [table, rows] of Object.entries(kbRows)) kbIds.set(table, new Set(rows.map((r) => r.id as string).filter(Boolean)));
  const allIds = new Map<string, Set<string>>();
  for (const [table, rows] of Object.entries(t)) allIds.set(table, new Set(rows.map((r) => r.id as string).filter(Boolean)));
  const cross: string[] = [];
  for (const [table, rows] of Object.entries(kbRows)) {
    for (const [col, target] of Object.entries(STORE_SCHEMA.rules[table]?.foreignKeys ?? {})) {
      if (target === "app_user") continue;
      let outside = 0;
      let missing = 0;
      for (const r of rows) {
        const v = r[col];
        if (typeof v !== "string") continue;
        if (kbIds.get(target)?.has(v)) continue;
        if (allIds.get(target)?.has(v)) outside++;
        else missing++;
      }
      if (outside || missing) cross.push(`${table}.${col} → ${target}: ${outside} outside KB, ${missing} missing`);
    }
  }
  console.log(`\nForeign keys from KB's rows to rows outside KB (people left out): ${cross.length ? "" : "none."}`);
  for (const c of cross) console.log(`  ${c}`);

  // time columns: the form the loader needs, and crowded milliseconds (T3)
  console.log("\nTime columns (KB's rows): values not in ISO milliseconds / the most rows in one millisecond / milliseconds with more than 999");
  for (const [table, rows] of Object.entries(kbRows)) {
    const column = timeColumnOf(table);
    if (!column || !rows.length) continue;
    let bad = 0;
    const per = new Map<string, number>();
    for (const r of rows) {
      const v = r[column];
      if (typeof v !== "string" || !ISO_MS.test(v)) bad++;
      else per.set(v, (per.get(v) ?? 0) + 1);
    }
    const most = Math.max(0, ...per.values());
    const crowded = [...per.values()].filter((n) => n > 999).length;
    if (bad || most > 1) console.log(`  ${`${table}.${column}`.padEnd(32)} ${pad(bad, 6)} ${pad(most, 7)} ${pad(crowded, 5)}`);
  }

  console.log(`\nKB's organization_access rows: ${kbRows.organization_access?.length ?? 0}; licences: ${kbRows.organization_licence?.length ?? 0}.`);
  const secretInImages = (kbRows.change_event ?? []).filter((e) => {
    if (e.object_type !== "organization_access") return false;
    const images = [e.before_image, e.after_image] as (Row | null)[];
    return images.some((i) => i && typeof i.access_hash === "string" && i.access_hash !== "(changed)" && i.access_hash !== "(unchanged)");
  }).length;
  console.log(`Change events of KB's password with a value other than the marker: ${secretInImages}.`);
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : "Failed.");
  process.exitCode = 1;
}
