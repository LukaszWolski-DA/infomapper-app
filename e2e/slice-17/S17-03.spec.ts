// S17-03 (slice 17, item 3, D-72): Customer's card collapsed on the canvas: a click on the hit "attribute email" in the
// object browser's search expands it (one undo step "Show row"), centres it and selects the row with its panel; Back
// returns. Not on the canvas: Country's card is placed and its row selected. A hit on the entity's name is unchanged.

import { expect, test, type Page } from "./fixtures";
import { backButton, canvasUrl, card, expectToast, ids, item, openCanvas, selected, setCard, signInAs, undoButton, WHOLE_CO } from "./helpers";

const search = async (page: Page, q: string) => {
  await page.getByTestId("tab-model").click();
  await page.getByTestId("input-tree-search").fill(q);
};
const hit = (page: Page, name: string) => page.getByTestId("tree-item").filter({ has: page.getByText(name, { exact: true }) });
const attributeShown = (page: Page) => page.getByTestId("panel-attribute").getByTestId("input-attribute-name");

test("S17-03: a found attribute of a collapsed card opens it, selects the row with its panel, one undo step; Back returns", async ({ page }) => {
  const { attribute } = await ids();
  const email = attribute("Customer", "email");
  await setCard("Customer", { collapsed: true });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await expect(card(page, "Customer").locator(`[data-row="${email.id}"]`)).toHaveCount(0);

  await search(page, "email");
  await expect(hit(page, "Customer")).toContainText("attribute email");
  await hit(page, "Customer").click();
  await expect(attributeShown(page)).toHaveValue("email");
  await expect(card(page, "Customer").locator(`[data-row="${email.id}"]`)).toBeVisible();
  await expect.poll(async () => (await item("Customer")).collapsed).toBe(false);

  // Back returns to what was selected before (nothing)
  await backButton(page).click();
  await expect.poll(() => selected(page)).toBe("none");

  // one undo step closes the card again
  await undoButton(page).click();
  await expectToast(page, "Undone: Show row");
  await expect.poll(async () => (await item("Customer")).collapsed).toBe(true);
});

test("S17-03: a row filter that hides the row is reset; a filter that shows it stays", async ({ page }) => {
  const { attribute } = await ids();
  await setCard("Customer", { rowFilter: "keys" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  // customer_id is a key: the filter shows it and stays
  await search(page, "customer_id");
  await hit(page, "Customer").click();
  await expect(attributeShown(page)).toHaveValue("customer_id");
  expect((await item("Customer")).row_filter).toBe("keys");
  // birth_date is not: the filter goes back to All
  await search(page, "birth_date");
  await hit(page, "Customer").click();
  await expect(attributeShown(page)).toHaveValue("birth_date");
  await expect.poll(async () => (await item("Customer")).row_filter).toBe("all");
  await expect(card(page, "Customer").locator(`[data-row="${attribute("Customer", "birth_date").id}"]`)).toBeVisible();
});

test("S17-03: an entity not on the canvas is placed and its row selected; a hit on the name is unchanged", async ({ page }) => {
  const { attribute } = await ids();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);

  await search(page, "country_name");
  await expect(hit(page, "Country")).toContainText("attribute country_name");
  await hit(page, "Country").click();
  await expect(attributeShown(page)).toHaveValue("country_name");
  await expect(card(page, "Country").locator(`[data-row="${attribute("Country", "country_name").id}"]`)).toBeVisible();

  // a hit on the name selects the card, as before
  await search(page, "Sales Order");
  await hit(page, "Sales Order").click();
  await expect.poll(() => selected(page)).toBe("entity:Sales Order");
});
