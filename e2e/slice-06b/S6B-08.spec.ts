// S6B-08 (slice 6b, item 11; Łukasz's step 1 answer 7): Alt+←/→ go back and forward on a canvas and on a home page,
// one step per press; in a text field the app leaves the keys to the browser (Playwright's keys do not reach the
// browser's own shortcut, so the page stays); on a focused side panel grip Alt+← goes back and does not resize the panel.

import { expect, test } from "./fixtures";
import { altArrow, canvasUrl, expectAt, grip, openCanvas, panelWidth, projectPath, SEED_IDS, signInAs, WHOLE_CO } from "./helpers";

test("S6B-08: Alt+←/→ walk the history outside text fields, one step per press", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await page.getByTestId("breadcrumb").filter({ hasText: "Customer 360" }).click();
  await expectAt(page, projectPath());

  // on a home page and on the canvas, one step each
  await altArrow(page, "ArrowLeft");
  await expectAt(page, new RegExp(`/c/${SEED_IDS.canvasCustomerOrders}$`));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await altArrow(page, "ArrowRight");
  await expectAt(page, projectPath());
  await altArrow(page, "ArrowLeft");
  await expectAt(page, new RegExp(`/c/${SEED_IDS.canvasCustomerOrders}$`));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");

  // in a text field: the app does not navigate
  await page.getByTestId("input-tree-search").focus();
  await page.keyboard.press("Alt+ArrowRight");
  await page.waitForTimeout(500);
  await expectAt(page, new RegExp(`/c/${SEED_IDS.canvasCustomerOrders}$`));

  // a focused grip: Alt+→ goes forward, the panel keeps its width
  await grip(page, "left").focus();
  await page.keyboard.press("Alt+ArrowRight");
  await expectAt(page, projectPath());
  await altArrow(page, "ArrowLeft");
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  expect(await panelWidth(page, "left")).toBe(264);
});
