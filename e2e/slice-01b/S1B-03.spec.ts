import { updateAttribute } from "../../src/domain/commands/attribute";
import { expect, test, type Page } from "./fixtures";
import { asLukasz, canvasUrl, card, dragTo, expectToast, ids, loadModel, openCanvas, rowNamed, signInAs } from "./helpers";

test("S1B-03: dropping order_line.price on the Order Line header creates attribute price (decimal with the column's precision and scale) and a direct mapping", async ({ page }) => {
  const { entity, column } = await ids();
  const line = entity("Order Line"), price = column("order_line", "price");
  await signInAs(page, "Łukasz");
  // Order Line (840, 568) and order_line (1176, 600) in view at 100%
  await openCanvas(page, canvasUrl(), { x: -640, y: -480, zoom: 1 });

  await dragTo(page, rowNamed(page, "order_line", "price"), card(page, "Order Line").locator(".c-head"));
  await expectToast(page, "Added price to Order Line, mapped from order_line.price. Rename it on the right.");

  const model = await loadModel();
  const attr = model.attributes.find((a) => a.entity_id === line.id && a.name === "price")!;
  expect(attr).toMatchObject({ data_type: "decimal", type_precision: 10, type_scale: 2 });
  const mapping = model.mappings.filter((m) => m.attribute_id === attr.id);
  expect(mapping).toHaveLength(1);
  expect(mapping[0]!.kind).toBe("direct");
  expect(model.mappingInputs.filter((i) => i.mapping_id === mapping[0]!.id).map((i) => i.source_column_id)).toEqual([price.id]);
  await expect(rowNamed(page, "Order Line", "price")).toHaveCount(1);
  await expect(page.getByTestId("panel-attribute")).toBeVisible();

  // its type's precision and scale fit the right panel, also at its narrowest (280 px): they wrap under the type
  await expect(page.getByTestId("input-type-precision")).toHaveValue("10");
  await expect(page.getByTestId("input-type-scale")).toHaveValue("2");
  for (const width of [340, 280]) {
    await setPanelWidth(page, width);
    await expectTypeFieldsFit(page, ["input-type-precision", "input-type-scale"], width === 280);
  }
  // and a string's length
  await setPanelWidth(page, 340);
  await rowNamed(page, "Order Line", "product_id").click();
  await page.getByTestId("select-attribute-type").selectOption("string");
  await expect(page.getByTestId("input-type-length")).toBeVisible();
  for (const width of [340, 280]) {
    await setPanelWidth(page, width);
    await expectTypeFieldsFit(page, ["input-type-length"], false);
  }
});

// Assumption 11: a column dropped on the header of an entity that already has an attribute of the column's name (ignoring
// case) goes to that attribute as if dropped on its row: a direct mapping, or the D-48 choice when it has a mapping.
test("S1B-03: a column dropped on the header of an entity with an unmapped attribute of its name maps to that attribute", async ({ page }) => {
  const { attribute, column } = await ids();
  const segment = attribute("Customer", "segment_code");
  await asLukasz((ctx, access) => updateAttribute(ctx, access, { attribute: segment }, { attributeId: segment.id, expectedVersion: segment.version, name: "Segment" }));
  await signInAs(page, "Łukasz");
  // Customer (496, 40), customers (40, 40) and web_users (40, 376) in view, with room above the Customer header
  await openCanvas(page, canvasUrl(), { x: 0, y: 60, zoom: 0.8 });

  await dragTo(page, rowNamed(page, "customers", "segment"), card(page, "Customer").locator(".c-head"));
  await expectToast(page, "Mapped customers.segment to Customer.Segment");
  await expect(page.getByTestId("popover-map-choice")).toHaveCount(0);

  const model = await loadModel();
  expect(model.attributes.filter((a) => a.entity_id === segment.entity_id && a.name.toLowerCase() === "segment").map((a) => a.id)).toEqual([segment.id]);
  const mappings = model.mappings.filter((m) => m.attribute_id === segment.id);
  expect(mappings).toHaveLength(1);
  expect(model.mappingInputs.filter((i) => i.mapping_id === mappings[0]!.id).map((i) => i.source_column_id)).toEqual([column("customers", "segment").id]);
});

test("S1B-03: a column dropped on the header of an entity whose attribute of that name has a mapping shows the D-48 choice", async ({ page }) => {
  const { attribute, column } = await ids();
  const number = attribute("Customer", "customer_number");
  await asLukasz((ctx, access) => updateAttribute(ctx, access, { attribute: number }, { attributeId: number.id, expectedVersion: number.version, name: "cust_no" }));
  await signInAs(page, "Łukasz");
  // Customer (496, 40), customers (40, 40) and web_users (40, 376) in view, with room above the Customer header
  await openCanvas(page, canvasUrl(), { x: 0, y: 60, zoom: 0.8 });
  const choice = page.getByTestId("popover-map-choice");
  const header = card(page, "Customer").locator(".c-head");

  // the same choice and hint as on the row (another system: “Separate mapping” pre-selected); Esc changes nothing
  await dragTo(page, rowNamed(page, "web_users", "cust_no"), header);
  await expect(choice).toBeVisible();
  await expect(choice).toContainText("Customer.cust_no already has a mapping.");
  await expect(choice.getByTestId("option-map-choice")).toHaveText(["Separate mapping (alternative source)", "Add to mapping customers.cust_no"]);
  await expect(choice.locator('[data-testid="option-map-choice"][aria-selected="true"]')).toHaveText("Separate mapping (alternative source)");
  await page.keyboard.press("Escape");
  await expect(choice).toHaveCount(0);
  expect((await loadModel()).mappings.filter((m) => m.attribute_id === number.id)).toHaveLength(1);

  // Enter: a second mapping of the same attribute, no new attribute
  await dragTo(page, rowNamed(page, "web_users", "cust_no"), header);
  await expect(choice).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(choice).toHaveCount(0);
  await expect.poll(async () => (await loadModel()).mappings.filter((m) => m.attribute_id === number.id).length).toBe(2);
  const model = await loadModel();
  expect(model.attributes.filter((a) => a.entity_id === number.entity_id && a.name.toLowerCase() === "cust_no")).toHaveLength(1);
  const fromWeb = model.mappings.filter((m) => m.attribute_id === number.id && model.mappingInputs.some((i) => i.mapping_id === m.id && i.source_column_id === column("web_users", "cust_no").id));
  expect(fromWeb).toHaveLength(1);
  expect(fromWeb[0]!.kind).toBe("direct");
});

/** Sets the right panel's width (the page's grid column), as a narrow window would. */
async function setPanelWidth(page: Page, width: number) {
  await page.getByTestId("panel-inspector").evaluate((el, w) => {
    (el.parentElement as HTMLElement).style.gridTemplateColumns = `264px 1fr ${w}px`;
  }, width);
  await expect.poll(async () => Math.round((await page.getByTestId("panel-inspector").boundingBox())!.width)).toBe(width);
}

/** Every type field lies inside the panel's content; with `below`, the parameters sit under the type select. */
async function expectTypeFieldsFit(page: Page, params: string[], below: boolean) {
  const body = page.getByTestId("inspector-body");
  const { scrollWidth, clientWidth } = await body.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
  expect(scrollWidth, "no horizontal overflow in the right panel").toBeLessThanOrEqual(clientWidth);
  const panel = (await body.boundingBox())!;
  const select = (await page.getByTestId("select-attribute-type").boundingBox())!;
  for (const id of params) {
    const b = (await page.getByTestId(id).boundingBox())!;
    expect(b.x + b.width, `${id} inside the panel`).toBeLessThanOrEqual(panel.x + clientWidth);
    expect(b.width, `${id} keeps its width`).toBeGreaterThan(60);
    if (below) expect(b.y, `${id} under the type`).toBeGreaterThanOrEqual(select.y + select.height);
    else expect(Math.abs(b.y - select.y), `${id} next to the type`).toBeLessThan(4);
  }
}
