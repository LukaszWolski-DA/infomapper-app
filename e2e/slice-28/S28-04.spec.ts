// S28-04 (slice 28, item 1): up to 1,100 px wide the editor keeps its stacked layout (no overlay as the canvas's): no
// handles, and a hidden panel is not shown there either; above it the side-by-side layout comes back.

import { expect, test } from "./fixtures";
import { expectPanel, openDocument, optionsToggle, sectionsToggle, signInAs } from "./helpers";

test("S28-04: up to 1,100 px the layout stacks, without handles; a hidden panel is not shown", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 850 });
  await signInAs(page, "Łukasz");
  await openDocument(page);
  await expect(page.getByTestId("handle-left")).toBeHidden();
  await expect(page.getByTestId("handle-right")).toBeHidden();
  // stacked: the options panel under the sections and the preview, the whole width
  const right = page.getByTestId("editor-right");
  await expect(right).toBeVisible();
  const box = (await right.boundingBox())!;
  expect(Math.round(box.width)).toBeGreaterThan(1000);

  await optionsToggle(page).click();
  await expect(optionsToggle(page)).toHaveAttribute("aria-pressed", "false");
  await expect(right).toBeHidden();
  await sectionsToggle(page).click();
  await expect(page.getByTestId("editor-left")).toBeHidden();
  // the preview takes the whole width
  const mid = (await page.getByTestId("document-pages").boundingBox())!;
  expect(Math.round(mid.width)).toBeGreaterThan(1000);

  // wider than 1,100 px: side by side again, both still hidden as chosen
  await page.setViewportSize({ width: 1400, height: 850 });
  await expectPanel(page, "left", false);
  await expectPanel(page, "right", false);
  await sectionsToggle(page).click();
  await optionsToggle(page).click();
  await expectPanel(page, "left", true, 264);
  await expectPanel(page, "right", true, 340);
});
