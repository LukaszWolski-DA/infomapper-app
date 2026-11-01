import { expect, test } from "./fixtures";
import { OM_HOME, place, signInAs, thumbnailHref, thumbnailOf } from "./helpers";

// S12B-03 (PRD P2, item 7): a new canvas's tile says "Empty canvas" and asks for no drawing; after a card is placed on
// it and the home is loaded again, it shows the card.

test("S12B-03: a new canvas says “Empty canvas”; after a card is placed it shows the card", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(OM_HOME);
  await page.getByTestId("tile-new-canvas").click();
  await page.waitForURL(/\/c\/[\w-]+/);
  const canvasId = /\/c\/([\w-]+)/.exec(page.url())![1]!;

  await page.goto(OM_HOME);
  const tile = page.getByTestId("tile-canvas").nth(2);
  await expect(tile.getByTestId("tile-thumbnail-empty")).toHaveText("Empty canvas");
  await expect(tile.getByTestId("tile-thumbnail-empty")).toHaveAttribute("aria-hidden", "true");
  expect(await thumbnailHref(tile)).toBeNull();

  await place("Customer", { x: 100, y: 100 }, canvasId);
  await page.reload();
  await expect(tile.getByTestId("tile-thumbnail")).toBeVisible();
  const t = (await thumbnailOf(page, tile))!;
  expect(t.rects.map((r) => r.kind)).toEqual(["entity"]);
});
