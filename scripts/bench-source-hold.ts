// Benchmark (slice 14b, step 3; PRD O4, step 1's F9 and answer 3; not part of `npm test`): what a change-to-resolve
// action's click costs before its request leaves, with its hold on the save chain. 20,000 column rows (2,000 tables of
// 10), a direct mapping on every tenth column. Two holds: the whole source system (step 1's agreement; step 3 found it
// over the bar, so the app does not use it) and the narrow hold the app uses (the change's table with its columns,
// mappings and inputs, `held.ts`). Each: the rows from the page's model, and their registration on the chain
// (`RowSaves.saveRows`) on a fresh chain (the first action on a page) and on one that knows every row. One warm-up, then
// 5 rounds; median, fastest, slowest. Bar: 20 ms for the click.
// Run: npx tsx scripts/bench-source-hold.ts

import { performance } from "node:perf_hooks";
import { emptyModel, importInto, withEntity, withMapping } from "../src/domain/__fixtures__/import";
import type { ImportModel } from "../src/domain/import/model";
import { readStandard } from "../src/domain/import/standard";
import { tableRowIds } from "../src/domain/source-changes/held";
import { RowSaves } from "../src/ui/row-saves";
import { syntheticStandard } from "./lib/import-synthetic";

const ROUNDS = 5;
const ms = (v: number) => `${v.toFixed(1)} ms`;

function time(label: string, run: () => void): number {
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

const TABLES = 2_000;
let model: ImportModel = importInto(emptyModel(), readStandard(syntheticStandard(TABLES), "first.csv", { maxRows: Infinity }), { newName: "Synth" }).model;
const mapped = model.columns.filter((_, i) => i % 10 === 5);
model = withEntity(model, "Wide", mapped.map((_, i) => ({ name: `a${i}`, type_length: 50 })));
const attrs = model.attributes;
mapped.forEach((c, i) => (model = withMapping(model, attrs[i]!.id, [c.id]).model));
const rows = { columns: model.columns, mappingInputs: model.mappingInputs };
console.log(`${model.tables.length} tables, ${model.columns.length} columns, ${model.mappings.length} mappings`);

const never = () => new Promise<{ ok: boolean }>(() => {});
function hold(label: string, tableIds: () => string[]) {
  const rowsOf = () => [{ id: "change", shown: 1 }, ...tableRowIds(rows, tableIds()).map((id) => ({ id }))];
  console.log(`${label}: ${rowsOf().length - 1} rows held`);
  time("the rows (tableRowIds)", () => void tableRowIds(rows, tableIds()));
  const fresh = time("the hold on a fresh chain (saveRows)", () => void new RowSaves().saveRows(rowsOf(), never));
  const warm = new RowSaves();
  void warm.saveRows(rowsOf(), () => Promise.resolve({ ok: true }));
  const known = time("the hold on a chain that knows every row", () => void warm.saveRows(rowsOf(), () => Promise.resolve({ ok: true })));
  const click = Math.max(fresh, known);
  console.log(`  the click (rows included): ${ms(click)}; bar 20 ms ${click <= 20 ? "met" : "MISSED"}`);
}

hold("The whole source", () => model.tables.map((t) => t.id));
hold("The narrow hold (one table)", () => [model.tables[1000]!.id]);
