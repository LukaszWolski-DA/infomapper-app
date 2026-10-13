import { expect, test } from "./fixtures";
import { canvasUrl, card, contextOn, dragTo, expectToast, ids, labelNamed, lastGroup, linkedTo, loadModel, openCanvas, rowNamed, signInAs, undo } from "./helpers";

test("S3B-02: with CR-23 on, creating an entity, adding an attribute, renaming an attribute, creating a mapping by drag, changing a mapping's rule and drawing a relationship each label what they created or changed (relationship: both entities) in the same undo step; one Ctrl+Z takes change and label away; every change event of the group has the context", async ({ page }) => {
  test.setTimeout(180_000);
  const cr23 = (await labelNamed("CR-23"))!;
  const { attribute, entity } = await ids();
  const expectContextOnGroup = async () => {
    const group = await lastGroup();
    expect(group.length).toBeGreaterThan(0);
    expect(group.every((e) => e.context_label_id === cr23.id), "every event of the group carries CR-23").toBe(true);
  };
  await signInAs(page, "Łukasz");
  await contextOn(page, "CR-23");
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 1 });
  await expect(page.getByTestId("button-context")).toContainText("Working on CR-23");

  // renaming an attribute labels it, in the same undo step; one undo takes name and label away
  const customerId = attribute("Customer", "customer_id");
  expect(await linkedTo("CR-23")).not.toContain(customerId.id);
  await rowNamed(page, "Customer", "customer_id").click();
  const name = page.getByTestId("input-attribute-name");
  await name.fill("customer_key");
  await name.press("Enter");
  await expect.poll(() => linkedTo("CR-23")).toContain(customerId.id);
  await expectContextOnGroup();
  await undo(page);
  await expect.poll(async () => (await loadModel()).attributes.find((a) => a.id === customerId.id)!.name).toBe("customer_id");
  await expect.poll(() => linkedTo("CR-23")).not.toContain(customerId.id);

  // adding an attribute labels the new attribute
  await card(page, "Customer").getByTestId("card-name").click();
  await page.getByTestId("button-add-attribute").click();
  const added = page.getByTestId("input-attribute-name");
  await added.fill("promo_code");
  await added.press("Enter");
  await expect.poll(async () => (await loadModel()).attributes.some((a) => a.name === "promo_code")).toBe(true);
  const promo = (await loadModel()).attributes.find((a) => a.name === "promo_code")!;
  await expect.poll(() => linkedTo("CR-23")).toContain(promo.id);

  // a mapping made by drag is labeled
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 1 });
  await dragTo(page, rowNamed(page, "customers", "segment"), rowNamed(page, "Customer", "segment_code"));
  await expectToast(page, "Mapped customers.segment to Customer.segment_code");
  const code = attribute("Customer", "segment_code");
  const made = (await loadModel()).mappings.find((m) => m.attribute_id === code.id)!;
  await expect.poll(() => linkedTo("CR-23")).toContain(made.id);
  await expectContextOnGroup();

  // changing a mapping's rule labels the mapping
  const first = (await loadModel()).mappings.find((m) => m.attribute_id === attribute("Customer", "first_name").id)!;
  expect(await linkedTo("CR-23")).not.toContain(first.id);
  await rowNamed(page, "Customer", "first_name").click();
  await page.getByTestId("list-attribute-mappings").getByRole("button").first().click();
  const panel = page.getByTestId("panel-mapping");
  await panel.getByTestId("seg-mapping-kind").getByRole("button", { name: "Transformation" }).click();
  const rule = panel.getByTestId("input-mapping-rule");
  await rule.fill("TRIM(fname)");
  await rule.blur();
  await expect.poll(() => linkedTo("CR-23")).toContain(first.id);
  await expectContextOnGroup();

  // drawing a relationship labels both entities (Customer carries CR-23 already: no second link)
  const salesOrder = entity("Sales Order");
  expect(await linkedTo("CR-23")).not.toContain(salesOrder.id);
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 0.6 });
  await card(page, "Customer").getByTestId("button-card-relate").click();
  await card(page, "Sales Order").getByTestId("card-name").click();
  await expect.poll(() => linkedTo("CR-23")).toContain(salesOrder.id);
  expect((await linkedTo("CR-23")).filter((id) => id === entity("Customer").id)).toHaveLength(1);
  await expectContextOnGroup();

  // the Entity tool's new entity is labeled
  await openCanvas(page, canvasUrl(), { x: 0, y: -900, zoom: 1 });
  const area = (await page.locator(".react-flow__pane").boundingBox())!;
  await page.getByTestId("button-tool-entity").click();
  await page.mouse.click(area.x + 300, area.y + 200);
  const entityName = page.getByTestId("input-entity-name");
  await expect(entityName).toBeFocused();
  await entityName.fill("Loyalty Card");
  await entityName.press("Enter");
  await expect.poll(async () => (await loadModel()).entities.some((e) => e.name === "Loyalty Card")).toBe(true);
  const loyalty = (await loadModel()).entities.find((e) => e.name === "Loyalty Card")!;
  await expect.poll(() => linkedTo("CR-23")).toContain(loyalty.id);
});
