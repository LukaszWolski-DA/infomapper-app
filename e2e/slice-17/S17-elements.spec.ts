// S17-07's element count for the link handle (slice 17, PRD section 5, Z6): "Performance test – requirements" (12
// requirement cards) at 100 % and 30 %, as S3B-15 (a) counts "Performance test". The handle is one element per card
// drawn at full detail (≥ 40 %), none below and none for reviewers or readers; nothing else in this canvas changed in
// slice 17 with no frame selected, so slice 16's count is the viewport's minus the handles. Measurement build only
// (MEASURE_BUILD=production, after `npm run measure:build`); the normal e2e run leaves it out (playwright.config.ts).
// The counts go to test-results/S17-elements.json.

import fs from "node:fs";
import path from "node:path";
import { LARGE_IDS } from "../../src/data/local/seed-large";
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

const OUT = path.resolve("test-results", "S17-elements.json");

test("S17-07: elements and link handles in the viewport of “Performance test – requirements” at 100 % and 30 %", async ({ page }) => {
  test.setTimeout(240_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  const canvasId = (LARGE_IDS as Record<string, string>).canvasRequirements!;
  const counts: Record<string, { viewport: number; handles: number; slice16: number }> = {};
  for (const [name, zoom] of Object.entries({ "100": 1, "30": 0.3 })) {
    await page.goto("/sign-in");
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${canvasId}`, JSON.stringify({ x: 40, y: 40, zoom })] as const);
    await page.goto(canvasUrl(canvasId, LARGE_IDS.project, LARGE_IDS.workspace));
    await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    await page.waitForTimeout(2000);
    const c = await page.evaluate(() => {
      return {
        viewport: document.querySelectorAll(".react-flow__viewport *").length,
        handles: document.querySelectorAll(".react-flow__viewport .rq-lk").length,
      };
    });
    counts[`${name} %`] = { ...c, slice16: c.viewport - c.handles };
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(counts, null, 2));
  console.log("S17 elements " + JSON.stringify(counts));
  expect(counts["30 %"]!.handles).toBe(0);
});
