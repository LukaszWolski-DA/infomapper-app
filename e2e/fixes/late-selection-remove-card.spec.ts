import { expect, test, type Page } from "../slice-16/fixtures";
import { canvasUrl, card, headOf, hydrated, loadItems, loadModel, openCanvas, signInAs, toolboxAt, WHOLE_CO } from "../slice-16/helpers";
import { holdUntil } from "../slice-13/helpers";

// fix/late-selection-canvas (the S15-24 entry's list, known-limitations.md): "Remove from this canvas" (`remove`) cleared
// the selection when its answer arrived, whatever had been selected by then. The answer is held until another card has
// been clicked, so the click always comes first.

const headPoint = async (page: Page, cardName: string) => {
  const b = (await headOf(page, cardName).boundingBox())!;
  return { x: b.x + Math.min(30, b.width / 2), y: b.y + b.height / 2 };
};
const customerItem = async () => {
  const customer = (await loadModel()).entities.find((e) => e.name === "Customer")!;
  return (await loadItems()).find((i) => i.entity_id === customer.id && i.deleted_at === null)!;
};
const removeCustomer = async (page: Page) => {
  await toolboxAt(page, await headPoint(page, "Customer"));
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Remove from this canvas", exact: true }).click();
};

test("a card clicked while 'Remove from this canvas' is on its way stays selected", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  const item = await customerItem();
  await card(page, "Customer").getByTestId("card-name").click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Customer");

  const hold = await holdUntil(page, item.id);
  await removeCustomer(page);
  await expect.poll(() => hold.held()).toBe(true);
  await card(page, "Sales Order").getByTestId("card-name").click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Sales Order");

  hold.release();
  await hold.given;
  // the answer has been applied: its toast shows and the card is gone
  await expect(page.getByTestId("toast")).toContainText("Removed from this canvas.");
  await expect(card(page, "Customer")).toHaveCount(0);
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Sales Order");
});

test("'Remove from this canvas' clears the selection of the removed card when nothing was clicked meanwhile", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await card(page, "Customer").getByTestId("card-name").click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Customer");
  await removeCustomer(page);
  await expect(card(page, "Customer")).toHaveCount(0);
  await expect(page.getByTestId("panel-entity")).toHaveCount(0);
});
