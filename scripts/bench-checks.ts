// Benchmark (slice 20, step 2; Łukasz's step 1 answer 13; not part of `npm test`): the model checks and their index,
// built once per page, on a synthetic model of about 20,000 attributes (2,000 entities of 10 attributes, 2,000
// relationships, 3,000 copies with chains, wrong ways and missing relationships, duplicates, calculations, 3,000
// approved source mappings, 1,500 dimensional mappings), on "Performance test" and on the demo. The lookup is the
// requirement index's, built anyway; it is timed apart. One warm-up, then 9 rounds; median, fastest, slowest.
// Bar: 20 ms (Node median) on the synthetic model; the others are reported without a bar.
// Run: npx tsx scripts/bench-checks.ts

import { performance } from "node:perf_hooks";
import { addFullDemoData } from "../src/compose/seed";
import { buildSeed, SEED_IDS } from "../src/data/local/seed";
import { addLargeWorkspace, LARGE_IDS } from "../src/data/local/seed-large";
import { lookupModel } from "../src/domain/model/requirements";
import { checksOf, prepare, type ChecksDb } from "./lib/checks-model";
import { synthetic, SYNTHETIC_WS } from "./lib/synthetic-checks";

const ROUNDS = 9;
const BAR = 20;
const ms = (v: number) => `${v.toFixed(1)} ms`;

function time(label: string, bar: number | null, run: () => unknown): void {
  run();
  const times: number[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    const t = performance.now();
    run();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(ROUNDS / 2)]!;
  console.log(`  ${label}: median ${ms(median)}, fastest ${ms(times[0]!)}, slowest ${ms(times.at(-1)!)}${bar === null ? "" : `; bar ${ms(bar)} ${median <= bar ? "met" : "MISSED"}`}`);
}

function report(name: string, db: ChecksDb, ws: string, bar: number | null, scopeOf?: (p: ReturnType<typeof prepare>) => Set<string>) {
  const p = prepare(db, ws);
  const { checks } = checksOf(p, null);
  console.log(`${name}: ${p.model.entities.length} entities, ${p.model.attributes.length} attributes, ${p.model.relationships.length} relationships, ${p.rows.cubeMappings.length} dimensional mappings`);
  console.log(`  lines: ${checks.count} (${checks.groups.map((g) => `${g.id} ${g.lines.length}`).join(", ")}); ${JSON.stringify(checks.groups).length.toLocaleString("en")} bytes as JSON`);
  time("lookup (the requirement index's, not counted)", null, () => lookupModel(p.model));
  time("checks and index, whole model (a canvas page)", bar, () => checksOf(p, null));
  if (scopeOf) {
    const scope = scopeOf(p);
    time(`checks, a project of ${scope.size} entities (the home)`, null, () => checksOf(p, scope));
  }
}

const synth = synthetic();
report("Synthetic", synth, SYNTHETIC_WS, BAR, (p) => new Set(p.model.entities.slice(0, 200).map((e) => e.id)));

const large = buildSeed() as ChecksDb;
addLargeWorkspace(large, new Date().toISOString());
report("Performance test", large, LARGE_IDS.workspace, null);

const demo = buildSeed() as ChecksDb;
addFullDemoData(demo);
report("Demo (Retail Co – DWH)", demo, SEED_IDS.wsRetailDwh, null);
