// S27-09's element counts (slice 27, step 4, Q6): S3B-15 (a)'s four views of "Performance test" with InfoDocumenter on,
// the page outline off and on (A4 landscape at 7 pt). Off must equal the baseline's counts (no element); on, the counts
// are reported (the layer and one element per page). Measurement build only, on demand:
//   npm run measure:build && MEASURE=1 MEASURE_BUILD=production ELEMENTS_BASELINE=.data/measure/s9-14-baseline/slice-08.json npx playwright test e2e/slice-27/S27-09-elements.spec.ts
import fs from "node:fs";
import path from "node:path";
import { readDb, writeDb } from "../../src/data/local/file";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { E2E_DB } from "../config";
import { expect, test } from "../slice-01a/fixtures";
import { canvasUrl, signInAs } from "../slice-01a/helpers";

test.use({
  channel: "chrome",
  headless: false,
  viewport: { width: 1536, height: 864 },
  launchOptions: { args: ["--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"] },
});

const OUT = path.resolve("test-results", "S27-09-elements.json");

test("S27-09: elements on Performance test with the page outline off and on", async ({ page }) => {
  test.skip(!process.env.MEASURE, "MEASURE=1 only");
  test.setTimeout(480_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  const src57 = generate().cards.find((c) => c.id === "src:57")!;
  const all: Record<string, Record<string, { page: number; viewport: number; pages: number }>> = {};
  for (const outline of ["off", "on"] as const) {
    const db = await readDb(E2E_DB);
    db.workspace.find((w) => w.id === LARGE_IDS.workspace)!.infodoc = true;
    const canvas = db.canvas.find((c) => c.id === LARGE_IDS.canvas)!;
    const { pageOutline: _drop, ...look } = canvas.look;
    void _drop;
    canvas.look = outline === "on" ? { ...look, pageOutline: { paper: "A4", orientation: "landscape", pt: 7 } } : look;
    await writeDb(E2E_DB, db);
    const counts: (typeof all)[string] = {};
    for (const frames of ["expanded", "collapsed"] as const) {
      for (const [name, zoom] of Object.entries({ "100": 1, "30": 0.3 })) {
        await page.goto("/sign-in");
        const view = { x: 768 - src57.x * zoom, y: 300 - src57.y * zoom, zoom };
        await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
        await page.goto(canvasUrl(LARGE_IDS.canvas, LARGE_IDS.project, LARGE_IDS.workspace) + (frames === "collapsed" ? "?diag=collapsed" : ""));
        await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
        await page.waitForTimeout(2000);
        counts[`${name} %, ${frames}`] = await page.evaluate(() => ({
          page: document.querySelectorAll("*").length,
          viewport: document.querySelectorAll(".react-flow__viewport *").length,
          pages: document.querySelectorAll('[data-testid="page-outline-page"]').length,
        }));
      }
    }
    all[outline] = counts;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(all, null, 2));
  console.log("S27-09 elements " + JSON.stringify(all));
  const baseline = process.env.ELEMENTS_BASELINE;
  if (baseline) {
    const before = JSON.parse(fs.readFileSync(baseline, "utf8")) as Record<string, { viewport: number }>;
    expect(Object.fromEntries(Object.entries(all.off!).map(([k, v]) => [k, v.viewport]))).toEqual(Object.fromEntries(Object.entries(before).map(([k, v]) => [k, v.viewport])));
  }
  for (const [k, v] of Object.entries(all.on!)) expect(v.viewport, k).toBe(all.off![k]!.viewport + 1 + v.pages);
});
