import { clickVisible } from "../canvas-click";
import { expect, test } from "../slice-16/fixtures";
import { canvasUrl, card, hydrated, loadModel, openCanvas, signInAs, treeItem, viewportTransform, WHOLE_CO } from "../slice-16/helpers";
import { holdUntil } from "../slice-13/helpers";

// fix/late-selection-canvas (the S15-24 entry's list, known-limitations.md): a card placed from the left panel
// (`placeAt`) selected its card and moved the view to it when its answer arrived, whatever had been selected by then.
// The answer is held until another card has been clicked, so the click always comes first.

test("a card clicked while a card placed from the left panel is on its way stays selected, and the view stays", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  const items = (await loadModel()).sourceTables.find((t) => t.name === "items")!;
  await page.getByTestId("tab-sources").click();
  await expect(treeItem(page, "items")).not.toHaveAttribute("data-presence", "here");

  const hold = await holdUntil(page, items.id);
  await treeItem(page, "items").click();
  await expect.poll(() => hold.held()).toBe(true);
  await clickVisible(card(page, "Sales Order").getByTestId("card-name"));
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Sales Order");
  const view = await viewportTransform(page);

  hold.release();
  await hold.given;
  // the answer has been applied: its toast shows and the card is drawn
  await expect(page.getByTestId("toast")).toContainText("Added 1 source table to the canvas.");
  await expect(card(page, "items")).toBeVisible();
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Sales Order");
  await expect(page.getByTestId("panel-source-table")).toHaveCount(0);
  expect(await viewportTransform(page)).toEqual(view);
});

test("a card placed from the left panel is selected when nothing was clicked meanwhile", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await page.getByTestId("tab-sources").click();
  await treeItem(page, "items").click();
  await expect(card(page, "items")).toBeVisible();
  await expect(page.getByTestId("panel-source-table")).toBeVisible();
  await expect(page.getByTestId("panel-source-table")).toContainText("items");
});
