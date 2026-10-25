// Benchmark (slice 7b, step 5; PRD section 6 as amended by step 1's question 16; not part of `npm test`): model
// consistency's computation on the project home after a re-import of 20,000 column rows with 5 % of the columns
// changed, renamed or missing, a direct approved mapping on every tenth column (each onto its own attribute), every
// table and the entity on one project canvas, and 500 requirements of four attribute links each. The changes the
// import raised are stored with it, so “Source changes to resolve” counts them. One warm-up, then 5 rounds; median,
// fastest, slowest. Bar: 50 ms. The requirement index is built once per page already (the Requirements list); it is
// timed apart.
// Run: npx tsx scripts/bench-consistency.ts

import { performance } from "node:perf_hooks";
import { emptyModel, importInto, withEntity, withMapping } from "../src/domain/__fixtures__/import";
import type { ImportModel } from "../src/domain/import/model";
import { readStandard } from "../src/domain/import/standard";
import { buildRequirementIndex } from "../src/domain/model/requirement-index";
import { modelConsistency, type ConsistencyModel, type ConsistencyRequirement } from "../src/domain/source-changes/consistency";
import type { CanvasItem, Requirement, RequirementLink } from "../src/domain/types";
import { fivePercent, syntheticStandard } from "./lib/import-synthetic";

const ROUNDS = 5;
const ms = (v: number) => `${v.toFixed(1)} ms`;

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

const TABLES = 2_000; // 10 columns each
const first = readStandard(syntheticStandard(TABLES), "first.csv", { maxRows: Infinity });
let model: ImportModel = importInto(emptyModel(), first, { newName: "Synth" }).model;
const mapped = model.columns.filter((_, i) => i % 10 === 5);
model = withEntity(model, "Wide", mapped.map((_, i) => ({ name: `a${i}`, type_length: 50 })));
const attrs = model.attributes;
mapped.forEach((c, i) => (model = withMapping(model, attrs[i]!.id, [c.id]).model));

const changed = readStandard(syntheticStandard(TABLES, undefined, fivePercent), "changed.csv", { maxRows: Infinity });
const after = importInto(model, changed, { systemId: model.systems[0]!.id }, { scope: new Set(changed.tables.map((t) => t.key)), compare: "schemas", renames: new Map() });
const m = after.model;
const asModel = { entities: m.entities, attributes: m.attributes, mappings: m.mappings, mappingInputs: m.mappingInputs, sourceTables: m.tables, sourceColumns: m.columns, sourceSystems: m.systems } as unknown as ConsistencyModel;

const ws = m.systems[0]!.workspace_id;
const std = (id: string) => ({ id, workspace_id: ws, version: 1, created_at: "t", created_by: "u", updated_at: "t", updated_by: "u", deleted_at: null });
const canvas = "canvas";
const items = [...m.tables.map((t) => ({ ...std(`i:${t.id}`), canvas_id: canvas, entity_id: null, source_table_id: t.id })), { ...std("i:e"), canvas_id: canvas, entity_id: m.entities[0]!.id, source_table_id: null }].map(
  (i) => ({ ...i, requirement_id: null, x: 0, y: 0, width: null, collapsed: false, row_filter: "all", frame_id: null, live_level: null }) as CanvasItem,
);
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

const missing = m.columns.filter((c) => c.missing_since).length;
console.log(`\n${m.columns.length.toLocaleString("en-GB")} columns, ${missing.toLocaleString("en-GB")} missing from source, ${m.mappings.length.toLocaleString("en-GB")} mappings, ${(m.changes ?? []).length.toLocaleString("en-GB")} changes to resolve, 500 requirements`);
const index = time("the requirement index (built once per page already)", null, () => buildRequirementIndex(requirements, links, asModel as never));
const project: ConsistencyRequirement[] = index.requirements.map((r) => {
  const c = index.coverage(r.id);
  return { id: r.id, key: r.key, name: r.name, covered: c.covered.length, total: c.total, bestCanvasId: canvas };
});
const c = time("model consistency", 50, () => modelConsistency(asModel, items, [canvas], index, project, m.changes ?? []));
console.log(`    ${c.groups.map((g) => `${g.title}: ${g.lines.length.toLocaleString("en-GB")}`).join("; ")}; ${c.requirements.length} requirements; badge ${c.count.toLocaleString("en-GB")}`);
