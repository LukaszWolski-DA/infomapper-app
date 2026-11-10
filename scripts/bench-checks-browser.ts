// The model checks in a browser (slice 20, step 2; Łukasz's step 2 decisions): what a canvas page computes after a
// write (the checks' items, the marks and one canvas's count; a reference of 25 ms, not a gate, since slice 20's closing), the lookup and the cube index apart, bundled with esbuild and run in headless
// Chromium on the synthetic model of `bench-checks.ts`. One warm-up, then 9 rounds; median, fastest, slowest.
// Run: npx tsx scripts/bench-checks-browser.ts

import { build } from "esbuild";
import path from "node:path";
import { chromium } from "playwright";

const entry = `
import { cubeOf, homeOf, marksOf, prepare } from "./lib/checks-model";
import { synthetic, SYNTHETIC_WS } from "./lib/synthetic-checks";
import { lookupModel } from "../src/domain/model/requirements";
import { checkIndex, infoMapperGroups, modelChecks } from "../src/domain/model/checks";
import { cubeModuleChecks } from "../src/compose/checks";
const time = (run) => { run(); const xs = []; for (let i = 0; i < 9; i++) { const t = performance.now(); run(); xs.push(performance.now() - t); } xs.sort((a, b) => a - b); return { median: xs[4], fastest: xs[0], slowest: xs[8] }; };
window.benchChecks = () => {
  const p = prepare(synthetic(), SYNTHETIC_WS);
  const canvas = new Set(p.model.entities.slice(0, 40).map((e) => e.id));
  const input = { model: p.model, lookup: p.lookup, scope: null };
  const checks = modelChecks(input, cubeModuleChecks(p.on, p.rows, input, p.cube));
  const entityOf = (id) => p.lookup.attribute.get(id)?.entity_id;
  const index = checkIndex(checks, entityOf);
  const split = {
    "InfoMapper's rules": time(() => infoMapperGroups(input)),
    "InfoCube's rules (cube index passed)": time(() => cubeModuleChecks(p.on, p.rows, input, p.cube)),
    "the marks (checkIndex)": time(() => checkIndex(checks, entityOf)),
    "one canvas's count (countOn)": time(() => index.countOn(canvas)),
  };
  return { split, lines: marksOf(p, canvas).checks.count, lookup: time(() => lookupModel(p.model)), cube: time(() => cubeOf(p.model, p.rows)), marks: time(() => marksOf(p, canvas)), home: time(() => homeOf(p, null)) };
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
            split: Record<string, Record<string, number>>;
            lookup: Record<string, number>;
            cube: Record<string, number>;
            marks: Record<string, number>;
            home: Record<string, number>;
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
    console.log(`  cube index (the page's sections', apart): ${f(r.cube)}`);
    console.log(`  marks and counts (a canvas after a write): ${f(r.marks)}; reference 25.0 ms (not a gate) ${r.marks.median! <= 25 ? "within" : "above"}`);
    console.log(`  every line with its words (no bar here): ${f(r.home)}`);
    for (const [part, x] of Object.entries(r.split)) console.log(`    split: ${part}: ${f(x)}`);
  } finally {
    await browser.close();
  }
}

void main();
