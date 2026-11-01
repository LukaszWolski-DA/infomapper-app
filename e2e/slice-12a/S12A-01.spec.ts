import { expect, test } from "./fixtures";
import { box, canvasUrl, card, expectToast, moveCardUp, openCanvas, projectHome, redoButton, signInAs, undoButton, WS_HOME, yOf } from "./helpers";

// S12A-01 (items 1, 3, 4): the project home and the workspace home show the top bar's Undo and Redo, on the person's
// history of the workspace; a step made on a canvas is undone there and its toast names the canvas (F16).

const VIEW = { x: 0, y: 0, zoom: 0.7 };

test("S12A-01: Undo and Redo on both homes undo a card's move made on a canvas; disabled with nothing to undo", async ({ page }) => {
  await signInAs(page, "Łukasz");
  // nothing to undo yet: both disabled, on both homes, and no other tool in the bar
  for (const home of [WS_HOME, projectHome()]) {
    await page.goto(home);
    await expect(undoButton(page)).toBeDisabled();
    await expect(redoButton(page)).toBeDisabled();
    await expect(page.getByTestId("bar-tools").getByRole("button")).toHaveCount(2);
  }

  await openCanvas(page, canvasUrl(), VIEW);
  const startBox = await box(card(page, "Sales Order").locator("[data-card]"));
  const moved = await moveCardUp(page, "Sales Order");
  const movedY = await yOf(moved.id);

  // the project home undoes and redoes it
  await page.goto(projectHome());
  await expect(undoButton(page)).toBeEnabled();
  await undoButton(page).click();
  await expectToast(page, "Undone: Move card on Customer & orders");
  await expect.poll(() => yOf(moved.id)).toBe(moved.y);
  await expect(redoButton(page)).toBeEnabled();
  await redoButton(page).click();
  await expectToast(page, "Redone: Move card on Customer & orders");
  await expect.poll(() => yOf(moved.id)).toBe(movedY);

  // so does the workspace home
  await page.goto(WS_HOME);
  await undoButton(page).click();
  await expectToast(page, "Undone: Move card on Customer & orders");
  await expect.poll(() => yOf(moved.id)).toBe(moved.y);
  await expect(undoButton(page)).toBeDisabled();
  await expect(redoButton(page)).toBeEnabled();

  // the canvas shows the result
  await openCanvas(page, canvasUrl(), VIEW);
  await expect.poll(async () => Math.abs((await box(card(page, "Sales Order").locator("[data-card]"))).y - startBox.y)).toBeLessThan(1);
});
