// Slice 14b, step 3: screenshots (runs only with SCREENS=<folder>, into docs/prd/slice-14b-screens/<folder>/): a canvas's
// tab after a refused rename, with the conflict line, with "Not saved", and read-only after the archive ("Not saved. You
// can still copy it."), each in light and dark.
//
//   SCREENS=step-3 npx playwright test e2e/slice-14b/S14B-screens.spec.ts

import path from "node:path";
import { expect, test, type Page } from "./fixtures";
import { archive, canvasUrl, changeCanvasLookElsewhere, conflictLine, hydrated, notSaved, openCanvas, renameCanvasElsewhere, renameInTab, renamingTab, SEED_IDS, signInAs, startRename } from "./helpers";

const OUT = path.resolve("docs", "prd", "slice-14b-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));
const CO = SEED_IDS.canvasCustomerOrders;

test.skip(!process.env.SCREENS, "screenshots only with SCREENS=<folder>");

/** The tab bar's left part with the tab and its line, and a strip of the canvas below. */
async function tabShot(page: Page, name: string) {
  await page.mouse.move(5, 500); // no hover on the tabs
  const bar = (await page.getByTestId("tabs-canvases").boundingBox())!;
  const tab = (await renamingTab(page).boundingBox())!;
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: { x: bar.x, y: bar.y - 8, width: Math.min(bar.width, tab.x + tab.width + 160 - bar.x), height: bar.height + 48 } });
}

async function start(page: Page, scheme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: scheme });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await hydrated(page);
}

for (const scheme of ["light", "dark"] as const) {
  test(`S14B screens (${scheme}): the conflict line inside the tab`, async ({ page }) => {
    await start(page, scheme);
    await renameCanvasElsewhere(CO, "Customers and their orders (Anna)");
    await renameInTab(page, "Customer & orders", "Customers and orders, mine");
    await expect(conflictLine(renamingTab(page))).toBeVisible();
    await tabShot(page, `tab-conflict-${scheme}`);
  });

  test(`S14B screens (${scheme}): Not saved inside the tab`, async ({ page }) => {
    await start(page, scheme);
    await changeCanvasLookElsewhere(CO, { grid: "lines" });
    await renameInTab(page, "Customer & orders", "Customers renamed");
    await expect(notSaved(renamingTab(page))).toHaveText("Not saved");
    await tabShot(page, `tab-not-saved-${scheme}`);
  });

  test(`S14B screens (${scheme}): read-only after the archive`, async ({ page }) => {
    await start(page, scheme);
    const field = await startRename(page, "Customer & orders");
    await archive();
    await field.fill("Archived name");
    await field.press("Enter");
    await expect(notSaved(renamingTab(page))).toHaveText("Not saved. You can still copy it.");
    await tabShot(page, `tab-read-only-${scheme}`);
  });
}
