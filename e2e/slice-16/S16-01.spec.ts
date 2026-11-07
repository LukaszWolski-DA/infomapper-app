// S16-01 (slice 16, item 1, D-71): Customer's header menu shows "Add attribute" right after "Relate to itself", and
// directly before "Paste attribute" when the clipboard holds one; it adds `new_attribute`, opens its panel with the
// name selected for typing, and one undo removes it. The same on a dimension's card (InfoCube on, the Sales star).

import { test as starTest } from "../slice-15a/fixtures";
import { expect, test, type Page } from "./fixtures";
import { canvasUrl, copyRow, entityIdOf, headOf, loadModel, openCanvas, signInAs, STAR_VIEW, starUrl, toolboxAt, undoButton, WHOLE_CO } from "./helpers";

const headPoint = async (page: Page, cardName: string) => {
  const b = (await headOf(page, cardName).boundingBox())!;
  return { x: b.x + Math.min(30, b.width / 2), y: b.y + b.height / 2 };
};
const attributesOf = async (entityId: string) => (await loadModel()).attributes.filter((a) => a.entity_id === entityId && a.deleted_at === null);

/** The attribute panel's name field holds `new_attribute`, focused and selected whole. */
async function expectNameSelected(page: Page) {
  const name = page.getByTestId("panel-attribute").getByTestId("input-attribute-name");
  await expect(name).toHaveValue("new_attribute");
  await expect(name).toBeFocused();
  await expect.poll(() => name.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, "new_attribute".length]);
}

test("S16-01: Customer's header menu adds an attribute with its name selected; one undo removes it", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const customer = (await loadModel()).entities.find((e) => e.name === "Customer")!;
  const before = await attributesOf(customer.id);

  const labels = await toolboxAt(page, await headPoint(page, "Customer"));
  expect(labels[labels.indexOf("Relate to itself") + 1]).toBe("Add attribute");
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Add attribute", exact: true }).click();
  await expectNameSelected(page);
  await expect.poll(async () => (await attributesOf(customer.id)).length).toBe(before.length + 1);
  const added = (await attributesOf(customer.id)).find((a) => !before.some((b) => b.id === a.id))!;
  expect(added).toMatchObject({ name: "new_attribute", sort_order: Math.max(...before.map((a) => a.sort_order)) + 1 });

  // one undo step
  await page.getByTestId("panel-attribute").getByTestId("input-attribute-name").press("Escape");
  await undoButton(page).click();
  await expect.poll(async () => (await attributesOf(customer.id)).map((a) => a.id)).toEqual(before.map((a) => a.id));

  // with an attribute in the clipboard: directly before "Paste attribute"
  await copyRow(page, "Sales Order", "order_date");
  const withPaste = await toolboxAt(page, await headPoint(page, "Customer"));
  expect(withPaste.slice(withPaste.indexOf("Add attribute"), withPaste.indexOf("Add attribute") + 2)).toEqual(["Add attribute", "Paste attribute “order_date”"]);
});

starTest("S16-01: a dimension's header menu adds an attribute the same way", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, starUrl(), STAR_VIEW);
  const dim = entityIdOf("cust");
  const before = await attributesOf(dim);
  const labels = await toolboxAt(page, await headPoint(page, "Dim Customer"));
  expect(labels).toContain("Add attribute");
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Add attribute", exact: true }).click();
  await expectNameSelected(page);
  await expect.poll(async () => (await attributesOf(dim)).length).toBe(before.length + 1);
});
