// S6B-04 (slice 6b, item 6; Łukasz's step 1 answer 4; D-54): going back to a selection never opens the details panel
// when it is hidden; an item off screen is centred at the same zoom; one on screen leaves the view as it is (±1 px).

import { expect, test } from "./fixtures";
import { backButton, canvasUrl, cardAt, clickCard, expectHidden, expectSelected, forwardButton, openCanvas, signInAs, togglePanel, viewportTransform, WHOLE_CO } from "./helpers";

test("S6B-04: Back to a selection keeps a hidden details panel hidden, centres an item off screen, leaves one on screen", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await togglePanel(page, "right");
  await expectHidden(page, "right");

  await clickCard(page, "Customer");
  await expectSelected(page, "entity:Customer");
  await clickCard(page, "Sales Order");
  await expectSelected(page, "entity:Sales Order");

  // pan everything off screen, then Back to Customer: centred, at the same zoom
  const pane = (await page.locator(".react-flow__pane").boundingBox())!;
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
  await page.mouse.wheel(4000, 3000);
  await expect.poll(async () => (await viewportTransform(page)).x).toBeLessThan(-1500);
  const zoom = (await viewportTransform(page)).zoom;
  await backButton(page).click();
  await expectSelected(page, "entity:Customer");
  await expect
    .poll(async () => {
      const b = (await page.locator(".react-flow__node").filter({ has: page.getByTestId("card-name").getByText("Customer", { exact: true }) }).boundingBox())!;
      return Math.abs(b.x + b.width / 2 - (pane.x + pane.width / 2)) < 2;
    })
    .toBe(true);
  expect((await viewportTransform(page)).zoom).toBe(zoom);
  await expectHidden(page, "right");

  // Forward to Sales Order, on screen now: the view stays
  const view = await viewportTransform(page);
  const at = await cardAt(page, "Sales Order");
  await forwardButton(page).click();
  await expectSelected(page, "entity:Sales Order");
  await page.waitForTimeout(400);
  const now = await viewportTransform(page);
  expect(Math.abs(now.x - view.x) + Math.abs(now.y - view.y)).toBeLessThanOrEqual(1);
  expect(Math.abs((await cardAt(page, "Sales Order")).x - at.x)).toBeLessThanOrEqual(1);
  await expectHidden(page, "right");
});
