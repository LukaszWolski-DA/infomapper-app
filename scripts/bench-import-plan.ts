// Benchmark (slice 7a, step 3; PRD section 6; not part of `npm test`): the import's plan on a re-import of 20,000 and
// 100,000 column rows against a system that holds them, with 5 % of the columns changed, renamed or missing
// (`fivePercent`) and a direct, approved mapping on every tenth column, so P6's rule runs. Also apply (the changeset;
// step 4 measures the writes) and P8's digest. One warm-up, then 5 rounds; median, fastest, slowest.
// Run: npx tsx scripts/bench-import-plan.ts

import { performance } from "node:perf_hooks";
import { emptyModel, importInto, withEntity, withMapping } from "../src/domain/__fixtures__/import";
import { applyPlan } from "../src/domain/import/apply";
import { planDigest } from "../src/domain/import/compare";
import type { ImportModel } from "../src/domain/import/model";
import { buildPlan, importSummary, planCounts, type PlanChoices } from "../src/domain/import/plan";
import { readStandard } from "../src/domain/import/standard";
import { fivePercent, syntheticStandard } from "./lib/import-synthetic";

const ROUNDS = 5;
const ms = (v: number) => `${Math.round(v)} ms`;

function time<T>(label: string, bar: number | null, run: () => T): T {
  const result = run();
  const times: number[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    const t = performance.now();
    run();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(ROUNDS / 2)]!;
  console.log(`  ${label}: median ${ms(median)}, fastest ${ms(times[0]!)}, slowest ${ms(times.at(-1)!)}${bar === null ? "" : `; bar ${ms(bar)} ${median <= bar ? "met" : "MISSED"}`}`);
  return result;
}

for (const tables of [2_000, 10_000]) {
  const first = readStandard(syntheticStandard(tables), "first.csv");
  let model: ImportModel = importInto(emptyModel(), first, { newName: "Synth" }).model;
  // a direct, approved mapping from every tenth column onto a string(50) attribute
  model = withEntity(model, "Target", [{ name: "value", type_length: 50 }]);
  const attribute = model.attributes.at(-1)!.id;
  const mapped = model.columns.filter((_, i) => i % 10 === 5);
  let mappings = model;
  for (const c of mapped) mappings = withMapping(mappings, attribute, [c.id]).model;
  model = mappings;

  const changed = readStandard(syntheticStandard(tables, undefined, fivePercent), "changed.csv");
  const target = { systemId: model.systems[0]!.id };
  const choices: PlanChoices = { scope: new Set(changed.tables.map((t) => t.key)), compare: "schemas", renames: new Map() };
  console.log(`\n${first.columnCount.toLocaleString("en-GB")} columns in ${tables.toLocaleString("en-GB")} tables, ${mapped.length.toLocaleString("en-GB")} mappings`);
  const plan = time("plan the re-import", 2_000, () => buildPlan(model, changed, target, choices));
  const counts = planCounts(plan);
  console.log(`    ${importSummary(counts)}; ${plan.mappings.filter((m) => m.sendsBack).length} mappings back to review`);
  time("apply (the changeset)", null, () => applyPlan(model, plan, { now: "2026-10-22T20:00:00.000Z", newId: () => "x" }));
  time("P8's digest", null, () => planDigest(plan));
}
