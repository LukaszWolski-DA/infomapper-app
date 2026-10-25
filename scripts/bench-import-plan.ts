// Benchmark (slice 7a, step 3; PRD section 6; not part of `npm test`): the import's plan on a re-import of 20,000 and
// 100,000 column rows against a system that holds them, with 5 % of the columns changed, renamed or missing
// (`fivePercent`) and a direct, approved mapping on every tenth column, so P6's rule runs. Also apply (the changeset;
// step 4 measures the writes) and P8's digest. One warm-up, then 5 rounds; median, fastest, slowest.
// Slice 7b, step 2: the plan and apply now raise and settle changes to resolve (bar: within 10 % of slice 7a's, run
// against the tag in the same sitting); and the review's coverage before and after (Q3): the model as the import
// leaves it and two requirement indexes, on a variant with one attribute per mapping and 500 requirements of four
// attribute links each (bar: 100 ms).
// Run: npx tsx scripts/bench-import-plan.ts

import { performance } from "node:perf_hooks";
import { emptyModel, importInto, withEntity, withMapping } from "../src/domain/__fixtures__/import";
import { applyPlan } from "../src/domain/import/apply";
import { planDigest } from "../src/domain/import/compare";
import type { ImportModel } from "../src/domain/import/model";
import { materialize } from "../src/domain/import/materialize";
import { buildPlan, importSummary, planCounts, type PlanChoices } from "../src/domain/import/plan";
import { coverageDelta, scopeModelOf } from "../src/domain/source-changes/coverage";
import type { Requirement, RequirementLink } from "../src/domain/types";
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

for (const tables of process.argv.includes("--limit") ? [3_000] : [2_000, 10_000]) {
  const first = readStandard(syntheticStandard(tables), "first.csv", { maxRows: Infinity }); // past the import limit on purpose
  let model: ImportModel = importInto(emptyModel(), first, { newName: "Synth" }).model;
  // a direct, approved mapping from every tenth column onto a string(50) attribute
  model = withEntity(model, "Target", [{ name: "value", type_length: 50 }]);
  const attribute = model.attributes.at(-1)!.id;
  const mapped = model.columns.filter((_, i) => i % 10 === 5);
  let mappings = model;
  for (const c of mapped) mappings = withMapping(mappings, attribute, [c.id]).model;
  model = mappings;

  const changed = readStandard(syntheticStandard(tables, undefined, fivePercent), "changed.csv", { maxRows: Infinity });
  const target = { systemId: model.systems[0]!.id };
  const choices: PlanChoices = { scope: new Set(changed.tables.map((t) => t.key)), compare: "schemas", renames: new Map() };
  console.log(`\n${first.columnCount.toLocaleString("en-GB")} columns in ${tables.toLocaleString("en-GB")} tables, ${mapped.length.toLocaleString("en-GB")} mappings`);
  const plan = time("plan the re-import", 2_000, () => buildPlan(model, changed, target, choices));
  const counts = planCounts(plan);
  console.log(`    ${importSummary(counts)}; ${plan.mappings.filter((m) => m.sendsBack).length} mappings back to review`);
  time("apply (the changeset)", null, () => applyPlan(model, plan, { actorId: "x", now: "2026-10-22T20:00:00.000Z", newId: () => "x" }));
  time("P8's digest", null, () => planDigest(plan));
  if (process.argv.includes("--no-coverage")) continue;

  // the review's coverage before and after (slice 7b, Q3): one attribute per mapped column, 500 requirements
  let wide: ImportModel = importInto(emptyModel(), first, { newName: "Synth" }).model;
  wide = withEntity(wide, "Wide", mapped.map((_, i) => ({ name: `a${i}`, type_length: 50 })));
  const attrs = wide.attributes;
  const columnsMapped = wide.columns.filter((_, i) => i % 10 === 5);
  columnsMapped.forEach((c, i) => (wide = withMapping(wide, attrs[i]!.id, [c.id]).model));
  const std = (id: string) => ({ id, workspace_id: wide.systems[0]!.workspace_id, version: 1, created_at: "t", created_by: "u", updated_at: "t", updated_by: "u", deleted_at: null });
  const requirements: Requirement[] = Array.from({ length: 500 }, (_, i) => ({
    ...std(`r${i}`),
    key: `REQ-${i}`,
    kind: "data",
    name: `R${i}`,
    description_html: null,
    description_text: null,
    expression: null,
    severity: null,
    status: "draft",
    priority: "should",
    owner_name: null,
    external_ref: null,
    parent_id: null,
  }));
  const links: RequirementLink[] = requirements.flatMap((r, i) =>
    [0, 1, 2, 3].map((k) => ({ ...std(`l${i}-${k}`), requirement_id: r.id, entity_id: null, attribute_id: attrs[(i * 4 + k) % attrs.length]!.id, mapping_id: null, source_table_id: null, source_column_id: null })),
  );
  const widePlan = buildPlan(wide, changed, { systemId: wide.systems[0]!.id }, choices);
  const applied = applyPlan(wide, widePlan, { actorId: "x", now: "2026-10-22T20:00:00.000Z", newId: () => "x" });
  if (!applied.ok) throw new Error(applied.errors.join(" "));
  const delta = time("coverage before and after (materialize, two indexes)", 100, () =>
    coverageDelta(requirements, links, scopeModelOf(wide), scopeModelOf(materialize(wide, applied.changes, { workspaceId: "w", actorId: "x", now: "2026-10-22T20:00:00.000Z" }))),
  );
  console.log(`    ${widePlan.raises.length.toLocaleString("en-GB")} changes raised; ${delta.length} of 500 requirements change coverage`);
}
