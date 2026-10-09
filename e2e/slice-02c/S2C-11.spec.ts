// S2C-11 is about unit tests: the bundle grouping and the line ends at a block are pure functions in
// src/canvas/line-geometry.ts, tested in line-geometry.test.ts. This test checks that those tests are there and pass.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { expect, test } from "./fixtures";

const FILE = "src/canvas/line-geometry.test.ts";

test("S2C-11: unit tests cover the bundle grouping and the line ends at a block", async () => {
  test.setTimeout(120_000);
  const source = fs.readFileSync(FILE, "utf8");
  // what the PRD asks the unit tests to cover (rules for the domain and data)
  for (const covered of [
    /one bundle per attribute/, // grouping keys
    /a group of one keeps its mapping/, // single-mapping identity
    /both ends in the same collapsed frame are not drawn/, // same-frame lines left out
    /layer mode applies/, // layer mode
    /two collapsed frames: one bundle per direction/, // both ends collapsed
    /relationship bundles are undirected/, // relationship bundles
    /the middle of the block's facing side/, // the line end at a block
    /counts distinct mappings/,
  ]) {
    expect(source, String(covered)).toMatch(covered);
  }
  const run = spawnSync("npx", ["vitest", "run", FILE], { encoding: "utf8", shell: true });
  // without the colours of vitest's report
  const out = `${run.stdout}\n${run.stderr}`.replace(/\x1b\[[0-9;]*m/g, "");
  expect(run.status, out).toBe(0);
  expect(out).toMatch(/Tests\s+\d+ passed/);
});
