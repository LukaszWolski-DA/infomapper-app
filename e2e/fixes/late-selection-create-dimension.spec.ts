import { clickVisible } from "../canvas-click";
import { expect, test } from "../slice-15c/fixtures";
import { card, cardMenuItem, hydrated, liveEntityNamed, openStar, signInAs } from "../slice-15c/helpers";
import { viewportTransform } from "../slice-05a/helpers";
import { holdUntil } from "../slice-13/helpers";

// fix/late-selection-remaining (the S15-24 entry's list, known-limitations.md): "Create dimension from this…" selected
// the new dimension's card and centred the view on it when its answer arrived, whatever had been selected by then. The
// dialog is modal, so only a dialog closed with Escape while the create is on its way lets a click reach the canvas.
// The answer is held until another card has been clicked, so the click always comes first.

test("a card clicked after Escape while 'Create dimension' is on its way stays selected, and the view stays", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);

  const hold = await holdUntil(page, '"attributeIds"');
  await (await cardMenuItem(page, "Product", "Create dimension from this…")).click();
  const dialog = page.getByTestId("dialog-create-dimension");
  await dialog.getByTestId("button-create-dimension").click();
  await expect.poll(() => hold.held()).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await clickVisible(card(page, "Fact Sales").getByTestId("card-name"));
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Fact Sales");
  const view = await viewportTransform(page);

  hold.release();
  await hold.given;
  // the answer has been applied: the dimension is stored and its card drawn
  await expect.poll(async () => (await liveEntityNamed("Dim Product 2"))?.model_level).toBe("dimensional");
  await expect(card(page, "Dim Product 2")).toBeVisible();
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Fact Sales");
  expect(await viewportTransform(page)).toEqual(view);
});

test("'Create dimension' selects the new dimension's card when nothing was clicked meanwhile", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await (await cardMenuItem(page, "Product", "Create dimension from this…")).click();
  await page.getByTestId("dialog-create-dimension").getByTestId("button-create-dimension").click();
  await expect(card(page, "Dim Product 2")).toBeVisible();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Dim Product 2");
});
