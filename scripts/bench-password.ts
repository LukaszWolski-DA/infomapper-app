// Slice 8, section 6: verifying an organization password with the scrypt adapter. 2 warm-ups, then 20 runs; median and
// max, with the parameters. Bar: median under 200 ms. Run: npx tsx scripts/bench-password.ts
import { performance } from "node:perf_hooks";
import { SCRYPT_PARAMS, scryptHasher } from "../src/data/password";

async function main() {
  const stored = await scryptHasher.hash("correct horse battery");
  for (let i = 0; i < 2; i++) await scryptHasher.verify("correct horse battery", stored);
  const times: number[] = [];
  for (let i = 0; i < 20; i++) {
    const t = performance.now();
    await scryptHasher.verify("correct horse battery", stored);
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const median = (times[9]! + times[10]!) / 2;
  const { log2N, r, p } = SCRYPT_PARAMS;
  console.log(`scrypt N=2^${log2N} r=${r} p=${p}: verify median ${median.toFixed(1)} ms, max ${times[19]!.toFixed(1)} ms (20 runs; bar: median under 200 ms)`);
}

void main();
