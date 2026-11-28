// Benchmark (slice 39, step 2; C1: reference figures only, no bar; not part of `npm test`): InfoCatalog's read and search
// on the real code, at the size of Łukasz's test model (4,871 rows) and four times that. The model: the seed with "Performance test" (2,713 catalog
// items), its workspace cloned with every id remapped into more workspaces of InfoMate, which holds the `infocatalog`
// licence in the copy; Łukasz reads them all. Timed: `store.catalog.read` (the timing record, AD-37), the index
// (`catalogIndexOf`: the items, folded once) and a search (`searchCatalog`). One warm-up, then 9 rounds; median, fastest,
// slowest. Never reads a data file: everything is built in memory and written to a temporary copy.
// Run: npx tsx scripts/bench-catalog.ts
//      BENCH_PG=postgres://user@127.0.0.1:<port>/<empty database> npx tsx scripts/bench-catalog.ts   (also Postgres;
//      a database on this machine only, emptied first, never infomapper-dev)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { CATALOG_TABLES, catalogIndexOf, catalogSearchView } from "../src/compose/catalog";
import { STORE_SCHEMA } from "../src/compose/tables";
import type { DevDb } from "../src/data/local/schema";
import { SEED_IDS } from "../src/data/local/seed";
import { LARGE_IDS } from "../src/data/local/seed-large";
import { createLocalDataStore } from "../src/data/local/store";
import type { DataStore } from "../src/data/ports";
import { newTimingRecord, setTimingSource, timedStore, timingSummary } from "../src/data/timing";
import type { CatalogScope } from "../src/domain/catalog/read";
import { uuidv7 } from "../src/domain/ids";
import { searchCatalog } from "../src/modules/infocatalog/domain/search";
import { assertLocalDatabase, preparePostgres } from "../tests/contract/shared";
import { seedRows } from "./lib/seed-rows";

type Row = Record<string, unknown> & { id?: string; workspace_id?: string };
const ROUNDS = 9;
const ms = (v: number) => `${v.toFixed(1)} ms`;
/** The size of Łukasz's test model (rows, slice 31's copy); its catalog items are fewer. */
const MODEL_ITEMS = 4_871;
const QUERIES = ["customer", "cust id", "zrodlo", "a", "qqqq", "order date key"];

async function time(label: string, run: () => unknown): Promise<number> {
  await run();
  const times: number[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    const t = performance.now();
    await run();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(ROUNDS / 2)]!;
  console.log(`    ${label}: median ${ms(median)}, fastest ${ms(times[0]!)}, slowest ${ms(times.at(-1)!)}`);
  return median;
}

/** The workspace's rows copied into a new workspace of the same organization, every id of them remapped. */
function cloneWorkspace(db: Record<string, Row[]>, wsId: string, copy: number, at: { t: number }): void {
  const ids = new Set<string>([wsId]);
  const picked: [string, Row[]][] = [];
  for (const [table, rows] of Object.entries(db)) {
    if (!Array.isArray(rows)) continue;
    const mine = table === "workspace" ? rows.filter((r) => r.id === wsId) : rows.filter((r) => r.workspace_id === wsId);
    if (!mine.length) continue;
    picked.push([table, mine]);
    for (const r of mine) if (typeof r.id === "string") ids.add(r.id);
  }
  const map = new Map([...ids].map((id) => [id, uuidv7(at.t++)]));
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
  for (const [table, rows] of picked) {
    const copies = JSON.parse(JSON.stringify(rows).replace(uuid, (u) => map.get(u) ?? u)) as Row[];
    if (table === "workspace") for (const w of copies) w.name = `${String(w.name)} ${copy}`;
    db[table]!.push(...copies);
  }
}

function model(workspaces: number): DevDb {
  const at = new Date("2026-11-27T10:00:00.000Z");
  const db = seedRows(at) as unknown as Record<string, Row[]>;
  const clock = { t: at.getTime() };
  for (let c = 2; c <= workspaces; c++) cloneWorkspace(db, LARGE_IDS.workspace, c, clock);
  const iso = at.toISOString();
  db.organization_licence!.push({ id: uuidv7(clock.t++), version: 1, created_at: iso, created_by: SEED_IDS.userLukasz, updated_at: iso, updated_by: SEED_IDS.userLukasz, deleted_at: null, organization_id: SEED_IDS.orgInfoMate, module: "infocatalog" });
  return db as unknown as DevDb;
}

async function measure(side: string, raw: DataStore): Promise<void> {
  console.log(`  -- ${side}`);
  const store = timedStore(raw);
  const unlocked = new Set([SEED_IDS.orgInfoMate, SEED_IDS.orgRetailCo]);
  const scope: CatalogScope = { organizationId: SEED_IDS.orgInfoMate, workspaceId: null };
  const read = () => store.catalog.read(SEED_IDS.userLukasz, unlocked, scope, CATALOG_TABLES);
  await time("catalog.read (every readable workspace)", read);
  let record = newTimingRecord();
  setTimingSource(() => record);
  record = newTimingRecord();
  const once = (await read())!;
  console.log(`    timing record of one read: ${JSON.stringify(timingSummary(record))}`);
  let index = catalogIndexOf(once);
  await time(`the index (${once.snapshots.length} workspaces)`, () => (index = catalogIndexOf(once)));
  console.log(`    ${index.items.length.toLocaleString("en")} items`);
  for (const q of QUERIES) {
    let n = 0;
    await time(`search "${q}"`, () => (n = searchCatalog(index, q).counts.all!));
    console.log(`      ${n.toLocaleString("en")} results`);
  }
  // slice 39, step 5: what one request of the page runs (catalogSearchAction less the session): the rights, the read, the
  // index, the search and the view, through the store the composition root makes
  const readable = await store.catalog.readable(SEED_IDS.userLukasz, unlocked);
  if (process.env.INFOMAPPER_DATA !== "postgres" && !process.env.INFOMAPPER_DEV_DB?.includes("im-bench-catalog-")) throw new Error("The bench's store must be its temporary copy.");
  for (const q of ["customer", "a"]) {
    await time(`the page's search "${q}" (catalogSearchView)`, () => catalogSearchView(SEED_IDS.userLukasz, unlocked, readable, { org: SEED_IDS.orgInfoMate, q, scope: null, kind: "all", item: null }));
  }
}

async function main() {
  process.env.INFOMAPPER_TIMING = "1";
  const pg = process.env.BENCH_PG;
  if (pg) assertLocalDatabase(pg);
  const perf = 2_713;
  for (const [label, items] of [["4,871 items", MODEL_ITEMS], ["four times that", 4 * MODEL_ITEMS]] as const) {
    const n = Math.ceil(items / perf);
    console.log(`\n== ${label}: ${n} workspaces like "Performance test", with the demo's`);
    const db = model(n);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "im-bench-catalog-"));
    try {
      const file = path.join(tmp, "db.json");
      fs.writeFileSync(file, JSON.stringify(db));
      // the composition root's store (`getDataStore`) on the temporary copy only, never .data/dev-db.json
      process.env.INFOMAPPER_DEV_DB = file;
      delete process.env.INFOMAPPER_DATA;
      await measure("local adapter", createLocalDataStore(file, STORE_SCHEMA));
      if (pg) {
        await preparePostgres(pg, db);
        process.env.INFOMAPPER_DATABASE_URL = pg;
        process.env.INFOMAPPER_DATA = "postgres";
        const { createPostgresDataStore } = await import("../src/data/postgres/store");
        const { getPool } = await import("../src/data/postgres/pool");
        await measure("Postgres", createPostgresDataStore(STORE_SCHEMA));
        await getPool().end();
        delete (globalThis as { __infomapperPgPool?: unknown }).__infomapperPgPool;
      }
    } finally {
      delete process.env.INFOMAPPER_DATA;
      delete process.env.INFOMAPPER_DEV_DB;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}

void main();
