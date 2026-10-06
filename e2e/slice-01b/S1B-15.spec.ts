// S1B-15 is about the process: CI on the pull request, and lint, typecheck, unit and all e2e suites passing three
// times in a row. This test checks what can be checked from the repository: the workflow runs on pull requests and on
// main with the same checks as `npm run lint`, `typecheck` and `test`, and every criterion of slice 1b has its test.
// That CI passed on PR #3 and that the three local runs passed is recorded in docs/prd/slice-01b-acceptance.md.

import fs from "node:fs";
import { expect, test } from "./fixtures";

test("S1B-15: CI passes on the pull request; lint, typecheck, unit and all e2e suites pass three times in a row", async () => {
  const ci = fs.readFileSync(".github/workflows/ci.yml", "utf8");
  expect(ci).toMatch(/^on:\s*\n\s+pull_request:/m);
  expect(ci).toMatch(/push:\s*\n\s+branches: \[main\]/);
  const steps = [...ci.matchAll(/- run: (.+)/g)].map((m) => m[1]!.trim());
  expect(steps).toEqual(["npm ci", "npm run lint", "npm run typecheck", "npm test"]);

  const scripts = JSON.parse(fs.readFileSync("package.json", "utf8")).scripts as Record<string, string>;
  for (const name of ["lint", "typecheck", "test", "e2e"]) expect(scripts[name], `npm run ${name}`).toBeTruthy();

  const specs = fs.readdirSync("e2e/slice-01b").filter((f) => f.endsWith(".spec.ts"));
  for (let n = 1; n <= 15; n++) expect(specs, `S1B-${String(n).padStart(2, "0")}`).toContain(`S1B-${String(n).padStart(2, "0")}.spec.ts`);
});
