// Slice 24, step 3: screenshots (runs only with SCREENS=<folder>, into docs/prd/slice-24-screens/<folder>/): the
// Metadata conventions tab's Entity stereotypes box (Link renamed and defined, an own one with its code), its remove
// dialog for a used own one, and the entity panel's select with the definition under it; light and dark.
//
//   SCREENS=step-3 npx playwright test e2e/slice-24/S24-screens.spec.ts

import path from "node:path";
import { expect, test, type Page } from "./fixtures";
import { addStereotype, box, canvasUrl, expectToast, hydrated, openCanvas, openConventions, openEntityFromTree, setStereotypeAs, stDefinition, stName, stRow, typeAndLeave } from "./helpers";

const OUT = path.resolve("docs", "prd", "slice-24-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));

test.skip(!process.env.SCREENS, "screenshots only with SCREENS=<folder>");
test.use({ viewport: { width: 1440, height: 900 } });

async function withOwn(page: Page, scheme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: scheme });
  await openConventions(page);
  await addStereotype(page, "Event", "business_event");
  await expectToast(page, "Stereotype “Event” added (business_event).");
  await setStereotypeAs("Customer", "business_event");
  await setStereotypeAs("Sales Order", "business_event");
  await page.reload();
  await hydrated(page);
}

for (const scheme of ["light", "dark"] as const) {
  test(`S24 screens (${scheme}): the box`, async ({ page }) => {
    await withOwn(page, scheme);
    await typeAndLeave(stName(stRow(page, "link")), "Association");
    await expectToast(page, "Renamed to Association; entities keep the stereotype.");
    await typeAndLeave(stDefinition(stRow(page, "business_event")), "Something that happens to an object at a point in time, e.g. a payment.");
    await expectToast(page, "Saved the definition of Event.");
    await page.getByTestId("input-new-stereotype").fill("Agreement");
    await box(page).locator("h3").click(); // nothing focused
    await expect(page.getByTestId("input-new-stereotype-code")).toHaveValue("agreement");
    await box(page).scrollIntoViewIfNeeded();
    await box(page).screenshot({ path: path.join(OUT, `box-${scheme}.png`) });
  });

  test(`S24 screens (${scheme}): the remove dialog`, async ({ page }) => {
    await withOwn(page, scheme);
    await stRow(page, "business_event").getByTestId("button-remove-stereotype").click();
    const dialog = page.getByTestId("dialog-remove-stereotype");
    await expect(dialog.getByTestId("button-confirm-remove-stereotype")).toHaveText("Remove and move 2 entities");
    // the dialog fades in: shoot once its and its overlay's animations are done
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
    await page.screenshot({ path: path.join(OUT, `remove-${scheme}.png`) });
  });

  test(`S24 screens (${scheme}): the entity panel's select and definition`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openConventions(page);
    await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 0.5 });
    await openEntityFromTree(page, "Order Line");
    await expect(page.getByTestId("text-entity-stereotype-definition")).toBeVisible();
    await page.getByTestId("panel-entity").screenshot({ path: path.join(OUT, `panel-${scheme}.png`) });
  });
}
