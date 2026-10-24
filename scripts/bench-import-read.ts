// Benchmark (slice 7a, step 2; PRD section 6; not part of `npm test`): reading the standard and translating DDL at
// 20,000 and 100,000 column rows (step 1, answer 13). Synthetic files from scripts/lib/import-synthetic.ts, made in
// memory. One warm-up, then 5 rounds each; median, fastest, slowest. Run: npx tsx scripts/bench-import-read.ts

import { performance } from "node:perf_hooks";
import { readDdl } from "../src/domain/import/ddl";
import { readStandard } from "../src/domain/import/standard";
import { syntheticDdl, syntheticStandard } from "./lib/import-synthetic";

const ROUNDS = 5;
const ms = (v: number) => `${Math.round(v)} ms`;
const mb = (text: string) => `${(Buffer.byteLength(text) / 1e6).toFixed(1)} MB`;

function time(label: string, bar: number, run: () => { columns: number; errors: string[] }) {
  const warm = run();
  if (warm.errors.length) throw new Error(`${label}: ${warm.errors.join(" ")}`);
  const times: number[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    const t = performance.now();
    run();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(ROUNDS / 2)]!;
  console.log(`${label}: ${warm.columns.toLocaleString("en-GB")} columns; median ${ms(median)}, fastest ${ms(times[0]!)}, slowest ${ms(times.at(-1)!)}; bar ${ms(bar)} ${median <= bar ? "met" : "MISSED"}`);
}

for (const tables of [2_000, 10_000]) {
  const standard = syntheticStandard(tables);
  const ddl = syntheticDdl(tables);
  console.log(`\n${tables.toLocaleString("en-GB")} tables: standard ${mb(standard)}, DDL ${mb(ddl)}`);
  time(`  read the standard`, 1_000, () => {
    const r = readStandard(standard, "synthetic.csv", { maxRows: Infinity }); // past the import limit on purpose
    return { columns: r.columnCount, errors: r.errors };
  });
  time(`  translate and read the DDL`, 2_000, () => {
    const { read } = readDdl(ddl, { fileName: "synthetic.sql", maxRows: Infinity });
    return { columns: read.columnCount, errors: read.errors };
  });
}
