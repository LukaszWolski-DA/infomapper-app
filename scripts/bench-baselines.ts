// Benchmark (slice 35, step 1's Q2 and Q5; reference figures only, no bar: CLAUDE.md, "When to measure"): a baseline on
// the demo's "Retail Co – DWH" and on "Performance test", in Node, from the rows built in memory (never a JSON file of
// someone's, so never KB). Timed apart: the content from the rows (what taking one does after `store.snapshot`), its JSON
// and gzip size, the comparison of two states (5 % of the attributes and columns changed), the filter; then taking one
// through the local adapter end to end (the command and the write, the content's own file and the data file) on a copy
// in a temporary folder. One warm-up, then 9 rounds; median, fastest, slowest.
// Run: npx tsx scripts/bench-baselines.ts

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { gzipSync } from "node:zlib";
import { baselineContentNow, baselineContentOfRows } from "../src/compose/baselines";
import { addSeedDemoData } from "../src/compose/seed";
import { STORE_SCHEMA } from "../src/compose/tables";
import { writeDb } from "../src/data/local/file";
import type { DevDb } from "../src/data/local/schema";
import { buildSeed, SEED_IDS } from "../src/data/local/seed";
import { addLargeWorkspace, LARGE_IDS } from "../src/data/local/seed-large";
import { createLocalDataStore } from "../src/data/local/store";
import { compareBaselines, filterChanges } from "../src/domain/baseline/compare";
import type { BaselineContent } from "../src/domain/baseline/content";
import { createBaseline } from "../src/domain/commands/baseline";
import { uuidv7 } from "../src/domain/ids";

const ROUNDS = 9;
const ms = (v: number) => `${v.toFixed(1)} ms`;
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

function time(label: string, run: () => unknown): number {
  run();
  const times: number[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    const t = performance.now();
    run();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(ROUNDS / 2)]!;
  console.log(`  ${label}: median ${ms(median)}, fastest ${ms(times[0]!)}, slowest ${ms(times.at(-1)!)}`);
  return median;
}

/** The content with every 20th attribute's and column's type changed: about 5 % of them. */
function changed(c: BaselineContent): BaselineContent {
  const out = structuredClone(c) as { model: { attributes: { type_length: number | null }[]; sourceColumns: { type_length: number | null }[] } };
  out.model.attributes.forEach((a, i) => { if (i % 20 === 0) a.type_length = (a.type_length ?? 10) + 1; });
  out.model.sourceColumns.forEach((x, i) => { if (i % 20 === 0) x.type_length = (x.type_length ?? 10) + 1; });
  return out as unknown as BaselineContent;
}

async function bench(label: string, db: DevDb, workspaceId: string): Promise<void> {
  const content = baselineContentOfRows(db, workspaceId)!;
  const json = JSON.stringify(content);
  const rows = (json.match(/"id":/g) ?? []).length;
  console.log(`\n${label}: about ${rows.toLocaleString("en-GB")} rows, ${kb(json.length)} of JSON, ${kb(gzipSync(json).length)} gzipped`);
  time("content from the rows", () => baselineContentOfRows(db, workspaceId));
  time("JSON of the content", () => JSON.stringify(content));
  time("parse the content", () => JSON.parse(json));
  const after = changed(content);
  const changes = compareBaselines(content, after);
  console.log(`  changes found: ${changes.length}`);
  time("compare two states", () => compareBaselines(content, after));
  time("filter the changes ('cust')", () => filterChanges(changes, "cust"));

  // end to end through the local adapter, on a copy in a temporary folder
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "im-bench-baselines-"));
  try {
    const file = path.join(dir, "db.json");
    await writeDb(file, db);
    const store = createLocalDataStore(file, STORE_SCHEMA);
    const actor = db.workspace_member.find((m) => m.workspace_id === workspaceId && m.role === "owner")!.user_id;
    const access = { workspace: (await store.workspaces.get(workspaceId))!, member: await store.workspaces.getMember(workspaceId, actor) };
    const times: number[] = [];
    for (let i = 0; i <= 5; i++) {
      const t = performance.now();
      const now = (await baselineContentNow(store, workspaceId))!;
      const made = createBaseline({ actorId: actor, now: new Date().toISOString(), newId: uuidv7 }, access, { baselines: await store.baselines.listAll(workspaceId) }, now, { workspaceId, name: `Bench ${i}` });
      if (!made.ok) throw new Error(made.error.message);
      const r = await store.apply(made.writeSet);
      if (!r.ok) throw new Error(r.error.message);
      if (i) times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    console.log(`  take a baseline through the local adapter (read, command, write): median ${ms(times[2]!)}, fastest ${ms(times[0]!)}, slowest ${ms(times.at(-1)!)} (5 rounds)`);
    const t = performance.now();
    await store.baselines.list(workspaceId);
    console.log(`  list the baselines (no content read): ${ms(performance.now() - t)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const demo = buildSeed();
  addSeedDemoData(demo);
  await bench("Demo, Retail Co – DWH", demo, SEED_IDS.wsRetailDwh);
  const large = buildSeed();
  addLargeWorkspace(large, new Date().toISOString());
  await bench("Performance test", large, LARGE_IDS.workspace);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
