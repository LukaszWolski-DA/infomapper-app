// S6A-01 (slice 6a, items 1, 3, 4): each item makes its chip appear with the prototype's wording, order and count, and
// disappear when it is turned off elsewhere (the toolbar, the card's buttons, the block, the overview panel, Esc).
// Nothing on: no chips. A wide window, so no chip folds into “+{n}” (S6A-06 covers that).

import { expect, test } from "./fixtures";
import { AROUND, card, blockEl, chip, chipTexts, collapsedFrame, expectChips, openCanvas, canvasUrl, setCard, signInAs, viewBar, WHOLE_CO } from "./helpers";

test("S6A-01: chips appear in the prototype's order and wording and go when their item is turned off elsewhere", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 900 });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await expect(viewBar(page)).toBeAttached();
  expect(await chipTexts(page)).toEqual([]);
  await expect(page.getByTestId("button-view-show-all")).toHaveCount(0);

  // test data: two cards filtered, one collapsed, one frame (Sales Order and Order Line) collapsed
  await setCard("Customer", { rowFilter: "keys" });
  await setCard("web_users", { rowFilter: "mapped" });
  await setCard("customers", { collapsed: true });
  await collapsedFrame(AROUND.sales, { name: "Orders" });
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expectChips(page, ["2 cards filtered", "1 card collapsed", "1 frame collapsed"]);

  // the switches of the page: Focus, the layer, resolved notes hidden (overview panel), the Hand tool
  await page.getByTestId("button-focus").click();
  await page.locator('[data-testid="switch-layer"] [data-layer="mappings"]').click();
  await page.getByTestId("checkbox-show-resolved").uncheck();
  await page.getByTestId("button-tool-hand").click();
  await expectChips(page, ["Focus", "Mappings only", "2 cards filtered", "1 card collapsed", "1 frame collapsed", "Resolved notes hidden", "Hand tool"]);
  await expect(chip(page, "focus")).toHaveAttribute("title", "Everything not connected to the selection is faded");
  await expect(chip(page, "filtered")).toHaveAttribute("title", "Some rows of these cards are hidden by their row filter.");
  await expect(page.getByTestId("chip-focus-off")).toHaveAttribute("aria-label", "Remove Focus");

  // the Relationships layer and another tool reword their chips
  await page.locator('[data-testid="switch-layer"] [data-layer="relationships"]').click();
  await page.getByTestId("button-tool-entity").click();
  await expect(chip(page, "layer")).toHaveText(/^Relationships only/);
  await expect(chip(page, "tool")).toHaveText(/^Entity tool/);

  // turned off elsewhere, one by one
  await page.keyboard.press("Escape");
  await expect(chip(page, "tool")).toHaveCount(0);
  await page.getByTestId("button-focus").click();
  await expect(chip(page, "focus")).toHaveCount(0);
  await page.locator('[data-testid="switch-layer"] [data-layer="all"]').click();
  await expect(chip(page, "layer")).toHaveCount(0);
  await page.getByTestId("checkbox-show-resolved").check();
  await expect(chip(page, "notes-hidden")).toHaveCount(0);
  await card(page, "Customer").getByTestId("button-card-filter").click(); // keys → all
  await expect(chip(page, "filtered")).toHaveText(/^1 card filtered/);
  await card(page, "customers").getByTestId("button-card-collapse").click();
  await expect(chip(page, "collapsed-cards")).toHaveCount(0);
  await blockEl(page, "Orders").getByTestId("button-block-expand").click();
  await expectChips(page, ["1 card filtered"]);
});
