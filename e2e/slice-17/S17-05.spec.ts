// S17-05 (slice 17, item 5, D-72): "Add attribute below" on Customer's second row puts the new attribute third, its
// panel open with the name selected; one undo removes it and the order is as before. Not on a table's column row.

import { expect, test, type Page } from "./fixtures";
import { attributeOrder, canvasUrl, expectToast, ids, openCanvas, row, signInAs, toolboxAt, undoButton, WHOLE_CO } from "./helpers";

const middle = async (page: Page, el: ReturnType<typeof row>) => {
  const b = (await el.boundingBox())!;
  return { x: b.x + Math.min(40, b.width / 2), y: b.y + b.height / 2 };
};

test("S17-05: “Add attribute below” on the second row inserts the third attribute; one undo restores the order; not on a table row", async ({ page }) => {
  const { entity, column } = await ids();
  const customer = entity("Customer");
  const before = await attributeOrder(customer.id);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { ...WHOLE_CO, zoom: 0.8 });

  const second = row(page, "Customer", before[1]!);
  const labels = await toolboxAt(page, await middle(page, second));
  // after the moves, before "Link to requirements…" and "Map from a column…"
  expect(labels.slice(labels.indexOf("Add attribute below"), labels.indexOf("Add attribute below") + 3)).toEqual([
    "Add attribute below",
    "Link to requirements…",
    "Map from a column…",
  ]);
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Add attribute below", exact: true }).click();
  const name = page.getByTestId("panel-attribute").getByTestId("input-attribute-name");
  await expect(name).toHaveValue("new_attribute");
  await expect(name).toBeFocused();
  await expect.poll(async () => (await attributeOrder(customer.id)).length).toBe(before.length + 1);
  const after = await attributeOrder(customer.id);
  expect(after.filter((id) => !before.includes(id))).toEqual([after[2]]);
  expect(after.filter((id) => before.includes(id))).toEqual(before);

  await name.press("Escape");
  await undoButton(page).click();
  await expectToast(page, "Undone: Create attribute");
  await expect.poll(() => attributeOrder(customer.id)).toEqual(before);

  // a table's column row has no such item
  const colLabels = await toolboxAt(page, await middle(page, row(page, "customers", column("customers", "email_addr").id)));
  expect(colLabels).not.toContain("Add attribute below");
  expect(colLabels).toContain("Link to requirements…");
});
