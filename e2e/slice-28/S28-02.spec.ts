// S28-02 (slice 28, item 1, F1, F8, D-83): selecting a section keeps a hidden options panel hidden; a double-click on a
// section, in the preview or in the list, shows it at its top and its first control of any kind takes the focus (a
// check box and a segment button count; never Heading at the panel's end); "Fit width" follows a
// toggle and a drag by scaling the pages, with no new layout (F1: the app scales, it does not lay the pages out again).

import { expect, test } from "./fixtures";
import { expectPanel, layouts, openDocument, optionsToggle, rowOfType, sectionsToggle, signInAs, zoomOf } from "./helpers";

test("S28-02: a selection keeps the options panel hidden; a double-click shows it with its first field focused", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const doc = await openDocument(page);
  await optionsToggle(page).click();
  await expectPanel(page, "right", false);

  // a click in the list or in the preview selects, and the panel stays hidden
  await rowOfType(page, "s2t").click();
  await expect(rowOfType(page, "s2t")).toHaveAttribute("aria-current", "true");
  const sources = doc.sections.find((s) => s.type === "sources")!;
  await page.locator(`[data-testid="document-host"] [data-sec="${sources.id}"] h2`).first().click();
  await expect(rowOfType(page, "sources")).toHaveAttribute("aria-current", "true");
  await expectPanel(page, "right", false);

  // a double-click in the preview shows it; Diagrams' first control is its first figure's box
  const diagrams = doc.sections.find((s) => s.type === "diagrams")!;
  await page.locator(`[data-testid="document-host"] [data-sec="${diagrams.id}"] h2`).first().dblclick();
  await expectPanel(page, "right", true, 340);
  await expect(page.locator('[data-testid="panel-section"][data-section="diagrams"]')).toBeVisible();
  await expect(page.getByTestId("check-figure-on").first()).toBeFocused();
  expect(await page.getByTestId("editor-right").evaluate((el) => el.scrollTop)).toBe(0);

  // hidden again, a double-click in the list shows it too (the prototype's); Source tables' first control is a check box,
  // not its Heading
  await optionsToggle(page).click();
  await expectPanel(page, "right", false);
  await rowOfType(page, "sources").dblclick();
  await expectPanel(page, "right", true, 340);
  await expect(page.getByTestId("check-sources-tableClassifications")).toBeFocused();
  await expect(page.getByTestId("input-section-heading")).not.toBeFocused();
});

test("S28-02: Fit width follows a toggle and a drag by scaling the pages, without a new layout", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openDocument(page);
  const n = await layouts(page);
  const fit = await zoomOf(page);
  expect(fit).toBeLessThanOrEqual(1);

  // narrower: a wider sections panel; the scale goes down
  await page.getByTestId("handle-left").focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(() => zoomOf(page)).toBeLessThan(fit);
  const narrow = await zoomOf(page);
  // wider: both panels hidden; the scale goes up (up to 1)
  await sectionsToggle(page).click();
  await optionsToggle(page).click();
  await expect.poll(() => zoomOf(page)).toBeGreaterThan(narrow);
  // both shown again: narrower, the scale back where it was
  await sectionsToggle(page).click();
  await optionsToggle(page).click();
  await expect.poll(() => zoomOf(page)).toBe(narrow);
  // no layout was started by any of it
  expect(await layouts(page)).toBe(n);
  await expect(page.getByTestId("document-pages")).toHaveAttribute("data-state", "done");
});
