// S2C-13 is about the process: CI on the pull request, and lint, typecheck, unit and all e2e suites passing three
// times in a row. This test checks what can be checked from the repository: the workflows run on pull requests with
// the same checks as `npm run lint`, `typecheck` and `test`, the schema check runs, and every criterion of slice 2c
// that is tested here has its test (S2C-12 is a measurement round, recorded in docs/prd/slice-02c-acceptance.md).

import fs from "node:fs";
import { expect, test } from "./fixtures";

test("S2C-13: CI passes; lint, typecheck, unit and all e2e suites pass three times in a row", async () => {
  const ci = fs.readFileSync(".github/workflows/ci.yml", "utf8");
  expect(ci).toMatch(/^on:\s*\n\s+pull_request:/m);
  const steps = [...ci.matchAll(/- run: (.+)/g)].map((m) => m[1]!.trim());
  expect(steps).toEqual(["npm ci", "npm run lint", "npm run typecheck", "npm test"]);
  expect(fs.readFileSync(".github/workflows/schema.yml", "utf8")).toMatch(/pull_request/);

  const scripts = JSON.parse(fs.readFileSync("package.json", "utf8")).scripts as Record<string, string>;
  for (const name of ["lint", "typecheck", "test", "e2e", "measure:canvas"]) expect(scripts[name], `npm run ${name}`).toBeTruthy();

  const specs = fs.readdirSync("e2e/slice-02c").filter((f) => f.endsWith(".spec.ts"));
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13]) {
    const id = `S2C-${String(n).padStart(2, "0")}`;
    expect(specs, id).toContain(`${id}.spec.ts`);
  }
});
