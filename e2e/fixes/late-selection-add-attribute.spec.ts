import { expect, test, type Page } from "../slice-16/fixtures";
import { canvasUrl, card, headOf, hydrated, loadModel, openCanvas, signInAs, toolboxAt, WHOLE_CO } from "../slice-16/helpers";
import { holdUntil } from "../slice-13/helpers";

// fix/late-selection-remaining (the S15-24 entry's list, known-limitations.md): "Add attribute" in a card header's menu
// selected the new row, opened the details panel and focused its name when its answer arrived, whatever had been
// selected by then. The answer is held until another card has been clicked, so the click always comes first.

const headPoint = async (page: Page, cardName: string) => {
  const b = (await headOf(page, cardName).boundingBox())!;
  return { x: b.x + Math.min(30, b.width / 2), y: b.y + b.height / 2 };
};
const attributesOf = async (entityId: string) => (await loadModel()).attributes.filter((a) => a.entity_id === entityId && a.deleted_at === null);
const nameFields = "[data-testid=input-attribute-name], [data-testid=input-entity-name]";

test("a card clicked while 'Add attribute' is on its way stays selected, and no name is focused", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  const customer = (await loadModel()).entities.find((e) => e.name === "Customer")!;
  const before = await attributesOf(customer.id);

  const hold = await holdUntil(page, customer.id);
  await toolboxAt(page, await headPoint(page, "Customer"));
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Add attribute", exact: true }).click();
  await expect.poll(() => hold.held()).toBe(true);
  await card(page, "Sales Order").getByTestId("card-name").click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Sales Order");

  hold.release();
  await hold.given;
  // the answer has been applied: the attribute is stored and its row drawn on Customer's card
  await expect.poll(async () => (await attributesOf(customer.id)).length).toBe(before.length + 1);
  await expect(card(page, "Customer").locator("[data-row]").filter({ hasText: "new_attribute" })).toBeVisible();
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Sales Order");
  await expect(page.getByTestId("panel-attribute")).toHaveCount(0);
  await expect(page.locator(nameFields).and(page.locator(":focus"))).toHaveCount(0);
});

test("'Add attribute' selects the new row, opens its panel and focuses its name when nothing was clicked meanwhile", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await toolboxAt(page, await headPoint(page, "Customer"));
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Add attribute", exact: true }).click();
  const name = page.getByTestId("panel-attribute").getByTestId("input-attribute-name");
  await expect(name).toHaveValue("new_attribute");
  await expect(name).toBeFocused();
});
