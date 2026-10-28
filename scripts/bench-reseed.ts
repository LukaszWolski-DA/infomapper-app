// Slice 8, section 6 (F7): what one e2e reseed costs. `resetDevData()` on a temporary file, 2 warm-ups, then 20 runs;
// median and max. Run here and on slice-07c (a worktree) in turns; bar: no more than +10 ms per reseed.
// Run: npx tsx scripts/bench-reseed.ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { resetDevData } from "../src/data/local/dev-data";

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), "infomapper-reseed-"));
  const file = path.join(dir, "dev-db.json");
  try {
    for (let i = 0; i < 2; i++) await resetDevData(file);
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t = performance.now();
      await resetDevData(file);
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    console.log(`resetDevData: median ${((times[9]! + times[10]!) / 2).toFixed(1)} ms, max ${times[19]!.toFixed(1)} ms (20 runs)`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

void main();
