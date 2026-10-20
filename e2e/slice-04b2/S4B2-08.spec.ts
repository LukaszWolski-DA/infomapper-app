// S4B2-08 (slice 4b-2, PRD item 23): a requirement opened from the project home opens the project canvas that shows most
// of it (the entities and tables of its scope there, plus one for its card), ties to the earlier canvas in the project's
// order (not the last opened one), with the requirement selected (its panel and its coverage colours).
// “Order management” has “Customer & orders” first and “Order lines & products” second.

import { expect, test, type Page } from "./fixtures";
import { canvasUrl, linkReq, loadModel, openCanvas, placeReqCards, RETAIL, SEED_IDS, signInAs } from "./helpers";

const home = `/w/${RETAIL}/p/${SEED_IDS.projOrderManagement}`;

async function openFromHome(page: Page, key: string) {
  await page.goto(home);
  await page.getByTestId("item-project-requirement").filter({ hasText: key }).click();
  await expect(page.getByTestId("input-req-key")).toHaveValue(key);
}

test("S4B2-08: the project home opens the canvas that shows most of a requirement, ties by project order, a card counts; the requirement selected", async ({ page }) => {
  test.setTimeout(120_000);
  const model = await loadModel();
  const product = model.entities.find((e) => e.name === "Product")!;
  const items = model.sourceTables.find((t) => t.name === "items")!;
  // test data: REQ-102 (three attributes of Customer) also on Product and items, both only on “Order lines & products”;
  // REQ-103 (Customer's email) also on items
  await linkReq("REQ-102", { kind: "entity", id: product.id });
  await linkReq("REQ-102", { kind: "source_table", id: items.id });
  await linkReq("REQ-103", { kind: "source_table", id: items.id });
  await signInAs(page, "Łukasz");
  // “Order lines & products” is the last opened canvas of the project from here on
  await openCanvas(page, canvasUrl(SEED_IDS.canvasOrderLines, SEED_IDS.projOrderManagement));

  // REQ-102: 2 on “Order lines & products” (Product, items) against 1 (Customer): opens there, selected
  await openFromHome(page, "REQ-102");
  await expect(page).toHaveURL(new RegExp(`/c/${SEED_IDS.canvasOrderLines}`));
  await expect(page.getByTestId("layer-coverage-headers")).toHaveCount(1);

  // REQ-103: 1 against 1 (Customer; items): a tie goes to the earlier canvas, not the last opened one
  await openCanvas(page, canvasUrl(SEED_IDS.canvasOrderLines, SEED_IDS.projOrderManagement));
  await openFromHome(page, "REQ-103");
  await expect(page).toHaveURL(new RegExp(`/c/${SEED_IDS.canvasCustomerOrders}`));
  await expect(page.locator('[data-testid^="layer-coverage"]').first()).toBeAttached();

  // its card on “Order lines & products” counts one: 2 against 1, it opens there
  await placeReqCards([{ key: "REQ-103", x: 40, y: 720 }], SEED_IDS.canvasOrderLines);
  await openFromHome(page, "REQ-103");
  await expect(page).toHaveURL(new RegExp(`/c/${SEED_IDS.canvasOrderLines}`));
  // selecting the requirement is selecting its card (item 5): the card carries the selection mark
  await expect(page.locator('[data-testid="card-requirement"][data-key="REQ-103"]')).toBeVisible();
  await expect(page.getByTestId("mark-selected-requirement")).toHaveCount(1);
});
