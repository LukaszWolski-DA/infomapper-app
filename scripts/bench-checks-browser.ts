// The model checks in a browser (slice 20, step 2; Łukasz's point 2 of step 2's answer; one figure, no gate): the same
// code a canvas page would run (the lookup, then the checks and their index), bundled with esbuild and run in headless
// Chromium on the synthetic model of `bench-checks.ts`. One warm-up, then 9 rounds; median, fastest, slowest.
// Run: npx tsx scripts/bench-checks-browser.ts

import { build } from "esbuild";
import path from "node:path";
import { chromium } from "playwright";

const entry = `
import { checksOf, prepare } from "./lib/checks-model";
import { synthetic, SYNTHETIC_WS } from "./lib/synthetic-checks";
import { lookupModel } from "../src/domain/model/requirements";
const time = (run) => { run(); const xs = []; for (let i = 0; i < 9; i++) { const t = performance.now(); run(); xs.push(performance.now() - t); } xs.sort((a, b) => a - b); return { median: xs[4], fastest: xs[0], slowest: xs[8] }; };
window.benchChecks = () => {
  const p = prepare(synthetic(), SYNTHETIC_WS);
  return { lines: checksOf(p, null).checks.count, lookup: time(() => lookupModel(p.model)), checks: time(() => checksOf(p, null)) };
};
`;

async function main() {
  const bundle = await build({
    stdin: {
      contents: entry,
      resolveDir: path.resolve("scripts"),
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
    tsconfig: path.resolve("tsconfig.json"),
    logLevel: "error",
  });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><title>bench</title>");
    await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
    const r = await page.evaluate(() =>
      (
        window as unknown as {
          benchChecks: () => {
            lines: number;
            lookup: Record<string, number>;
            checks: Record<string, number>;
          };
        }
      ).benchChecks(),
    );
    const f = (x: Record<string, number>) =>
      `median ${x.median!.toFixed(1)} ms, fastest ${x.fastest!.toFixed(1)} ms, slowest ${x.slowest!.toFixed(1)} ms`;
    console.log(
      `Synthetic in Chromium ${browser.version()} (headless): ${r.lines} lines`,
    );
    console.log(`  lookup (the requirement index's): ${f(r.lookup)}`);
    console.log(`  checks and index, whole model: ${f(r.checks)} (no gate)`);
  } finally {
    await browser.close();
  }
}

void main();
