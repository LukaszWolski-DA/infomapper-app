// Benchmark (slice 20, step 2; Łukasz's step 1 answer 13; not part of `npm test`): the model checks and their index,
// built once per page, on a synthetic model of about 20,000 attributes (2,000 entities of 10 attributes, 2,000
// relationships, 3,000 copies with chains, wrong ways and missing relationships, duplicates, calculations, 3,000
// approved source mappings, 1,500 dimensional mappings), on "Performance test" and on the demo. The lookup is the
// requirement index's and the cube index the page's sections build: both timed apart. One warm-up, then 9 rounds;
// median, fastest, slowest. Bars (Łukasz, step 2's second round): the project home's whole computation, lines
// included, 50 ms in Node on the synthetic model; the marks and counts 20 ms in Chromium (`bench-checks-browser.ts`).
// "Performance test" and the demo are reported without a bar.
// Run: npx tsx scripts/bench-checks.ts

import { performance } from "node:perf_hooks";
import { addFullDemoData } from "../src/compose/seed";
import { buildSeed, SEED_IDS } from "../src/data/local/seed";
import { addLargeWorkspace, LARGE_IDS } from "../src/data/local/seed-large";
import { lookupModel } from "../src/domain/model/requirements";
import { cubeOf, homeOf, marksOf, prepare, type ChecksDb } from "./lib/checks-model";
import { synthetic, SYNTHETIC_WS } from "./lib/synthetic-checks";

const ROUNDS = 9;
/** The project home's whole computation, lines included, in Node (Łukasz, step 2's second round); the marks' bar is the browser's. */
const HOME_BAR = 50;
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

function report(name: string, db: ChecksDb, ws: string, bar: number | null, project?: number) {
  const p = prepare(db, ws);
  const all = new Set(p.model.entities.map((e) => e.id));
  const canvas = new Set(p.model.entities.slice(0, 40).map((e) => e.id));
  const { checks, lines } = homeOf(p, null);
  console.log(`${name}: ${p.model.entities.length} entities, ${p.model.attributes.length} attributes, ${p.model.relationships.length} relationships, ${p.rows.cubeMappings.length} dimensional mappings`);
  console.log(`  lines: ${checks.count} (${checks.groups.map((g) => `${g.id} ${g.items.length}`).join(", ")}); ${JSON.stringify(lines).length.toLocaleString("en")} bytes as JSON`);
  time("lookup (the requirement index's, apart)", null, () => lookupModel(p.model));
  time("cube index (the page's sections', apart)", null, () => cubeOf(p.model, p.rows));
  time("marks and counts (a canvas after a write)", null, () => marksOf(p, canvas));
  time("the home, every entity in scope, lines included", bar, () => homeOf(p, all));
  if (project) time(`the home, a project of ${project} entities, lines included`, null, () => homeOf(p, new Set(p.model.entities.slice(0, project).map((e) => e.id))));
}

const synth = synthetic();
report("Synthetic", synth, SYNTHETIC_WS, HOME_BAR, 200);

const large = buildSeed() as ChecksDb;
addLargeWorkspace(large, new Date().toISOString());
report("Performance test", large, LARGE_IDS.workspace, null);

const demo = buildSeed() as ChecksDb;
addFullDemoData(demo);
report("Demo (Retail Co – DWH)", demo, SEED_IDS.wsRetailDwh, null);
