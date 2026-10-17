// Slice 4b-1, step 6: screenshots of the coverage colours (runs only with SCREENS=<folder>, into
// docs/prd/slice-04b1-screens/<folder>/). On “Customer & orders”: REQ-105 (three covered rows and the gap birth_date) and
// REQ-101 (an entity item: Customer's header) at 100 %, beside the prototype's lens, and at 30 % (the summary dot, item
// 19); a frame around Customer and Sales Order collapsed, at 100 % and 30 % (the dot on the block's rows). On
// “Performance test”: REQ-102 (46 attributes of four entities) at 30 %.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { seedLargeData } from "../../src/data/local/dev-data";
import { generate } from "../../src/data/local/large-generator";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB } from "../config";
import { expect, test, type Page } from "./fixtures";
import { AROUND, collapsedFrame } from "../slice-02c/helpers";
import { canvasUrl, openCanvas, openRequirement, signInAs } from "./helpers";

const OUT = path.resolve("docs", "prd", "slice-04b1-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));
const PROTOTYPE = pathToFileURL(path.resolve("docs", "prototype", "infomapper-model-prototype.html")).href;

test.use({ viewport: { width: 1536, height: 864 } });

/** The prototype with a requirement selected (its lens), at a view. */
async function prototypeLens(page: Page, view: { x: number; y: number; zoom: number }, key: string) {
  await page.goto(PROTOTYPE);
  await page.waitForTimeout(800);
  await page.evaluate(() => (0, eval)("openCanvasFromHome")("dia_main"));
  await page.waitForTimeout(300);
  await page.evaluate(
    ([v, key]) => {
      const V = (0, eval)("V") as { zoom: number; px: number; py: number; sel: unknown };
      const S = (0, eval)("S") as { requirements: { id: string; key: string }[] };
      V.zoom = v.zoom;
      V.px = v.x;
      V.py = v.y;
      V.sel = { t: "req", id: S.requirements.find((r) => r.key === key)!.id };
      (0, eval)("rebuild")();
      (0, eval)("applyT")();
    },
    [view, key] as const,
  );
  await page.waitForTimeout(400);
}

test("S4B1-06 screenshots: coverage colours at 100 % and 30 %, cards and a collapsed frame's block", async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(OUT, { recursive: true });
  const shot = (name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
  await signInAs(page, "Łukasz");

  // 100 %, around Customer: REQ-105's rows, then REQ-101's header
  const near = { x: -380, y: 20, zoom: 1 };
  await openCanvas(page, canvasUrl(), near);
  for (const key of ["REQ-105", "REQ-101"]) {
    await openRequirement(page, key);
    await expect(page.locator('[data-testid^="coverage-"]').first()).toBeAttached();
    await page.waitForTimeout(400);
    await shot(`demo-${key.toLowerCase()}-100-app`);
  }
  await prototypeLens(page, near, "REQ-105");
  await shot("demo-req-105-100-prototype");

  // 30 %: the summary dots, REQ-105 and REQ-101
  const far = { x: 40, y: 40, zoom: 0.3 };
  await openCanvas(page, canvasUrl(), far);
  for (const key of ["REQ-105", "REQ-101"]) {
    await openRequirement(page, key);
    await expect(page.locator('[data-testid^="coverage-dot-"]').first()).toBeAttached();
    await page.waitForTimeout(300);
    await shot(`demo-${key.toLowerCase()}-30`);
  }

  // a frame around Customer and Sales Order, collapsed: REQ-105's dot on Customer's row, at 100 % and 30 %
  await collapsedFrame(AROUND.customerAndSales, { name: "Customer and orders" });
  for (const [view, name] of [[near, "100"], [far, "30"]] as const) {
    await openCanvas(page, canvasUrl(), view);
    await openRequirement(page, "REQ-105");
    await expect(page.locator('[data-testid^="coverage-block-dot-"]').first()).toBeAttached();
    await page.waitForTimeout(300);
    await shot(`demo-req-105-${name}-collapsed`);
  }

  // “Performance test”, 30 % around ent:19 (REQ-102: 46 attributes of ent:3, ent:4, ent:7 and ent:19)
  await seedLargeData(E2E_DB);
  const e19 = generate().cards.find((c) => c.id === "ent:19")!;
  await openCanvas(page, canvasUrl(LARGE_IDS.canvas, LARGE_IDS.project, LARGE_IDS.workspace), { x: 466 - (e19.x + 128) * 0.3, y: 360 - (e19.y + 200) * 0.3, zoom: 0.3 });
  await openRequirement(page, "REQ-102");
  await expect(page.locator('[data-testid^="coverage-dot-"]').first()).toBeAttached();
  await page.waitForTimeout(300);
  await shot("perf-req-102-30");
});
