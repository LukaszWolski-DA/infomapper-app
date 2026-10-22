// S6B-05 (slice 6b, item 6): across canvases. A card selected on Customer & orders, then another project's canvas, then
// Back twice: Customer & orders at its remembered view, with the card selected.

import { expect, test } from "./fixtures";
import { backButton, canvasUrl, clickCard, expectAt, expectSelected, openCanvas, projectPath, SEED_IDS, signInAs, viewportTransform, WHOLE_CO } from "./helpers";

test("S6B-05: Back across canvases opens the canvas at its remembered view, with its selection", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await clickCard(page, "Customer");
  await expectSelected(page, "entity:Customer");
  const view = await viewportTransform(page);

  // another project and its canvas
  await page.getByTestId("switcher-project").click();
  await page.getByTestId("menu-item-project").filter({ hasText: "Order management" }).click();
  await expectAt(page, projectPath(SEED_IDS.projOrderManagement));
  await page.getByTestId("tile-canvas").filter({ hasText: "Order lines & products" }).click();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expectAt(page, new RegExp(`/c/${SEED_IDS.canvasOrderLines}$`));

  await backButton(page).click();
  await expectAt(page, projectPath(SEED_IDS.projOrderManagement));
  await backButton(page).click();
  await expectAt(page, new RegExp(`/c/${SEED_IDS.canvasCustomerOrders}$`));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expectSelected(page, "entity:Customer");
  const now = await viewportTransform(page);
  expect(Math.abs(now.x - view.x) + Math.abs(now.y - view.y)).toBeLessThanOrEqual(1);
  expect(now.zoom).toBeCloseTo(view.zoom, 5);
});
