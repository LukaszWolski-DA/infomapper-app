// S4A-14 (elements): the number of elements in the viewport of “Performance test” at S1A-14's 100 % view and at 30 %,
// frames expanded and collapsed, must equal slice 3b's (`.data/measure/s4a14-baseline/slice-03b.json`, taken on
// `slice-03b` in step 0; another file with ELEMENTS_BASELINE). The same method as S3B-15-elements.spec.ts. Measurement
// build only (MEASURE_BUILD=production, after `npm run measure:build`); the normal e2e run leaves this file out.
import fs from "node:fs";
import path from "node:path";
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

const OUT = path.resolve("test-results", "S4A-14-elements.json");
const BASELINE = process.env.ELEMENTS_BASELINE ?? path.resolve(".data", "measure", "s4a14-baseline", "slice-03b.json");
/** Slice 4p: the overlay container (trial A) on top of slice 3b's counts. */
const OVERLAY_CONTAINER = 1;

test("S4A-14 (elements): the viewport of “Performance test” has as many elements as on slice-03b, at 100 % and 30 %, frames expanded and collapsed", async ({ page }) => {
  test.setTimeout(240_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  const src57 = generate().cards.find((c) => c.id === "src:57")!;
  const views = { "100": 1, "30": 0.3 } as const;
  const counts: Record<string, { page: number; viewport: number }> = {};
  for (const frames of ["expanded", "collapsed"] as const) {
    for (const [name, zoom] of Object.entries(views)) {
      await page.goto("/sign-in");
      const view = { x: 768 - src57.x * zoom, y: 300 - src57.y * zoom, zoom };
      await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
      await page.goto(canvasUrl(LARGE_IDS.canvas, LARGE_IDS.project, LARGE_IDS.workspace) + (frames === "collapsed" ? "?diag=collapsed" : ""));
      await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
      // the same settling time on every side: the canvas measures cards and notes after it is ready
      await page.waitForTimeout(2000);
      counts[`${name} %, ${frames}`] = await page.evaluate(() => ({
        page: document.querySelectorAll("*").length,
        viewport: document.querySelectorAll(".react-flow__viewport *").length,
      }));
    }
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(counts, null, 2));
  console.log("S4A-14 elements " + JSON.stringify(counts));
  // the viewport, as S3B-15 (a): the whole page also counts the panels and the tab bar
  const before = JSON.parse(fs.readFileSync(BASELINE, "utf8")) as typeof counts;
  const viewport = (c: typeof counts, plus = 0) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.viewport + plus]));
  // slice 4p (trial A, adopted): the overlay's container is one more element in the viewport in every view, empty while
  // nothing is hovered, selected or lassoed (Łukasz after step 1)
  expect(viewport(counts)).toEqual(viewport(before, OVERLAY_CONTAINER));
});
