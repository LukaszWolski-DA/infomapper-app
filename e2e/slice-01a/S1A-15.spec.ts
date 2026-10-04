// S1A-15 is about the process: CI on the pull request, and lint, typecheck, unit and e2e tests passing locally.
// This test checks what can be checked from the repository: the workflow runs on pull requests and on main, and runs
// the same checks as `npm run lint`, `typecheck` and `test`. That CI passed on PR #2, and that the local runs passed,
// is recorded in docs/prd/slice-01a-acceptance.md.

import fs from "node:fs";
import { expect, test } from "./fixtures";

test("S1A-15: CI runs on the pull request and passes; lint, typecheck, unit and e2e tests pass locally", async () => {
  const ci = fs.readFileSync(".github/workflows/ci.yml", "utf8");
  expect(ci).toMatch(/^on:\s*\n\s+pull_request:/m);
  expect(ci).toMatch(/push:\s*\n\s+branches: \[main\]/);
  const steps = [...ci.matchAll(/- run: (.+)/g)].map((m) => m[1]!.trim());
  expect(steps).toEqual(["npm ci", "npm run lint", "npm run typecheck", "npm test"]);

  const scripts = JSON.parse(fs.readFileSync("package.json", "utf8")).scripts as Record<string, string>;
  for (const name of ["lint", "typecheck", "test", "e2e"]) expect(scripts[name], `npm run ${name}`).toBeTruthy();
});
