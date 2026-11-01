// Slice 12b, step 4: screenshots of the canvas tiles beside the prototype's (runs only with SCREENS=<folder>, into
// docs/prd/slice-12b-screens/<folder>/), each in light and dark mode: the seed's project home (Order management), an
// empty canvas, a collapsed frame (Order lines & products), a live canvas (CR-23's, in Customer 360), the workspace
// home (P8) and "Performance test"'s project home; the prototype's project home and workspace home (its own demo).
//
//   SCREENS=step-4 npx playwright test e2e/slice-12b/S12B-screens.spec.ts

import path from "node:path";
import { pathToFileURL } from "node:url";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB } from "../config";
import { expect, test, type Page } from "./fixtures";
import { collapse, makeFrame, OL, OM_HOME, openLiveFor, projectHome, signInAs, WS_HOME } from "./helpers";

const OUT = path.resolve("docs", "prd", "slice-12b-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));
const PROTOTYPE = pathToFileURL(path.resolve("docs", "prototype", "infomapper-prototype-with-sources.html")).href;
const SCHEMES = ["light", "dark"] as const;

test.use({ viewport: { width: 1536, height: 864 } });
test.skip(!process.env.SCREENS, "screenshots only with SCREENS=<folder>");

/** The tiles of a home page, once every drawing has arrived. */
async function tiles(page: Page, testId: string, name: string) {
  const grid = page.getByTestId(testId);
  await expect(grid).toBeVisible();
  await page.waitForLoadState("networkidle");
  await grid.scrollIntoViewIfNeeded();
  await grid.screenshot({ path: path.join(OUT, `${name}.png`) });
}

/** Every scheme of one app page's tiles. */
async function app(page: Page, url: string, testId: string, name: string) {
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(url);
    await tiles(page, testId, `${name}-${scheme}`);
  }
}

test("S12B screens: the tiles (seed, empty canvas, collapsed frame, live canvas, workspace home, Performance test) and the prototype's, light and dark", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  // the prototype: its project home (Customer 360's canvases) and its workspace home
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(PROTOTYPE);
    await page.waitForTimeout(800);
    await page.evaluate(() => (0, eval)("goHome")());
    await page.waitForTimeout(300);
    await page.locator("#home .tiles").screenshot({ path: path.join(OUT, `prototype-project-home-${scheme}.png`) });
    await page.evaluate(() => {
      const V = (0, eval)("V") as { wsHome: boolean };
      V.wsHome = true;
      (0, eval)("rebuild")();
    });
    await page.waitForTimeout(300);
    await page.locator(".tiles:visible").first().screenshot({ path: path.join(OUT, `prototype-workspace-home-${scheme}.png`) });
  }

  await signInAs(page, "Łukasz");
  await app(page, OM_HOME, "tiles-canvases", "seed-order-management");
  await app(page, WS_HOME, "tiles-projects", "workspace-home");

  // an empty canvas, then a collapsed frame on Order lines & products
  await page.goto(OM_HOME);
  await page.getByTestId("tile-new-canvas").click();
  await page.waitForURL(/\/c\/[\w-]+/);
  const frameId = await makeFrame({ x: 20, y: 0, width: 800, height: 300 }, { name: "Top row", canvasId: OL });
  await collapse(frameId);
  await app(page, OM_HOME, "tiles-canvases", "empty-canvas-and-collapsed-frame");

  // a live canvas
  await openLiveFor("CR-23");
  await app(page, projectHome(), "tiles-canvases", "live-canvas");

  // "Performance test"
  await seedLargeData(E2E_DB);
  await app(page, `/w/${LARGE_IDS.workspace}/p/${LARGE_IDS.project}`, "tiles-canvases", "performance-test");
});
