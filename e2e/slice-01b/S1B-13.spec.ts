import { expect, test } from "./fixtures";
import { canvasUrl, card, expectToast, ids, LEFT_AT_100, loadModel, openCanvas, pointOnLine, rowNamed, signInAs } from "./helpers";

test("S1B-13: deleting a mapping or relationship is immediate with “Undo” in the toast; an attribute with mappings still asks for confirmation", async ({ page }) => {
  const { model, attribute, entity } = await ids();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), LEFT_AT_100);
  const toast = page.getByTestId("toast");

  // a mapping, from its panel: one click, gone; “Undo” brings it back
  const birth = model.mappings.find((m) => m.attribute_id === attribute("Customer", "birth_date").id)!;
  const mappingLive = async () => (await loadModel()).mappings.some((m) => m.id === birth.id);
  await rowNamed(page, "Customer", "birth_date").click();
  await page.getByTestId("list-attribute-mappings").getByRole("button").first().click();
  await page.getByTestId("button-delete-mapping").click();
  await expectToast(page, "Mapping deleted");
  await expect(toast.getByTestId("toast-action")).toHaveText("Undo");
  await expect.poll(mappingLive).toBe(false);
  await toast.getByTestId("toast-action").click();
  await expectToast(page, "Undone: Delete mapping");
  await expect.poll(mappingLive).toBe(true);
  await expect(page.getByTestId("layer-lines").locator(`[data-testid="line-mapping"][data-mapping="${birth.id}"]`)).toHaveCount(1);

  // a relationship, with Delete on its selected line
  const places = model.relationships.find((r) => r.from_entity_id === entity("Customer").id && r.to_entity_id === entity("Sales Order").id)!;
  const relLive = async () => (await loadModel()).relationships.some((r) => r.id === places.id);
  const line = page.getByTestId("layer-lines").locator(`[data-testid="line-relationship"][data-relationship="${places.id}"]`);
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 0.6 });
  const at = await pointOnLine(line, 0.3);
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId("panel-relationship")).toBeVisible();
  await page.keyboard.press("Delete");
  await expectToast(page, "Relationship deleted");
  await expect(toast.getByTestId("toast-action")).toHaveText("Undo");
  await expect.poll(relLive).toBe(false);
  await toast.getByTestId("toast-action").click();
  await expect.poll(relLive).toBe(true);

  // an attribute with mappings still asks: the first click arms the button, the second deletes
  const email = attribute("Customer", "email");
  const attrLive = async () => (await loadModel()).attributes.some((a) => a.id === email.id);
  await rowNamed(page, "Customer", "email").click();
  const del = page.getByTestId("button-delete-attribute");
  await del.click();
  await expect(del).toHaveAttribute("data-armed", "true");
  await expect(del).toHaveText("Click again to delete, with 2 mappings");
  expect(await attrLive()).toBe(true);
  await del.click();
  await expectToast(page, "Attribute deleted together with 2 mappings");
  await expect(toast.getByTestId("toast-action")).toHaveText("Undo");
  await expect.poll(attrLive).toBe(false);

  // without mappings it goes at once
  const segment = attribute("Customer", "segment_code");
  await card(page, "Customer").locator(`[data-row="${segment.id}"]`).click();
  await page.getByTestId("button-delete-attribute").click();
  await expectToast(page, "Attribute deleted");
  await expect.poll(async () => (await loadModel()).attributes.some((a) => a.id === segment.id)).toBe(false);
});
