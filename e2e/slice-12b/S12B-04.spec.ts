import { expect, test } from "./fixtures";
import { canvasUrl, expectToast, moveCardUp, openCanvas, projectHome, signInAs, thumbnailHref, thumbnailOf, tileOf, undoButton, yOf } from "./helpers";

// S12B-04 (PRD P5, item 11; D-65): move a card on a canvas, open the project home, press Undo there: the thumbnail
// shows the card at its old place. The drawing's key is its address, so the old drawing comes back at its old address.

const VIEW = { x: 0, y: 0, zoom: 0.7 };

test("S12B-04: after Undo on the project home the thumbnail shows the card at its old place", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(projectHome());
  const tile = tileOf(page, "Customer & orders");
  const before = await thumbnailHref(tile);
  const beforeShapes = (await thumbnailOf(page, tile))!;

  await openCanvas(page, canvasUrl(), VIEW);
  const moved = await moveCardUp(page, "Sales Order");
  await page.goto(projectHome());
  const after = await thumbnailHref(tile);
  expect(after).not.toBe(before);
  expect((await thumbnailOf(page, tile))!.rects).not.toEqual(beforeShapes.rects);

  await undoButton(page).click();
  await expectToast(page, "Undone: Move card on Customer & orders");
  await expect.poll(() => yOf(moved.id)).toBe(moved.y);
  await expect.poll(() => thumbnailHref(tile)).toBe(before);
  expect((await thumbnailOf(page, tile))!.rects).toEqual(beforeShapes.rects);
});
