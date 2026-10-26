// S7C-14 (answer F4): the canvas commits a classification toggle adds, against slice-07b's flag toggle. The same steps
// run on both tags: on slice-07b the column panel's flag buttons, on slice 7c the Classifications section's toggles
// ("Personal data" has no canvas mark on either; "Business key" draws the BK badge on the row). The page's dev counter
// `window.__imCanvasCommits` (slice 2c) is read before a click and once the screen is settled after it.
// Run on demand: COMMITS=1 npx playwright test e2e/slice-07c/S7C-14-commits.spec.ts (copy it into a slice-07b worktree
// for the other side); results in test-results/S7C-14-commits-<side>.json.

import fs from "node:fs";
import { expect, test } from "../slice-00/fixtures";
import { signInAs } from "../slice-00/helpers";
import { canvasUrl, loadModel, openCanvas } from "../slice-01a/helpers";

test.skip(!process.env.COMMITS, "a measurement: COMMITS=1");

const ROUNDS = 6;
const exact = (name: string) => new RegExp(`^${name}$`);

test("S7C-14: canvas commits of a classification toggle (slice 7c) or a flag toggle (slice-07b)", async ({ page }) => {
  test.setTimeout(180_000);
  const m = await loadModel();
  const table = m.sourceTables.find((t) => t.name === "customers")!;
  const segment = m.sourceColumns.find((c) => c.source_table_id === table.id && c.name === "segment")!;
  await signInAs(page, "Łukasz");
  await openCanvas(page, `${canvasUrl()}?row=${segment.id}`);
  await expect(page.getByTestId("panel-source-column").locator("h2")).toHaveText("segment");
  const old = (await page.getByTestId("flags-column").count()) > 0;
  const side = old ? "slice-07b" : "slice-07c";
  const button = (name: string) =>
    old ? page.getByTestId("flags-column").getByRole("button", { name, exact: true }) : page.getByTestId("section-classifications").getByTestId("toggle-classification").filter({ hasText: exact(name) });
  const commits = () => page.evaluate(() => (window as unknown as { __imCanvasCommits?: number }).__imCanvasCommits ?? 0);

  const result: Record<string, number[]> = {};
  for (const name of ["Personal data", "Business key"]) {
    const deltas: number[] = [];
    for (let i = 0; i < ROUNDS; i++) {
      const pressed = (await button(name).getAttribute("aria-pressed")) === "true";
      await page.waitForTimeout(1200);
      const before = await commits();
      await button(name).click();
      await expect(button(name)).toHaveAttribute("aria-pressed", String(!pressed));
      await page.waitForTimeout(1200);
      deltas.push((await commits()) - before);
    }
    result[name] = deltas;
  }
  // the BK badge on segment's row follows the last Business key toggle (an even number of rounds: off again)
  await expect(page.locator(`[data-row="${segment.id}"] .tag.bk`)).toHaveCount(0);
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync(`test-results/S7C-14-commits-${side}.json`, JSON.stringify({ side, rounds: ROUNDS, ...result }, null, 2));
  console.log(side, JSON.stringify(result));
});
