// Slice 23, step 3: screenshots (runs only with SCREENS=<folder>, into docs/prd/slice-23-screens/<folder>/): the Metadata
// conventions tab (with an own classification with a code, one without, a definition and naming conventions), the remove
// dialog, Settings' "Model conventions" box and the language select at a workspace's creation; light and dark.
//
//   SCREENS=step-3 npx playwright test e2e/slice-23/S23-screens.spec.ts

import path from "node:path";
import { expect, test, type Page } from "./fixtures";
import { addOwn, hydrated, openConventions, rowOf, settingsTabUrl, typeAndLeave } from "./helpers";

const OUT = path.resolve("docs", "prd", "slice-23-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));

test.skip(!process.env.SCREENS, "screenshots only with SCREENS=<folder>");
test.use({ viewport: { width: 1440, height: 900 } });

async function start(page: Page, scheme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: scheme });
  await openConventions(page);
}

for (const scheme of ["light", "dark"] as const) {
  test(`S23 screens (${scheme}): the tab`, async ({ page }) => {
    await start(page, scheme);
    await addOwn(page, "column", "Hash candidate", "HASH");
    await expect(rowOf(page, "HASH")).toBeVisible();
    await addOwn(page, "table", "Golden source", "");
    await expect(page.getByTestId("section-table-classifications").getByTestId("chip-own")).toBeVisible();
    await typeAndLeave(rowOf(page, "HASH").getByTestId("input-classification-definition"), "A column whose hash identifies the row; a candidate for a hash key.");
    await typeAndLeave(page.getByTestId("input-naming-conventions"), "- Entities: singular, Title Case (Sales Order)\n- Attributes: snake_case (order_date)\n- Keys: …_id; surrogate keys: …_key");
    await expect(page.getByTestId("toast").last()).toBeVisible();
    await page.getByTestId("box-classifications").locator("h3").click(); // nothing focused
    // the page scrolls inside the shell: a window as tall as the tab, then the whole page
    const height = await page.getByTestId("page-conventions").evaluate((el) => Math.ceil(el.getBoundingClientRect().bottom + 80));
    await page.setViewportSize({ width: 1440, height });
    await expect(page.getByTestId("text-conventions-later")).toBeInViewport();
    await page.screenshot({ path: path.join(OUT, `tab-${scheme}.png`) });
  });

  test(`S23 screens (${scheme}): the remove dialog`, async ({ page }) => {
    await start(page, scheme);
    await rowOf(page, "PII").getByTestId("button-remove-classification").click();
    const dialog = page.getByTestId("dialog-remove-classification");
    await expect(dialog.getByTestId("form-remove-classification")).toBeVisible();
    await expect(dialog.getByTestId("button-confirm-remove-classification")).toBeEnabled();
    await page.screenshot({ path: path.join(OUT, `remove-${scheme}.png`) });
  });

  test(`S23 screens (${scheme}): Settings' Model conventions and the new workspace's language`, async ({ page }) => {
    await start(page, scheme);
    await page.goto(settingsTabUrl());
    await hydrated(page);
    await page.getByTestId("form-workspace-settings").screenshot({ path: path.join(OUT, `settings-${scheme}.png`) });
    await page.getByTestId("switcher-workspace").click();
    await expect(page.getByTestId("select-new-workspace-language")).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `new-workspace-${scheme}.png`), clip: { x: 0, y: 0, width: 640, height: 420 } });
  });
}
