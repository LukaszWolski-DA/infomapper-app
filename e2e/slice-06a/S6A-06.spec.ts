// S6A-06 (slice 6a, item 2; Łukasz's step 1 answer 3): the breadcrumbs row keeps its height (32 px) and a card stays
// where it is on the screen (±1 px) while chips appear, fold into “+{n}” and go. In the default 1,280 px window with
// both panels shown the four chips do not all fit: the last ones fold, and “+{n}”'s menu removes one with its ×.

import { expect, test } from "./fixtures";
import { breadcrumbsRow, canvasUrl, cardAt, chip, chipTexts, expectCardAt, expectChips, openCanvas, signInAs, viewBar, WHOLE_CO } from "./helpers";

test("S6A-06: the row's height and a card's place stay while chips appear, fold into “+{n}” and go", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const at = await cardAt(page, "Customer");
  const height = async () => Math.round((await breadcrumbsRow(page).boundingBox())!.height);
  expect(await height()).toBe(32);

  await page.getByTestId("button-focus").click();
  await page.locator('[data-testid="switch-layer"] [data-layer="mappings"]').click();
  await page.getByTestId("checkbox-show-resolved").uncheck();
  await page.getByTestId("button-tool-hand").click();

  // some chips folded: the ones shown come first in order, “+{n}” counts the rest
  const more = chip(page, "more");
  await expect(more).toBeVisible();
  const order = ["Focus", "Mappings only", "Resolved notes hidden", "Hand tool"];
  const shown = await chipTexts(page);
  const folded = order.length - (shown.length - 1);
  expect(folded).toBeGreaterThan(0);
  expect(shown).toEqual([...order.slice(0, order.length - folded), `+${folded}`]);
  expect(await height()).toBe(32);
  await expectCardAt(page, "Customer", at);
  // nothing in the row reaches past its right end
  const row = (await breadcrumbsRow(page).boundingBox())!;
  const bar = (await viewBar(page).boundingBox())!;
  expect(bar.x + bar.width).toBeLessThanOrEqual(row.x + row.width);

  // “+{n}”'s menu lists the folded chips; the last one's × removes it
  await more.click();
  const items = page.getByTestId("menu-chips-more").getByTestId("menu-item-chip");
  await expect(items).toHaveCount(folded);
  await expect(items.last()).toHaveAttribute("data-chip", "tool");
  await items.last().click();
  await expect(page.getByTestId("button-tool-hand")).toHaveAttribute("aria-pressed", "false");

  // all off: no chips, the same height and place
  await page.getByTestId("button-focus").click();
  await page.locator('[data-testid="switch-layer"] [data-layer="all"]').click();
  await page.getByTestId("checkbox-show-resolved").check();
  await expectChips(page, []);
  expect(await height()).toBe(32);
  await expectCardAt(page, "Customer", at);
});
