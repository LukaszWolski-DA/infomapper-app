// S3B-15 (a): the number of elements on “Performance test” at S1A-14's 100 % view (src:57 at 768, 300 on the screen)
// and at 30 % around the same point, frames expanded and all collapsed (`?diag=collapsed`). A count, not a frame rate:
// every element in the viewport costs paint and layerize time on each pan and zoom frame (slice 3a). Measurement build
// only (MEASURE_BUILD=production, after `npm run measure:build`); the normal e2e run leaves this file out
// (playwright.config.ts). The counts go to test-results/S3B-15-elements.json; with ELEMENTS_BASELINE=<that file from
// the previous tag> every count must equal the baseline's.
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

const OUT = path.resolve("test-results", "S3B-15-elements.json");

test("S3B-15 (a): elements in the viewport of “Performance test” at 100 % and 30 %, frames expanded and collapsed", async ({ page }) => {
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
  console.log("S3B-15 elements " + JSON.stringify(counts));
  const baseline = process.env.ELEMENTS_BASELINE;
  if (baseline) expect(counts).toEqual(JSON.parse(fs.readFileSync(baseline, "utf8")));
});
